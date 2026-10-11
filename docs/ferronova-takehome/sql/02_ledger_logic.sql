-- =====================================================================
-- Ferronova · ledger logic: derived views, commit gate, roles, RLS
-- =====================================================================
SET search_path = ledger, public;

-- ---------------------------------------------------------------------
-- 1. MILESTONE FORECAST AND PENALTY EXPOSURE (per scenario)
--    Milestones are soft: they never block a commit, they price it.
-- ---------------------------------------------------------------------

CREATE VIEW v_milestone_forecast AS
WITH drivers AS (
  SELECT rb.scenario_id, hc.drives_milestone_id AS milestone_id,
         upper(rb.period) AS finish, rb.period IS NULL AS unscheduled
  FROM rig_booking rb JOIN homologation_campaign hc USING (campaign_id)
  WHERE hc.drives_milestone_id IS NOT NULL
  UNION ALL
  SELECT ca.scenario_id, ca.drives_milestone_id, upper(ca.period), false
  FROM crew_assignment ca WHERE ca.drives_milestone_id IS NOT NULL
)
SELECT s.scenario_id, m.milestone_id, m.programme_id, m.contract_date,
       max(d.finish)::date                       AS forecast_date,
       coalesce(bool_or(d.unscheduled), false)   AS has_unscheduled_driver
FROM scenario s
CROSS JOIN milestone m
LEFT JOIN drivers d ON d.scenario_id = s.scenario_id AND d.milestone_id = m.milestone_id
GROUP BY s.scenario_id, m.milestone_id, m.programme_id, m.contract_date;

CREATE VIEW v_penalty_exposure AS
SELECT f.scenario_id, f.milestone_id, f.programme_id, f.contract_date, f.forecast_date,
       f.has_unscheduled_driver,
       greatest(0, f.forecast_date - f.contract_date)              AS days_late,
       CASE
         WHEN f.has_unscheduled_driver THEN m.penalty_cap_eur       -- unknown date: worst case
         ELSE least(m.penalty_cap_eur,
                    m.penalty_per_day_eur * greatest(0, f.forecast_date - f.contract_date))
       END                                                          AS gross_exposure_eur,
       -- Recoverable: waived if the recovery milestone is forecast on time.
       coalesce(r.forecast_date <= r.contract_date AND NOT r.has_unscheduled_driver, false)
                                                                    AS recoverable
FROM v_milestone_forecast f
JOIN milestone m USING (milestone_id)
LEFT JOIN v_milestone_forecast r
       ON r.scenario_id = f.scenario_id AND r.milestone_id = m.recoverable_by_milestone_id;

CREATE VIEW v_scenario_impact AS
WITH e AS (
  SELECT scenario_id, milestone_id,
         CASE WHEN recoverable THEN 0 ELSE gross_exposure_eur END AS net_exposure_eur,
         days_late
  FROM v_penalty_exposure
)
SELECT s.scenario_id,
       sum(e.net_exposure_eur)                                         AS net_exposure_eur,
       sum(e.net_exposure_eur) - (SELECT sum(b.net_exposure_eur) FROM e b
                                  WHERE b.scenario_id = 'BASELINE')    AS penalty_delta_eur,
       count(*) FILTER (WHERE e.days_late > 0 AND NOT EXISTS (
          SELECT 1 FROM e b WHERE b.scenario_id = 'BASELINE'
            AND b.milestone_id = e.milestone_id AND b.days_late > 0))  AS milestones_newly_late,
       (SELECT count(*) FROM rig_booking rb
         WHERE rb.scenario_id = s.scenario_id AND rb.period IS NULL)   AS unscheduled_campaigns
FROM scenario s JOIN e USING (scenario_id)
GROUP BY s.scenario_id;

-- ---------------------------------------------------------------------
-- 2. CONFLICTS WITH REALITY
--    The same view (a) detects that the committed plan is broken and
--    triggers a re-plan, and (b) is the commit gate for any scenario.
-- ---------------------------------------------------------------------

CREATE VIEW v_plan_conflicts AS
SELECT rb.scenario_id, 'RIG_OUTAGE'::text AS conflict_type,
       rb.booking_key AS item_key, rb.rig_id AS resource_id, rb.period
FROM rig_booking rb
JOIN rig_outage o ON o.rig_id = rb.rig_id AND o.period && rb.period
UNION ALL
SELECT ca.scenario_id, 'WINDOW_REVOKED', ca.assignment_key, ca.window_id, ca.period
FROM crew_assignment ca
JOIN access_window w USING (window_id)
WHERE w.status = 'REVOKED';

-- ---------------------------------------------------------------------
-- 3. SCENARIO LIFECYCLE FUNCTIONS
--    SECURITY DEFINER: run as ledger owner, so callers need no direct
--    write rights on BASELINE. Identity checks use session_user.
-- ---------------------------------------------------------------------

-- Branch a new scenario as a full copy of the committed plan.
CREATE FUNCTION branch_scenario(p_kind text, p_rationale text, p_event bigint DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ledger, public AS $$
DECLARE v_id text; v_ver int;
BEGIN
  IF p_kind = 'AGENT_PROPOSAL' AND NOT pg_has_role(session_user, 'agent', 'MEMBER') THEN
    RAISE EXCEPTION 'only the agent role creates AGENT_PROPOSAL scenarios';
  END IF;
  IF p_kind = 'WHAT_IF' AND NOT pg_has_role(session_user, 'planner', 'MEMBER') THEN
    RAISE EXCEPTION 'only planners create WHAT_IF scenarios';
  END IF;
  SELECT version INTO v_ver FROM plan_head;
  v_id := lower(p_kind) || '-' || nextval('scenario_seq');
  INSERT INTO scenario (scenario_id, kind, status, base_version, trigger_event_id, created_by, rationale)
  VALUES (v_id, p_kind, 'DRAFT', v_ver, p_event, session_user, p_rationale);

  INSERT INTO rig_booking (scenario_id, booking_key, campaign_id, test_type_id, rig_id, period)
  SELECT v_id, booking_key, campaign_id, test_type_id, rig_id, period
  FROM rig_booking WHERE scenario_id = 'BASELINE';
  INSERT INTO crew_assignment (scenario_id, assignment_key, crew_id, design_id, qual_period,
         window_id, site_id, window_period, period, mobilise_from, drives_milestone_id)
  SELECT v_id, assignment_key, crew_id, design_id, qual_period,
         window_id, site_id, window_period, period, mobilise_from, drives_milestone_id
  FROM crew_assignment WHERE scenario_id = 'BASELINE';
  INSERT INTO hall_occupancy (scenario_id, occupancy_key, position_id, batch_id, period)
  SELECT v_id, occupancy_key, position_id, batch_id, period
  FROM hall_occupancy WHERE scenario_id = 'BASELINE';
  RETURN v_id;
END $$;
CREATE SEQUENCE scenario_seq;

-- Agent or planner hands a draft over for review.
CREATE FUNCTION submit_scenario(p_scenario text, p_rationale text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ledger, public AS $$
BEGIN
  UPDATE scenario SET status = 'PROPOSED', rationale = p_rationale
  WHERE scenario_id = p_scenario AND status = 'DRAFT' AND created_by = session_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'scenario % is not your draft', p_scenario; END IF;
END $$;

-- Human decision. Agents have no EXECUTE on this.
CREATE FUNCTION decide_scenario(p_scenario text, p_decision text, p_comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ledger, public AS $$
DECLARE v_role text;
BEGIN
  v_role := CASE WHEN pg_has_role(session_user, 'programme_director', 'MEMBER') THEN 'PROGRAMME_DIRECTOR'
                 WHEN pg_has_role(session_user, 'planner', 'MEMBER')            THEN 'PLANNER' END;
  IF v_role IS NULL THEN RAISE EXCEPTION 'only planners or directors decide'; END IF;
  IF EXISTS (SELECT 1 FROM scenario WHERE scenario_id = p_scenario AND created_by = session_user
                                         AND kind = 'AGENT_PROPOSAL') THEN
    RAISE EXCEPTION 'no self-approval';
  END IF;
  INSERT INTO scenario_approval (scenario_id, approver, approver_role, decision, comment)
  VALUES (p_scenario, session_user, v_role, p_decision, p_comment)
  ON CONFLICT (scenario_id, approver) DO UPDATE
    SET decision = EXCLUDED.decision, comment = EXCLUDED.comment, decided_at = now();
  IF p_decision = 'REJECT' THEN
    UPDATE scenario SET status = 'REJECTED' WHERE scenario_id = p_scenario;
  END IF;
END $$;

-- THE COMMIT GATE. The only path that writes the plan of record.
CREATE FUNCTION commit_scenario(p_scenario text, p_comment text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = ledger, public AS $$
DECLARE s scenario; v_head int; i v_scenario_impact; pol guardrail_policy; v_new int;
BEGIN
  -- G1 identity: only planners commit. Agents never reach this line.
  IF NOT pg_has_role(session_user, 'planner', 'MEMBER') THEN
    RAISE EXCEPTION 'G1: only a planner can commit a plan';
  END IF;

  -- G2 serialise commits and reject stale scenarios (optimistic concurrency).
  SELECT version INTO v_head FROM plan_head FOR UPDATE;
  SELECT * INTO s FROM scenario WHERE scenario_id = p_scenario FOR UPDATE;
  IF s.status NOT IN ('DRAFT','PROPOSED') OR s.kind = 'BASELINE' THEN
    RAISE EXCEPTION 'G2: scenario % is %, not committable', p_scenario, s.status;
  END IF;
  IF s.base_version <> v_head THEN
    UPDATE scenario SET status = 'STALE' WHERE scenario_id = p_scenario;
    RAISE EXCEPTION 'G2: scenario % was built on plan v% but plan is now v%; re-branch',
                    p_scenario, s.base_version, v_head;
  END IF;

  -- G3 four eyes: an agent proposal needs an explicit human APPROVE.
  IF s.kind = 'AGENT_PROPOSAL' AND NOT EXISTS (
       SELECT 1 FROM scenario_approval WHERE scenario_id = p_scenario AND decision = 'APPROVE') THEN
    PERFORM decide_scenario(p_scenario, 'APPROVE', p_comment);   -- committing planner approves
  END IF;
  IF EXISTS (SELECT 1 FROM scenario_approval WHERE scenario_id = p_scenario AND decision = 'REJECT') THEN
    RAISE EXCEPTION 'G3: scenario % has a REJECT decision', p_scenario;
  END IF;

  -- G4 reality: nothing booked on a broken rig or a revoked window.
  IF EXISTS (SELECT 1 FROM v_plan_conflicts WHERE scenario_id = p_scenario) THEN
    RAISE EXCEPTION 'G4: scenario % conflicts with known outages or revoked windows', p_scenario;
  END IF;

  -- G5 business policy: "ruinous" needs a programme director.
  SELECT * INTO pol FROM guardrail_policy;
  SELECT * INTO i   FROM v_scenario_impact WHERE scenario_id = p_scenario;
  IF i.unscheduled_campaigns > 0 AND NOT pol.allow_unscheduled_campaigns THEN
    RAISE EXCEPTION 'G5: % campaign(s) left unscheduled; every campaign needs a slot',
                    i.unscheduled_campaigns;
  END IF;
  IF (i.penalty_delta_eur > pol.max_penalty_delta_eur_unescalated
      OR (pol.escalate_if_milestone_newly_late AND i.milestones_newly_late > 0))
     AND NOT EXISTS (SELECT 1 FROM scenario_approval WHERE scenario_id = p_scenario
                       AND approver_role = 'PROGRAMME_DIRECTOR' AND decision = 'APPROVE') THEN
    RAISE EXCEPTION 'G5: penalty delta EUR % and % newly late milestone(s) need programme director approval',
                    i.penalty_delta_eur, i.milestones_newly_late;
  END IF;

  -- G6 apply atomically. The same EXCLUDE / FK / CHECK constraints
  --    re-validate the new baseline before the transaction can commit.
  SET CONSTRAINTS ALL DEFERRED;
  DELETE FROM rig_booking     WHERE scenario_id = 'BASELINE';
  DELETE FROM crew_assignment WHERE scenario_id = 'BASELINE';
  DELETE FROM hall_occupancy  WHERE scenario_id = 'BASELINE';
  INSERT INTO rig_booking (scenario_id, booking_key, campaign_id, test_type_id, rig_id, period)
  SELECT 'BASELINE', booking_key, campaign_id, test_type_id, rig_id, period
  FROM rig_booking WHERE scenario_id = p_scenario;
  INSERT INTO crew_assignment (scenario_id, assignment_key, crew_id, design_id, qual_period,
         window_id, site_id, window_period, period, mobilise_from, drives_milestone_id)
  SELECT 'BASELINE', assignment_key, crew_id, design_id, qual_period,
         window_id, site_id, window_period, period, mobilise_from, drives_milestone_id
  FROM crew_assignment WHERE scenario_id = p_scenario;
  INSERT INTO hall_occupancy (scenario_id, occupancy_key, position_id, batch_id, period)
  SELECT 'BASELINE', occupancy_key, position_id, batch_id, period
  FROM hall_occupancy WHERE scenario_id = p_scenario;
  SET CONSTRAINTS ALL IMMEDIATE;

  v_new := v_head + 1;
  UPDATE plan_head SET version = v_new;
  INSERT INTO plan_version (version, committed_by, source_scenario_id, penalty_delta_eur, comment)
  VALUES (v_new, session_user, p_scenario, i.penalty_delta_eur, p_comment);
  UPDATE scenario SET status = 'COMMITTED' WHERE scenario_id = p_scenario;
  RETURN v_new;
END $$;

-- ---------------------------------------------------------------------
-- 4. ROLES AND ROW-LEVEL SECURITY
--    In Lakebase these map to Databricks identities (users, groups,
--    service principals). The agent runs as its own service principal.
-- ---------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agent')              THEN CREATE ROLE agent; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'planner')            THEN CREATE ROLE planner; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'programme_director') THEN CREATE ROLE programme_director; END IF;
END $$;

GRANT USAGE ON SCHEMA ledger TO agent, planner, programme_director;
GRANT SELECT ON ALL TABLES IN SCHEMA ledger TO agent, planner, programme_director;

-- Plan rows: agents and planners may write, RLS decides which scenarios.
GRANT INSERT, UPDATE, DELETE ON rig_booking, crew_assignment, hall_occupancy TO agent, planner;
-- Reality events: planners record them (and source integrations); agents do not.
GRANT INSERT ON operational_event, rig_outage TO planner;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA ledger TO planner;

-- Functions: explicit allow-list per role.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA ledger FROM PUBLIC;
GRANT EXECUTE ON FUNCTION branch_scenario(text, text, bigint) TO agent, planner;
GRANT EXECUTE ON FUNCTION submit_scenario(text, text)         TO agent, planner;
GRANT EXECUTE ON FUNCTION decide_scenario(text, text, text)   TO planner, programme_director;
GRANT EXECUTE ON FUNCTION commit_scenario(text, text)         TO planner;
GRANT EXECUTE ON FUNCTION stamp_modified_by()                 TO agent, planner;

-- Writable scenarios:
--   agent   -> its own AGENT_PROPOSAL drafts only
--   planner -> any non-baseline scenario still open (this is "override / edit")
--   nobody  -> BASELINE (only commit_scenario, running as owner)
CREATE FUNCTION can_write_scenario(p_scenario text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ledger, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM scenario s
    WHERE s.scenario_id = p_scenario AND s.kind <> 'BASELINE'
      AND (   (pg_has_role(session_user, 'agent', 'MEMBER')
               AND s.kind = 'AGENT_PROPOSAL' AND s.status = 'DRAFT' AND s.created_by = session_user)
           OR (pg_has_role(session_user, 'planner', 'MEMBER')
               AND s.status IN ('DRAFT','PROPOSED'))))
$$;
GRANT EXECUTE ON FUNCTION can_write_scenario(text) TO agent, planner, programme_director;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rig_booking','crew_assignment','hall_occupancy'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY read_all ON %I FOR SELECT USING (true)', t);
    EXECUTE format('CREATE POLICY write_open ON %I FOR ALL
                      USING (can_write_scenario(scenario_id))
                      WITH CHECK (can_write_scenario(scenario_id))', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 5. WRITE TOOLS THAT KEEP THEIR REJECTIONS
--    The agent and the planner app call these instead of raw SQL.
--    They run as the caller (SECURITY INVOKER), so RLS and every
--    constraint still apply. A refused write is rolled back and logged
--    with the rule that refused it. Nothing here weakens a rule.
-- ---------------------------------------------------------------------

CREATE FUNCTION log_rejection(p_scenario text, p_stage text, p_enforced_by text,
                              p_resource text, p_item text, p_detail text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = ledger, public AS $$
DECLARE v_rule text;
BEGIN
  SELECT rule_code INTO v_rule FROM rule_catalog WHERE enforced_by = p_enforced_by;
  INSERT INTO rejection_log (actor, scenario_id, stage, rule_code, enforced_by, resource_id, item_key, detail)
  VALUES (session_user, p_scenario, p_stage, coalesce(v_rule, 'OTHER'), p_enforced_by, p_resource, p_item, p_detail);
  RETURN 'REJECTED ' || coalesce(v_rule, 'OTHER') || ' ' || p_enforced_by;
END $$;

-- Move a campaign to a rig and period (or leave it unscheduled with NULLs).
CREATE FUNCTION try_move_booking(p_scenario text, p_booking_key text, p_rig text, p_period tstzrange)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = ledger, public AS $$
DECLARE v_con text; v_msg text;
BEGIN
  UPDATE rig_booking SET rig_id = p_rig, period = p_period
  WHERE scenario_id = p_scenario AND booking_key = p_booking_key;
  IF NOT FOUND THEN
    RETURN log_rejection(p_scenario, 'DRAFT', 'RLS', p_rig, p_booking_key, 'booking not writable by caller');
  END IF;
  RETURN 'OK';
EXCEPTION WHEN integrity_constraint_violation OR insufficient_privilege THEN
  GET STACKED DIAGNOSTICS v_con = CONSTRAINT_NAME, v_msg = MESSAGE_TEXT;
  RETURN log_rejection(p_scenario, 'DRAFT', coalesce(nullif(v_con, ''), 'RLS'), p_rig, p_booking_key, v_msg);
END $$;

-- Place a crew on a commissioning shift. Business inputs only: the tool
-- looks up qualification and window, and the constraints decide.
CREATE FUNCTION try_assign_crew(p_scenario text, p_key text, p_crew text, p_design text,
                                p_window text, p_period tstzrange, p_mobilise_from timestamptz,
                                p_milestone text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = ledger, public AS $$
DECLARE v_con text; v_msg text; v_qual tstzrange; v_site text; v_wper tstzrange;
BEGIN
  SELECT valid_period INTO v_qual FROM crew_qualification
   WHERE crew_id = p_crew AND design_id = p_design
   ORDER BY (valid_period @> p_period) DESC LIMIT 1;
  SELECT site_id, period INTO v_site, v_wper FROM access_window WHERE window_id = p_window;
  INSERT INTO crew_assignment (scenario_id, assignment_key, crew_id, design_id, qual_period,
         window_id, site_id, window_period, period, mobilise_from, drives_milestone_id)
  VALUES (p_scenario, p_key, p_crew, p_design, coalesce(v_qual, p_period),
          p_window, coalesce(v_site, 'UNKNOWN'), coalesce(v_wper, p_period), p_period,
          p_mobilise_from, p_milestone)
  ON CONFLICT (scenario_id, assignment_key) DO UPDATE SET
    crew_id = EXCLUDED.crew_id, design_id = EXCLUDED.design_id, qual_period = EXCLUDED.qual_period,
    window_id = EXCLUDED.window_id, site_id = EXCLUDED.site_id, window_period = EXCLUDED.window_period,
    period = EXCLUDED.period, mobilise_from = EXCLUDED.mobilise_from,
    drives_milestone_id = EXCLUDED.drives_milestone_id;
  RETURN 'OK';
EXCEPTION WHEN integrity_constraint_violation OR insufficient_privilege THEN
  GET STACKED DIAGNOSTICS v_con = CONSTRAINT_NAME, v_msg = MESSAGE_TEXT;
  RETURN log_rejection(p_scenario, 'DRAFT', coalesce(nullif(v_con, ''), 'RLS'), p_crew, p_key, v_msg);
END $$;

-- Park a batch on a hall position.
CREATE FUNCTION try_park_batch(p_scenario text, p_key text, p_position text, p_batch text, p_period tstzrange)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = ledger, public AS $$
DECLARE v_con text; v_msg text;
BEGIN
  INSERT INTO hall_occupancy (scenario_id, occupancy_key, position_id, batch_id, period)
  VALUES (p_scenario, p_key, p_position, p_batch, p_period)
  ON CONFLICT (scenario_id, occupancy_key) DO UPDATE SET
    position_id = EXCLUDED.position_id, batch_id = EXCLUDED.batch_id, period = EXCLUDED.period;
  RETURN 'OK';
EXCEPTION WHEN integrity_constraint_violation OR insufficient_privilege THEN
  GET STACKED DIAGNOSTICS v_con = CONSTRAINT_NAME, v_msg = MESSAGE_TEXT;
  RETURN log_rejection(p_scenario, 'DRAFT', coalesce(nullif(v_con, ''), 'RLS'), p_position, p_key, v_msg);
END $$;

-- Commit through the gate; a refusal is logged with its gate code.
CREATE FUNCTION try_commit(p_scenario text, p_comment text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = ledger, public AS $$
DECLARE v_ver int; v_msg text;
BEGIN
  v_ver := commit_scenario(p_scenario, p_comment);
  RETURN 'COMMITTED v' || v_ver;
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
  RETURN log_rejection(p_scenario, 'COMMIT',
                       CASE WHEN v_msg ~ '^G[0-9]:' THEN left(v_msg, 2) ELSE 'RLS' END,
                       p_scenario, NULL, v_msg);
END $$;

-- Demand signal: which scarce resources keep getting refused, and why.
CREATE VIEW v_rejection_pressure AS
SELECT rule_code, resource_id,
       count(*)                                          AS rejections,
       count(DISTINCT scenario_id)                       AS scenarios,
       string_agg(DISTINCT enforced_by, ', ')            AS refused_by,
       max(rejected_at)                                  AS last_rejected_at
FROM rejection_log
GROUP BY rule_code, resource_id;

REVOKE EXECUTE ON FUNCTION log_rejection(text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_rejection(text,text,text,text,text,text)       TO agent, planner;
GRANT EXECUTE ON FUNCTION try_move_booking(text,text,text,tstzrange)         TO agent, planner;
GRANT EXECUTE ON FUNCTION try_assign_crew(text,text,text,text,text,tstzrange,timestamptz,text) TO agent, planner;
GRANT EXECUTE ON FUNCTION try_park_batch(text,text,text,text,tstzrange)      TO agent, planner;
GRANT EXECUTE ON FUNCTION try_commit(text,text)                              TO planner;
GRANT SELECT ON rule_catalog, rejection_log, v_rejection_pressure TO agent, planner, programme_director;
