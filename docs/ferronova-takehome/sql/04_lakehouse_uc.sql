-- =====================================================================
-- Ferronova · Lakehouse side (Databricks SQL / Lakeflow Declarative Pipelines)
-- Illustrative, not executed here. Shows grain, keys, conformance and
-- the governed gold layer the app, dashboards and agent read.
--
-- Catalog layout (Unity Catalog):
--   ferronova.bronze   raw, append-only, one table per source feed
--   ferronova.silver   conformed to register IDs, typed, deduplicated, SCD2 where history matters
--   ferronova.gold     portfolio picture, risk, scenario impact (read models)
--   ferronova.ledger   Lakebase plan-of-record, registered in UC (read-only from the lakehouse)
--   ferronova.agent    agent tools (UC functions), proposals log, evaluation sets
-- =====================================================================

-- ---------------------------------------------------------------------
-- BRONZE: land everything as-is, keep lineage columns.
-- ---------------------------------------------------------------------

-- Planner workbooks and per-rig / per-crew trackers dropped in a UC Volume.
CREATE OR REFRESH STREAMING TABLE ferronova.bronze.planner_workbook_rows
COMMENT 'One row per sheet row of the planner trackers. Raw text, no typing.'
AS SELECT *, _metadata.file_path AS _source_file, current_timestamp() AS _ingested_at
FROM STREAM read_files('/Volumes/ferronova/landing/planner_workbooks/',
                       format => 'excel', header => true);   -- or CSV export if Excel reader unavailable

-- Factory MES exports: one feed per factory, different schemas.
CREATE OR REFRESH STREAMING TABLE ferronova.bronze.mes_fac_cb_operations
AS SELECT *, 'MES_FAC_CB' AS _source_system, current_timestamp() AS _ingested_at
FROM STREAM read_files('/Volumes/ferronova/landing/mes/fac_cb/', format => 'json');

-- Enterprise scheduling (Primavera-style DB), CRM, ERP: Lakeflow Connect / JDBC CDC
-- into bronze.p6_activities, bronze.crm_opportunities, bronze.erp_cost_plan ...

-- ---------------------------------------------------------------------
-- SILVER: conformance. The crux is ID resolution against the register.
-- ---------------------------------------------------------------------

-- Cross-reference: every source key maps to one canonical register ID.
-- Grain: one row per (source_system, source_entity, source_key).
CREATE TABLE IF NOT EXISTS ferronova.silver.xref_id (
  source_system   STRING NOT NULL,          -- MES_FAC_CB, P6, CRM, PLANNER_WB ...
  source_entity   STRING NOT NULL,          -- PROGRAMME, VEHICLE, BATCH, RIG, CREW, TEST
  source_key      STRING NOT NULL,
  canonical_id    STRING,                   -- register ID; NULL = unresolved
  match_method    STRING NOT NULL,          -- EXACT | RULE | STEWARD
  confirmed_by    STRING,
  valid_from      TIMESTAMP NOT NULL,
  valid_to        TIMESTAMP,
  CONSTRAINT xref_pk PRIMARY KEY (source_system, source_entity, source_key, valid_from) RELY
) COMMENT 'ID crosswalk. Unresolved keys go to a steward queue, never silently dropped.';

-- Conformed production batches. Expectations make bad rows visible, not invisible.
CREATE OR REFRESH STREAMING TABLE ferronova.silver.production_batch (
  CONSTRAINT batch_resolved    EXPECT (batch_id IS NOT NULL)      ON VIOLATION DROP ROW,
  CONSTRAINT design_resolved   EXPECT (design_id IS NOT NULL)     ON VIOLATION DROP ROW,
  CONSTRAINT positive_size     EXPECT (n_carbodies > 0)           ON VIOLATION FAIL UPDATE
)
COMMENT 'Grain: one row per production batch. Key: batch_id (register).'
AS
SELECT x.canonical_id                       AS batch_id,
       xd.canonical_id                      AS design_id,
       CAST(m.qty AS INT)                   AS n_carbodies,
       m._source_system, m._ingested_at
FROM STREAM ferronova.bronze.mes_fac_cb_operations m
LEFT JOIN ferronova.silver.xref_id x
       ON x.source_system = m._source_system AND x.source_entity = 'BATCH'
      AND x.source_key = m.lot_no AND x.valid_to IS NULL
LEFT JOIN ferronova.silver.xref_id xd
       ON xd.source_system = m._source_system AND xd.source_entity = 'DESIGN'
      AND xd.source_key = m.product_code AND xd.valid_to IS NULL;

-- Rows that failed resolution land in a quarantine table (same query, inverted
-- filter) so stewards can fix the crosswalk. Unresolved rate is a published KPI.

-- Core conformed tables (all keyed on register IDs; SCD2 via AUTO CDC where history matters):
--   silver.programme(programme_id)                   grain: programme or bid
--   silver.design(design_id)                         grain: vehicle configuration
--   silver.design_type_test(design_id, test_type_id) grain: required test
--   silver.milestone(milestone_id)                   grain: contractual milestone, SCD2 on terms
--   silver.production_step_plan(batch_id, step_code, site_id)  grain: batch x step, from MES
--   silver.cost_plan_month(programme_id, month)      grain: programme x month, from ERP
-- These feed Lakebase as synced (read-only) reference tables.

-- ---------------------------------------------------------------------
-- LEDGER IN UC: the Lakebase plan-of-record, registered in Unity Catalog
-- and replicated to Delta for history and analytics (change feed).
-- ---------------------------------------------------------------------
--   ferronova.ledger.rig_booking, crew_assignment, hall_occupancy,
--   scenario, plan_version, scenario_approval, operational_event

-- ---------------------------------------------------------------------
-- GOLD: the live portfolio picture and where risk is building.
-- ---------------------------------------------------------------------

CREATE OR REPLACE MATERIALIZED VIEW ferronova.gold.portfolio_milestone_risk
COMMENT 'Grain: one row per milestone in the committed plan. Read by dashboards, app and agent.'
AS
SELECT m.programme_id, p.name AS programme_name, p.status AS programme_status,
       m.milestone_id, m.name AS milestone_name, m.contract_date,
       e.forecast_date, e.days_late, e.gross_exposure_eur, e.recoverable,
       CASE WHEN e.days_late > 0 AND NOT e.recoverable THEN 'RED'
            WHEN e.days_late > 0 OR datediff(m.contract_date, e.forecast_date) < 30 THEN 'AMBER'
            ELSE 'GREEN' END AS rag
FROM ferronova.ledger.v_penalty_exposure e
JOIN ferronova.silver.milestone m ON m.milestone_id = e.milestone_id AND m.is_current
JOIN ferronova.silver.programme p ON p.programme_id = m.programme_id
WHERE e.scenario_id = 'BASELINE';

CREATE OR REPLACE MATERIALIZED VIEW ferronova.gold.resource_load_week
COMMENT 'Grain: resource x ISO week. Rig, crew and hall-position utilisation for the heatmap.'
AS
SELECT 'RIG' AS resource_type, rig_id AS resource_id, date_trunc('WEEK', d) AS week,
       count(*) / 7.0 AS utilisation
FROM ferronova.ledger.rig_booking
LATERAL VIEW explode(sequence(to_date(period_start), date_sub(to_date(period_end), 1))) AS d
WHERE scenario_id = 'BASELINE' AND rig_id IS NOT NULL
GROUP BY 1, 2, 3;
-- + same for crew_assignment and hall_occupancy (positions used / positions available)

-- ---------------------------------------------------------------------
-- GOVERNANCE: who sees what.
-- ---------------------------------------------------------------------

-- Factory planners see their own factory's batches; central planning sees all.
CREATE OR REPLACE FUNCTION ferronova.gov.factory_filter(site_id STRING)
RETURN is_account_group_member('central_planning') OR is_account_group_member(concat('factory_', site_id));
ALTER TABLE ferronova.silver.production_step_plan SET ROW FILTER ferronova.gov.factory_filter ON (site_id);

-- Margin and contract value only for finance and programme directors.
CREATE OR REPLACE FUNCTION ferronova.gov.mask_money(v DECIMAL(14,2))
RETURN CASE WHEN is_account_group_member('finance') OR is_account_group_member('programme_directors')
            THEN v ELSE NULL END;
ALTER TABLE ferronova.silver.programme ALTER COLUMN contract_value_eur SET MASK ferronova.gov.mask_money;

-- The agent service principal: read gold + ledger + reference, nothing else.
GRANT USE CATALOG ON CATALOG ferronova TO `sp-replan-agent`;
GRANT SELECT ON SCHEMA ferronova.gold   TO `sp-replan-agent`;
GRANT SELECT ON SCHEMA ferronova.ledger TO `sp-replan-agent`;
GRANT EXECUTE ON SCHEMA ferronova.agent TO `sp-replan-agent`;
-- No MODIFY anywhere. Writes go through Lakebase functions only (see 02_ledger_logic.sql).

-- ---------------------------------------------------------------------
-- AGENT TOOLS as UC functions (governed, logged, testable)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ferronova.agent.affected_bookings(p_event_id BIGINT)
RETURNS TABLE (booking_key STRING, campaign_id STRING, rig_id STRING,
               period_start TIMESTAMP, period_end TIMESTAMP, drives_milestone_id STRING)
COMMENT 'Bookings in the committed plan that conflict with a reality event.'
RETURN SELECT c.item_key, b.campaign_id, b.rig_id, b.period_start, b.period_end, h.drives_milestone_id
       FROM ferronova.ledger.v_plan_conflicts c
       JOIN ferronova.ledger.rig_booking b ON b.booking_key = c.item_key AND b.scenario_id = 'BASELINE'
       JOIN ferronova.ledger.homologation_campaign h ON h.campaign_id = b.campaign_id
       WHERE c.scenario_id = 'BASELINE';

CREATE OR REPLACE FUNCTION ferronova.agent.candidate_rigs(p_test_type STRING)
RETURNS TABLE (rig_id STRING, site_id STRING)
COMMENT 'Rigs capable of a test type.'
RETURN SELECT r.rig_id, r.site_id FROM ferronova.ledger.rig_capability c
       JOIN ferronova.ledger.test_rig r USING (rig_id) WHERE c.test_type_id = p_test_type;
-- + rig_free_slots(rig_id, from, to), qualified_crews(design_id, window_id), scenario_impact(scenario_id)
