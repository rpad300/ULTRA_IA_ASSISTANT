# Ferronova · Senior FDE take-home (Databricks track)

Turn a messy rail-programme operation into a system you can build: a governed data model at the centre, a Databricks stack around it, and a re-plan agent that can never commit an infeasible or ruinous plan.

## How to read this

| # | Artefact | What it answers |
|---|---|---|
| 1 | [`01-data-model.md`](01-data-model.md) | **Part A, the heart.** Tables, grain, keys, and how every hard rule holds |
| 2 | [`sql/`](sql) | The model as executable SQL, with 15 tests proving the rules hold |
| 3 | [`02-databricks-architecture.md`](02-databricks-architecture.md) | Part B. Source to app on Databricks, governance, scale limits, failure modes |
| 4 | [`03-agent.md`](03-agent.md) | Part C. What the agent proposes, never touches, reads, and where guardrails live |
| 5 | [`04-business-value.md`](04-business-value.md) | Value tree, sizing, unlock order, KPIs, make-or-break, open questions |
| 6 | [`ferronova-pitch.pptx`](ferronova-pitch.pptx) / [`.pdf`](ferronova-pitch.pdf) | Deliverable 2: 9 business slides + 4 backup (architecture, model, agent, planner mock) |
| 7 | [`05-call-prep.md`](05-call-prep.md) | Walkthrough script and answers to likely challenges |

## The idea in five lines

1. **Two planes.** The lakehouse (Delta, Unity Catalog) holds the conformed picture. A small plan-of-record ledger in **Lakebase** (Postgres) holds committed bookings of rigs, crews and hall space.
2. **Rules as constraints.** Rig exclusivity, crew qualification, access windows and hall capacity are `EXCLUDE`, composite `FOREIGN KEY` and `CHECK` constraints. A double-booked rig cannot be saved, by anyone.
3. **Scenarios share the structure.** The committed plan, what-ifs and agent proposals are the same tables keyed by `scenario_id`. Every scenario is feasible by construction.
4. **One commit path.** `commit_scenario()` is the only writer of the plan of record. Six gates: identity, staleness, approval, reality, business policy, atomic apply.
5. **The agent proposes, the model disposes, a person decides.** The agent's identity can write only its own draft.

## Run the proof

```bash
createdb ferronova
psql -d ferronova -v ON_ERROR_STOP=1 \
  -f sql/01_ledger_schema.sql -f sql/02_ledger_logic.sql -f sql/03_seed_and_tests.sql
```

Tested on PostgreSQL 16 (Lakebase is Postgres-compatible). Output: [`sql/test_output.txt`](sql/test_output.txt). `sql/04_lakehouse_uc.sql` shows the Databricks side (pipelines, gold, governance, agent tools) and is illustrative.

## Key assumptions

- The programme register IDs are the canonical keys; every other source maps to them through a crosswalk.
- Hall space is discrete bays; one rig runs one campaign at a time; crew travel is a conservative mobilisation buffer.
- Milestones are soft: priced, not blocked. A late milestone is a business decision, escalated above a threshold.
- Factories keep shop-floor sequencing; the ledger owns shared resources and interface dates.
- Numbers in the value case are order-of-magnitude assumptions to validate with finance in week 1.

## Deliberately not built

Optimiser (black box), full portfolio optimisation, cash and margin forecasting, factory line balancing, bottleneck-line slots (same pattern as hall bays), Monte Carlo over bids. Each is named where it attaches.

## With more time

- Bid-lands scenario end to end (crew placement in access windows).
- Metric views for exposure and utilisation, and a Genie space on gold.
- Clickable planner app on Databricks Apps reading the ledger.
- Evaluation set of past disruptions to score agent proposals against what planners actually did.
