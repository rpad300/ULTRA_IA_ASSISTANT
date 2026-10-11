-- =====================================================================
-- Ferronova · seed data + the spine walkthrough as executable tests
--
-- Story: test rig RIG-A goes down for 10 weeks. The agent proposes a
-- re-plan. We prove every hard rule rejects infeasible writes, for the
-- agent AND for humans, and that only a planner can commit, with a
-- director when the plan costs penalty money.
--
-- Run: psql -v ON_ERROR_STOP=1 -f 01_ledger_schema.sql -f 02_ledger_logic.sql -f 03_seed_and_tests.sql
-- =====================================================================
SET search_path = ledger, public;

-- Test identities (in Lakebase: Databricks users / service principal)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_svc')    THEN CREATE ROLE agent_svc    LOGIN IN ROLE agent; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='planner_ana')  THEN CREATE ROLE planner_ana  LOGIN IN ROLE planner; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='planner_joao') THEN CREATE ROLE planner_joao LOGIN IN ROLE planner; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='director_eva') THEN CREATE ROLE director_eva LOGIN IN ROLE programme_director; END IF;
END $$;

-- Helper: run a statement, PASS only if it fails with the expected error.
CREATE OR REPLACE FUNCTION public.expect_reject(p_label text, p_sql text, p_expect text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'FAIL  % : statement was accepted', p_label;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  IF position(p_expect IN SQLERRM) = 0 THEN
    RAISE EXCEPTION 'FAIL  % : wrong error: %', p_label, SQLERRM;
  END IF;
  RAISE NOTICE 'PASS  % -> rejected: %', p_label, left(SQLERRM, 110);
END $$;
GRANT EXECUTE ON FUNCTION public.expect_reject(text,text,text) TO PUBLIC;

-- Helper: a write tool must return REJECTED with the expected rule code.
CREATE OR REPLACE FUNCTION public.expect_rule(p_label text, p_result text, p_rule text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_result NOT LIKE 'REJECTED ' || p_rule || ' %' THEN
    RAISE EXCEPTION 'FAIL  % : expected % got %', p_label, p_rule, p_result;
  END IF;
  RAISE NOTICE 'PASS  % -> %', p_label, p_result;
END $$;
GRANT EXECUTE ON FUNCTION public.expect_rule(text,text,text) TO PUBLIC;

-- ---------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------
INSERT INTO programme VALUES
 ('PRG-101','CUST-LIS','Lisbon Metro 24 x 4-car',   'ACTIVE', 380000000),
 ('PRG-102','CUST-PRT','Porto Regional 18 x 3-car', 'ACTIVE', 260000000),
 ('BID-201','CUST-MAD','Madrid High-Speed 10 sets', 'BID',    720000000);
INSERT INTO design VALUES ('D-101','PRG-101','METRO'),('D-102','PRG-102','REGIONAL'),('D-201','BID-201','HIGH_SPEED');
INSERT INTO test_type VALUES ('EMC','Electromagnetic compatibility'),('BRAKE','Brake performance'),('PANTO','Pantograph dynamics');
INSERT INTO design_type_test VALUES ('D-101','EMC'),('D-102','BRAKE'),('D-102','EMC'),('D-201','EMC'),('D-201','PANTO');
INSERT INTO site VALUES ('TC-1','TEST_CENTRE','Velim-like ring'),('TC-2','TEST_CENTRE','Wildenrath-like ring'),
                        ('NET-LIS','CUSTOMER_NETWORK','Lisbon Metro network'),('FAC-CB','FACTORY','Car-body factory');
INSERT INTO test_rig VALUES ('RIG-A','TC-1','Ring A'),('RIG-B','TC-2','Ring B'),('RIG-C','TC-2','Brake rig C');
INSERT INTO rig_capability VALUES ('RIG-A','EMC'),('RIG-A','BRAKE'),('RIG-B','EMC'),('RIG-C','BRAKE'),('RIG-C','PANTO');
INSERT INTO crew VALUES ('CRW-1','TC-1'),('CRW-2','TC-2');
INSERT INTO crew_qualification VALUES
 ('CRW-1','D-101','[2026-01-01,2029-01-01)'),
 ('CRW-2','D-102','[2026-01-01,2029-01-01)');
INSERT INTO access_window VALUES
 ('W-LIS-0306','NET-LIS','[2027-03-06 22:00+00,2027-03-08 05:00+00)','GRANTED'),
 ('W-LIS-0313','NET-LIS','[2027-03-13 22:00+00,2027-03-15 05:00+00)','GRANTED');
INSERT INTO hall_position VALUES ('H1-P1','FAC-CB','H1'),('H1-P2','FAC-CB','H1');
INSERT INTO production_batch VALUES ('B-101-1','D-101',4),('B-101-2','D-101',4),('B-102-1','D-102',3);
INSERT INTO milestone VALUES
 ('M-101-HO','PRG-101','Fleet handover',      '2028-03-31', 60000, 9000000, NULL),
 ('M-101-TA','PRG-101','Type approval',       '2027-06-30', 50000, 5000000, NULL),
 ('M-102-HO','PRG-102','Fleet handover',      '2028-06-30', 40000, 6000000, NULL),
 ('M-102-TA','PRG-102','Type approval',       '2027-09-30', 40000, 4000000, 'M-102-HO');
INSERT INTO homologation_campaign VALUES
 ('C-101-EMC','D-101','EMC',  88,'M-101-TA'),
 ('C-102-BRK','D-102','BRAKE',92,'M-102-TA'),
 ('C-102-EMC','D-102','EMC',  60,'M-102-TA');
INSERT INTO guardrail_policy VALUES (true, 250000, true, false);

-- Committed plan v1
INSERT INTO plan_head VALUES (true, 1);
INSERT INTO scenario (scenario_id, kind, status, created_by, rationale)
VALUES ('BASELINE','BASELINE','LIVE','sync','Initial load from planner workbook');
INSERT INTO plan_version (version, committed_by, comment) VALUES (1,'sync','Initial load');
INSERT INTO rig_booking (scenario_id, booking_key, campaign_id, test_type_id, rig_id, period) VALUES
 ('BASELINE','BK-1','C-101-EMC','EMC',  'RIG-A','[2027-02-01,2027-04-30)'),
 ('BASELINE','BK-2','C-102-BRK','BRAKE','RIG-A','[2027-05-01,2027-08-01)'),
 ('BASELINE','BK-3','C-102-EMC','EMC',  'RIG-B','[2027-04-01,2027-05-31)');
INSERT INTO crew_assignment VALUES
 ('BASELINE','CA-1','CRW-1','D-101','[2026-01-01,2029-01-01)','W-LIS-0306','NET-LIS',
  '[2027-03-06 22:00+00,2027-03-08 05:00+00)','[2027-03-06 23:00+00,2027-03-07 05:00+00)',
  '2027-03-06 12:00+00','M-101-HO');
INSERT INTO hall_occupancy VALUES
 ('BASELINE','HO-1','H1-P1','B-101-1','[2027-01-04,2027-01-25)'),
 ('BASELINE','HO-2','H1-P2','B-101-2','[2027-01-11,2027-02-01)');

\echo
\echo ==== 0. Baseline is feasible and on time ====
SELECT scenario_id, net_exposure_eur, unscheduled_campaigns FROM v_scenario_impact WHERE scenario_id='BASELINE';

-- ---------------------------------------------------------------------
\echo ==== 1. Hard rules hold even on the committed plan ====
-- ---------------------------------------------------------------------
-- Even the table owner (who bypasses row-level security) cannot double-book.
SELECT expect_reject('B1 owner moves C-102-EMC onto RIG-A while C-101-EMC runs there',
 $q$UPDATE rig_booking SET rig_id='RIG-A' WHERE scenario_id='BASELINE' AND booking_key='BK-3'$q$,
 'rig_exclusive');
SELECT expect_reject('B2 owner books the same campaign twice in one plan',
 $q$INSERT INTO rig_booking (scenario_id, booking_key, campaign_id, test_type_id, rig_id, period)
    VALUES ('BASELINE','BK-X','C-102-EMC','EMC','RIG-B','[2027-09-01,2027-10-15)')$q$,
 'rig_booking_scenario_id_campaign_id_key');

-- ---------------------------------------------------------------------
\echo ==== 2. Event: RIG-A down 1 Mar to 15 May 2027 ====
-- ---------------------------------------------------------------------
INSERT INTO operational_event (event_type, source, payload)
VALUES ('RIG_DOWN','TC-1 maintenance log','{"rig_id":"RIG-A","from":"2027-03-01","to":"2027-05-15","cause":"traction supply failure"}');
INSERT INTO rig_outage (rig_id, period, event_id) VALUES ('RIG-A','[2027-03-01,2027-05-15)', 1);
\echo Conflicts now visible on the committed plan (this is what wakes the agent):
SELECT scenario_id, conflict_type, item_key, resource_id, period FROM v_plan_conflicts WHERE scenario_id='BASELINE';

-- ---------------------------------------------------------------------
\echo ==== 3. Agent works in its own sandbox ====
-- ---------------------------------------------------------------------
SET SESSION AUTHORIZATION agent_svc;
SELECT branch_scenario('AGENT_PROPOSAL','Re-plan after RIG-A outage', 1) AS agent_scenario \gset
\echo agent scenario = :agent_scenario

\echo Every attempt goes through the agent's write tools; refusals are logged with their rule.
SELECT expect_rule('A1 agent moves BRAKE campaign to RIG-B (rig cannot run BRAKE)',
 try_move_booking(:'agent_scenario','BK-2','RIG-B','[2027-05-01,2027-08-01)'), 'R1');

SELECT expect_rule('A2 agent double-books RIG-B (overlaps C-102-EMC)',
 try_move_booking(:'agent_scenario','BK-1','RIG-B','[2027-03-01,2027-05-28)'), 'R1');

SELECT expect_rule('A2b agent tries RIG-B again a week later (still overlaps)',
 try_move_booking(:'agent_scenario','BK-1','RIG-B','[2027-03-08,2027-06-04)'), 'R1');

SELECT expect_rule('A3 agent assigns unqualified crew CRW-2 to the metro design',
 try_assign_crew(:'agent_scenario','CA-1','CRW-2','D-101','W-LIS-0306',
   '[2027-03-06 23:00+00,2027-03-07 05:00+00)','2027-03-06 12:00+00','M-101-HO'), 'R2');

SELECT expect_rule('A4 agent schedules crew outside the customer access window',
 try_assign_crew(:'agent_scenario','CA-1','CRW-1','D-101','W-LIS-0306',
   '[2027-03-08 01:00+00,2027-03-08 09:00+00)','2027-03-07 20:00+00','M-101-HO'), 'R3');

SELECT expect_rule('A5 agent books same crew again before travel time is over',
 try_assign_crew(:'agent_scenario','CA-2','CRW-1','D-101','W-LIS-0306',
   '[2027-03-07 22:00+00,2027-03-08 04:00+00)','2027-03-07 03:00+00','M-101-HO'), 'R3');

SELECT expect_rule('A6 agent parks a third batch on an occupied hall position',
 try_park_batch(:'agent_scenario','HO-3','H1-P1','B-102-1','[2027-01-20,2027-02-10)'), 'R4');

SELECT expect_reject('A7 agent writes the committed plan directly',
 $q$INSERT INTO rig_booking (scenario_id, booking_key, campaign_id, test_type_id, rig_id, period)
    VALUES ('BASELINE','BK-9','C-101-EMC','EMC','RIG-B','[2027-06-01,2027-08-28)')$q$,
 'row-level security');

SELECT expect_reject('A8 agent moves a contractual milestone date',
 $q$UPDATE milestone SET contract_date='2027-12-31' WHERE milestone_id='M-101-TA'$q$,
 'permission denied');

SELECT expect_reject('A9 agent tries to commit its own proposal',
 format($q$SELECT commit_scenario(%L,'self-commit')$q$, :'agent_scenario'),
 'permission denied');

\echo Agent writes a feasible proposal: EMC to RIG-B after C-102-EMC, BRAKE to RIG-C.
SELECT try_move_booking(:'agent_scenario','BK-1','RIG-B','[2027-06-01,2027-08-28)') AS bk1,
       try_move_booking(:'agent_scenario','BK-2','RIG-C','[2027-05-01,2027-08-01)') AS bk2;
SELECT submit_scenario(:'agent_scenario',
 'RIG-A unavailable 1 Mar-15 May. Moved C-101-EMC to RIG-B after C-102-EMC (only EMC-capable rig free); moved C-102-BRK to RIG-C (same dates). Cost: M-101-TA forecast 59 days late.');
RESET SESSION AUTHORIZATION;

\echo Proposal impact vs committed plan:
SELECT scenario_id, net_exposure_eur, penalty_delta_eur, milestones_newly_late, unscheduled_campaigns
FROM v_scenario_impact WHERE scenario_id IN ('BASELINE', :'agent_scenario') ORDER BY 1;

-- ---------------------------------------------------------------------
\echo ==== 4. Planner reviews, overrides, commits ====
-- ---------------------------------------------------------------------
SET SESSION AUTHORIZATION planner_ana;
SELECT expect_rule('P1 planner override is held to the same rules (overlap on RIG-B)',
 try_move_booking(:'agent_scenario','BK-1','RIG-B','[2027-05-20,2027-08-16)'), 'R1');

\echo Planner override: C-102-EMC on RIG-B pulled forward 1 Mar (its rig is free), C-101-EMC follows 1 May.
SELECT try_move_booking(:'agent_scenario','BK-3','RIG-B','[2027-03-01,2027-04-30)') AS bk3,
       try_move_booking(:'agent_scenario','BK-1','RIG-B','[2027-05-01,2027-07-28)') AS bk1;
SELECT booking_key, campaign_id, rig_id, period, last_modified_by
FROM rig_booking WHERE scenario_id=:'agent_scenario' ORDER BY 1;
SELECT scenario_id, penalty_delta_eur, milestones_newly_late FROM v_scenario_impact WHERE scenario_id=:'agent_scenario';

SELECT expect_rule('P2 planner commits a plan that still costs penalties, without a director',
 try_commit(:'agent_scenario','commit'), 'R5');
RESET SESSION AUTHORIZATION;

SET SESSION AUTHORIZATION director_eva;
SELECT decide_scenario(:'agent_scenario','APPROVE','Accept 28 days late on M-101-TA; recover via handover buffer');
RESET SESSION AUTHORIZATION;

-- A second scenario branched now (v1) will become stale after the commit.
SET SESSION AUTHORIZATION planner_joao;
SELECT branch_scenario('WHAT_IF','What if BID-201 lands in Q2?') AS whatif \gset
RESET SESSION AUTHORIZATION;

SET SESSION AUTHORIZATION planner_ana;
SELECT try_commit(:'agent_scenario','RIG-A outage re-plan, approved by director') AS result;
RESET SESSION AUTHORIZATION;

-- ---------------------------------------------------------------------
\echo ==== 5. After commit ====
-- ---------------------------------------------------------------------
SELECT version, committed_by, source_scenario_id, penalty_delta_eur, comment FROM plan_version ORDER BY version;
\echo Conflicts left on the committed plan (expect none):
SELECT count(*) AS baseline_conflicts FROM v_plan_conflicts WHERE scenario_id='BASELINE';

SET SESSION AUTHORIZATION planner_joao;
SELECT expect_rule('P3 stale what-if built on v1 cannot overwrite v2',
 try_commit(:'whatif','late commit'), 'GATE');
RESET SESSION AUTHORIZATION;

SET SESSION AUTHORIZATION planner_joao;
SELECT branch_scenario('WHAT_IF','Put BRAKE back on RIG-A') AS whatif2 \gset
SELECT try_move_booking(:'whatif2','BK-2','RIG-A','[2027-04-01,2027-07-02)') AS bk2;
SELECT expect_rule('P4 feasible-on-paper plan that books a rig during a known outage',
 try_commit(:'whatif2','commit'), 'GATE');
RESET SESSION AUTHORIZATION;

-- ---------------------------------------------------------------------
\echo ==== 6. Rejections are kept: audit, agent feedback, demand signal ====
-- ---------------------------------------------------------------------
SELECT actor, stage, rule_code, enforced_by, resource_id, item_key
FROM rejection_log ORDER BY rejection_id;
\echo Pressure on scarce resources (the case for renting capacity):
SELECT rule_code, resource_id, rejections, refused_by FROM v_rejection_pressure
ORDER BY rejections DESC, resource_id;
DO $$ BEGIN
  IF (SELECT count(*) FROM rejection_log) <> 11 THEN
    RAISE EXCEPTION 'FAIL  rejection log should hold 11 refusals, has %', (SELECT count(*) FROM rejection_log);
  END IF;
  IF (SELECT rejections FROM v_rejection_pressure WHERE resource_id='RIG-B' AND rule_code='R1') <> 4 THEN
    RAISE EXCEPTION 'FAIL  RIG-B should show 4 R1 refusals';
  END IF;
  RAISE NOTICE 'PASS  L1 every refusal logged with its rule; RIG-B is the most refused resource (4 x R1)';
END $$;
\echo Done.
