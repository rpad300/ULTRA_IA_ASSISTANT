-- =====================================================================
-- Ferronova · Plan-of-Record ledger (commit plane)
-- Target: Databricks Lakebase (managed Postgres). Tested on PostgreSQL 16.
--
-- Why Postgres and not Delta for this part:
--   Delta PRIMARY KEY / FOREIGN KEY constraints are informational only.
--   Delta enforces NOT NULL and CHECK, both row-local. "A rig hosts one
--   campaign at a time" is a cross-row rule, so Delta cannot make it
--   impossible. Postgres can: EXCLUDE constraints, enforced FKs,
--   transactions, row-level security. The ledger is small (thousands of
--   rows) and write-heavy in the transactional sense; the lakehouse keeps
--   everything else.
--
-- Design principles:
--   P1  Every hard rule is a declarative constraint, not app code.
--   P2  Rules that reality can break after commit (rig breaks down,
--       customer revokes a window) are re-validated by the commit gate
--       and surfaced in v_plan_conflicts. Reality is never blocked.
--   P3  The committed plan (scenario 'BASELINE') is written by one
--       function only: commit_scenario(). Nobody, human or agent, writes
--       it directly.
--   P4  Every scenario is internally feasible at all times, because the
--       constraints are scoped by scenario_id.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- '=' on text inside GiST exclusion

DROP SCHEMA IF EXISTS ledger CASCADE;
CREATE SCHEMA ledger;
SET search_path = ledger, public;

-- ---------------------------------------------------------------------
-- 1. REFERENCE DATA
--    Source of truth: Unity Catalog silver (conformed, keyed on the
--    programme register IDs). Synced into Lakebase. Soft-retire only,
--    never hard delete, so foreign keys always hold.
-- ---------------------------------------------------------------------

CREATE TABLE programme (
  programme_id        text PRIMARY KEY,                 -- register ID, e.g. PRG-101
  customer_id         text NOT NULL,
  name                text NOT NULL,
  status              text NOT NULL CHECK (status IN ('BID','ACTIVE','CLOSED')),
  contract_value_eur  numeric(14,2) NOT NULL CHECK (contract_value_eur >= 0)
);

-- One vehicle design (configuration) per programme. Bids get a design shell
-- so a "bid lands" scenario consumes rigs and crews like a real programme.
CREATE TABLE design (
  design_id       text PRIMARY KEY,                     -- PLM configuration ID
  programme_id    text NOT NULL REFERENCES programme,
  vehicle_family  text NOT NULL                          -- METRO | REGIONAL | HIGH_SPEED
);

CREATE TABLE test_type (
  test_type_id  text PRIMARY KEY,                       -- EMC, BRAKE, PANTOGRAPH ...
  description   text NOT NULL
);

-- PLM: which type-tests a design must pass for homologation.
CREATE TABLE design_type_test (
  design_id     text REFERENCES design,
  test_type_id  text REFERENCES test_type,
  PRIMARY KEY (design_id, test_type_id)
);

CREATE TABLE site (
  site_id  text PRIMARY KEY,
  kind     text NOT NULL CHECK (kind IN ('FACTORY','TEST_CENTRE','CUSTOMER_NETWORK')),
  name     text NOT NULL
);

-- ---------------------------------------------------------------------
-- 2. SCARCE RESOURCES (planner-owned master data)
--    Today this knowledge lives in the per-rig and per-crew trackers.
--    The ledger becomes its system of record.
-- ---------------------------------------------------------------------

CREATE TABLE test_rig (
  rig_id   text PRIMARY KEY,
  site_id  text NOT NULL REFERENCES site,
  name     text NOT NULL
);

CREATE TABLE rig_capability (
  rig_id        text REFERENCES test_rig,
  test_type_id  text REFERENCES test_type,
  PRIMARY KEY (rig_id, test_type_id)
);

CREATE TABLE crew (
  crew_id       text PRIMARY KEY,
  home_site_id  text NOT NULL REFERENCES site
);

-- A crew is qualified for a design over a validity period.
-- UNIQUE (crew_id, design_id, valid_period) exists so assignments can
-- carry the period through a composite FK and check containment row-locally.
CREATE TABLE crew_qualification (
  crew_id       text REFERENCES crew,
  design_id     text REFERENCES design,
  valid_period  tstzrange NOT NULL CHECK (NOT isempty(valid_period)),
  PRIMARY KEY (crew_id, design_id, valid_period),
  EXCLUDE USING gist (crew_id WITH =, design_id WITH =, valid_period WITH &&)
);

-- Night and weekend track-access windows granted by the customer.
-- Rows are immutable in period; revocation flips status (reality event).
CREATE TABLE access_window (
  window_id  text PRIMARY KEY,
  site_id    text NOT NULL REFERENCES site,           -- customer network site
  period     tstzrange NOT NULL CHECK (NOT isempty(period)),
  status     text NOT NULL DEFAULT 'GRANTED' CHECK (status IN ('GRANTED','REVOKED')),
  UNIQUE (window_id, site_id, period)
);

-- Hall parking space, discretised into positions (bays / tracks).
-- Capacity = number of positions. This turns "never over-commit the hall"
-- (a SUM rule) into "one car-body per position per time" (an EXCLUDE rule).
CREATE TABLE hall_position (
  position_id  text PRIMARY KEY,
  site_id      text NOT NULL REFERENCES site,          -- factory
  hall_code    text NOT NULL
);

-- Production batch: mirror of the factory MES. Factories own the internal
-- sequence; the ledger owns the shared space and the interface dates.
CREATE TABLE production_batch (
  batch_id      text PRIMARY KEY,
  design_id     text NOT NULL REFERENCES design,
  n_carbodies   int  NOT NULL CHECK (n_carbodies > 0)
);

-- ---------------------------------------------------------------------
-- 3. CONTRACT TERMS: milestones and penalties (from CRM / contract)
--    Contract dates are inputs. No role except the sync can change them.
-- ---------------------------------------------------------------------

CREATE TABLE milestone (
  milestone_id                 text PRIMARY KEY,
  programme_id                 text NOT NULL REFERENCES programme,
  name                         text NOT NULL,
  contract_date                date NOT NULL,
  penalty_per_day_eur          numeric(12,2) NOT NULL CHECK (penalty_per_day_eur >= 0),
  penalty_cap_eur              numeric(14,2) NOT NULL CHECK (penalty_cap_eur >= 0),
  -- Penalty is waived if this later milestone is still met.
  recoverable_by_milestone_id  text REFERENCES milestone
);

-- Demand on rigs: a homologation campaign for one design and one test type.
-- The composite FK guarantees we only plan tests the design actually needs.
CREATE TABLE homologation_campaign (
  campaign_id          text PRIMARY KEY,
  design_id            text NOT NULL,
  test_type_id         text NOT NULL,
  duration_days        int  NOT NULL CHECK (duration_days > 0),
  drives_milestone_id  text REFERENCES milestone,
  FOREIGN KEY (design_id, test_type_id) REFERENCES design_type_test,
  UNIQUE (campaign_id, test_type_id)
);

-- ---------------------------------------------------------------------
-- 4. REALITY: events and facts the plan must react to
-- ---------------------------------------------------------------------

CREATE TABLE operational_event (
  event_id     bigserial PRIMARY KEY,
  event_type   text NOT NULL CHECK (event_type IN
                 ('RIG_DOWN','BID_AWARDED','MILESTONE_SLIP','WINDOW_REVOKED','CREW_UNAVAILABLE')),
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  source       text NOT NULL,                  -- system or person that reported it
  payload      jsonb NOT NULL
);

CREATE TABLE rig_outage (
  outage_id  bigserial PRIMARY KEY,
  rig_id     text NOT NULL REFERENCES test_rig,
  period     tstzrange NOT NULL CHECK (NOT isempty(period)),
  event_id   bigint REFERENCES operational_event
);

-- ---------------------------------------------------------------------
-- 5. PLANS AND SCENARIOS
--    One structure for the committed plan, what-ifs and agent proposals.
--    BASELINE is the committed plan of record.
-- ---------------------------------------------------------------------

CREATE TABLE plan_head (               -- singleton: current committed version
  singleton  boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  version    int NOT NULL
);

CREATE TABLE scenario (
  scenario_id       text PRIMARY KEY,
  kind              text NOT NULL CHECK (kind IN ('BASELINE','WHAT_IF','AGENT_PROPOSAL')),
  status            text NOT NULL CHECK (status IN
                      ('LIVE','DRAFT','PROPOSED','COMMITTED','REJECTED','STALE')),
  base_version      int,                         -- plan version it was branched from
  trigger_event_id  bigint REFERENCES operational_event,
  created_by        text NOT NULL DEFAULT session_user,
  created_at        timestamptz NOT NULL DEFAULT now(),
  rationale         text,                        -- agent or planner explanation
  CHECK ((kind = 'BASELINE') = (scenario_id = 'BASELINE')),
  CHECK (kind = 'BASELINE' OR base_version IS NOT NULL)
);

CREATE TABLE plan_version (
  version             int PRIMARY KEY,
  committed_at        timestamptz NOT NULL DEFAULT now(),
  committed_by        text NOT NULL,
  source_scenario_id  text REFERENCES scenario,
  penalty_delta_eur   numeric(14,2),
  comment             text
);

-- 5a. Rig bookings ---------------------------------------------------
-- RULE: a rig hosts one campaign at a time   -> EXCLUDE (rig, period)
-- RULE: the rig can run that test type       -> FK rig_capability
-- RULE: the test is one the design needs     -> FK via campaign
-- RULE: each campaign booked once per plan   -> UNIQUE
CREATE TABLE rig_booking (
  scenario_id       text NOT NULL REFERENCES scenario ON DELETE CASCADE,
  booking_key       text NOT NULL,                      -- stable across scenarios
  campaign_id       text NOT NULL,
  test_type_id      text NOT NULL,
  rig_id            text,
  period            tstzrange,                          -- NULL = unscheduled
  last_modified_by  text NOT NULL DEFAULT session_user,
  PRIMARY KEY (scenario_id, booking_key),
  UNIQUE (scenario_id, campaign_id),
  FOREIGN KEY (campaign_id, test_type_id) REFERENCES homologation_campaign (campaign_id, test_type_id),
  FOREIGN KEY (rig_id, test_type_id)      REFERENCES rig_capability (rig_id, test_type_id),
  CHECK ((rig_id IS NULL) = (period IS NULL)),          -- scheduled means rig AND time
  CHECK (period IS NULL OR NOT isempty(period)),
  CONSTRAINT rig_exclusive
    EXCLUDE USING gist (scenario_id WITH =, rig_id WITH =, period WITH &&)
    DEFERRABLE INITIALLY IMMEDIATE                      -- allows swaps inside one commit
);

-- 5b. Crew assignments (commissioning / dynamic testing on customer network)
-- RULE: qualified for the design during the assignment
--        -> composite FK to crew_qualification + CHECK containment
-- RULE: inside a customer access window at that site
--        -> composite FK to access_window + CHECK containment
-- RULE: crew in one place at a time, including travel/mobilisation
--        -> EXCLUDE on [mobilise_from, end)
CREATE TABLE crew_assignment (
  scenario_id          text NOT NULL REFERENCES scenario ON DELETE CASCADE,
  assignment_key       text NOT NULL,
  crew_id              text NOT NULL,
  design_id            text NOT NULL,
  qual_period          tstzrange NOT NULL,
  window_id            text NOT NULL,
  site_id              text NOT NULL,
  window_period        tstzrange NOT NULL,
  period               tstzrange NOT NULL CHECK (NOT isempty(period)),
  mobilise_from        timestamptz NOT NULL,              -- travel starts here
  drives_milestone_id  text REFERENCES milestone,
  last_modified_by     text NOT NULL DEFAULT session_user,
  PRIMARY KEY (scenario_id, assignment_key),
  FOREIGN KEY (crew_id, design_id, qual_period)
    REFERENCES crew_qualification (crew_id, design_id, valid_period),
  FOREIGN KEY (window_id, site_id, window_period)
    REFERENCES access_window (window_id, site_id, period),
  CONSTRAINT crew_qualified_during  CHECK (period <@ qual_period),
  CONSTRAINT inside_access_window   CHECK (period <@ window_period),
  CONSTRAINT mobilise_before_start  CHECK (mobilise_from <= lower(period)),
  CONSTRAINT crew_exclusive
    EXCLUDE USING gist (scenario_id WITH =, crew_id WITH =,
                        tstzrange(mobilise_from, upper(period)) WITH &&)
    DEFERRABLE INITIALLY IMMEDIATE
);

-- 5c. Hall occupancy (half-finished car-bodies parked between steps)
-- RULE: hall space cannot be over-committed -> EXCLUDE (position, period)
CREATE TABLE hall_occupancy (
  scenario_id       text NOT NULL REFERENCES scenario ON DELETE CASCADE,
  occupancy_key     text NOT NULL,
  position_id       text NOT NULL REFERENCES hall_position,
  batch_id          text NOT NULL REFERENCES production_batch,
  period            tstzrange NOT NULL CHECK (NOT isempty(period)),
  last_modified_by  text NOT NULL DEFAULT session_user,
  PRIMARY KEY (scenario_id, occupancy_key),
  CONSTRAINT hall_position_exclusive
    EXCLUDE USING gist (scenario_id WITH =, position_id WITH =, period WITH &&)
    DEFERRABLE INITIALLY IMMEDIATE
);

-- Stamp who touched each row (audit of overrides).
CREATE FUNCTION stamp_modified_by() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.last_modified_by := session_user; RETURN NEW; END $$;
CREATE TRIGGER t_stamp BEFORE INSERT OR UPDATE ON rig_booking     FOR EACH ROW EXECUTE FUNCTION stamp_modified_by();
CREATE TRIGGER t_stamp BEFORE INSERT OR UPDATE ON crew_assignment FOR EACH ROW EXECUTE FUNCTION stamp_modified_by();
CREATE TRIGGER t_stamp BEFORE INSERT OR UPDATE ON hall_occupancy  FOR EACH ROW EXECUTE FUNCTION stamp_modified_by();

-- ---------------------------------------------------------------------
-- 6. APPROVALS AND GUARDRAIL POLICY
-- ---------------------------------------------------------------------

CREATE TABLE scenario_approval (
  scenario_id    text REFERENCES scenario ON DELETE CASCADE,
  approver       text NOT NULL,
  approver_role  text NOT NULL CHECK (approver_role IN ('PLANNER','PROGRAMME_DIRECTOR')),
  decision       text NOT NULL CHECK (decision IN ('APPROVE','REJECT')),
  comment        text,
  decided_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scenario_id, approver)
);

-- ---------------------------------------------------------------------
-- 7. RULE CATALOGUE AND REJECTION LOG
--    Business rules R1-R5 traced to the exact constraint or gate that
--    enforces them. Every refused write is kept: it is audit, agent
--    feedback, and demand data on scarce resources ("RIG-B refused 15
--    times this quarter" is the case for renting capacity).
-- ---------------------------------------------------------------------

CREATE TABLE rule_catalog (
  enforced_by  text PRIMARY KEY,          -- constraint name or gate code
  rule_code    text NOT NULL,             -- R1..R5, GATE, ACCESS
  rule_name    text NOT NULL
);

CREATE TABLE rejection_log (
  rejection_id  bigserial PRIMARY KEY,
  rejected_at   timestamptz NOT NULL DEFAULT now(),
  actor         text NOT NULL,
  scenario_id   text,
  stage         text NOT NULL CHECK (stage IN ('DRAFT','COMMIT')),
  rule_code     text NOT NULL,
  enforced_by   text NOT NULL,
  resource_id   text,                     -- rig, crew, hall position, or scenario
  item_key      text,
  detail        text NOT NULL
);

-- "Ruinous" is a business threshold, owned by the business, versioned as data.
CREATE TABLE guardrail_policy (
  singleton                         boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  max_penalty_delta_eur_unescalated numeric(14,2) NOT NULL,   -- above this: director sign-off
  escalate_if_milestone_newly_late  boolean NOT NULL,
  allow_unscheduled_campaigns       boolean NOT NULL           -- dropping demand off the plan
);

INSERT INTO rule_catalog VALUES
 ('rig_exclusive',                                      'R1', 'One campaign per rig at a time'),
 ('rig_booking_rig_id_test_type_id_fkey',               'R1', 'Rig must be able to run the test'),
 ('rig_booking_scenario_id_campaign_id_key',            'R1', 'Each campaign booked once per plan'),
 ('crew_assignment_crew_id_design_id_qual_period_fkey', 'R2', 'Crew qualified for the vehicle'),
 ('crew_qualified_during',                              'R2', 'Qualification valid on those dates'),
 ('crew_assignment_window_id_site_id_window_period_fkey','R3','Inside a granted customer window'),
 ('inside_access_window',                               'R3', 'Inside a granted customer window'),
 ('crew_exclusive',                                     'R3', 'Crew free, travel included'),
 ('mobilise_before_start',                              'R3', 'Crew free, travel included'),
 ('hall_position_exclusive',                            'R4', 'Hall space never over-committed'),
 ('G5',                                                 'R5', 'Costly plan needs director sign-off'),
 ('G1',                                                 'GATE', 'Only planners commit'),
 ('G2',                                                 'GATE', 'No stale overwrite'),
 ('G3',                                                 'GATE', 'Human approval recorded'),
 ('G4',                                                 'GATE', 'No commit against known outages'),
 ('RLS',                                                'ACCESS', 'Writer may not touch this scenario');
