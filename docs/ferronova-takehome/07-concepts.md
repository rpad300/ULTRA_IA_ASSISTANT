# Concepts cheat sheet

One line per term, in the words you would use on the call. Grouped so you can scan it in the five minutes before you start.

## The business domain

| Term | What it means here |
|---|---|
| Programme | One customer order for custom rail vehicles, run for 2 to 4 years from contract to handover |
| Bid | A tender not yet won. Modelled as a programme with status `BID` so "what if it lands" uses the same tables |
| Homologation | Type-testing a new design must pass before carrying passengers. Certifies the design, not each unit |
| Test rig | Scarce test installation or track. Hosts one campaign at a time, often for months |
| Campaign | The block of type-tests one design needs on a rig. The demand side of rig booking |
| Test crew | Small team certified per vehicle design, with expiry dates. Moving between sites costs time |
| Access window | Night or weekend slot when the customer allows testing on its live network |
| Hall bay | Physical parking position for half-finished car-bodies between production steps |
| Milestone and penalty | Contract date with money attached: rate per day, a cap, sometimes waived if a later milestone is met |
| Recoverable penalty | A penalty that falls away if a later milestone is still met. A bet, so we show it gross and net |
| MES | Each factory's shop-floor scheduling tool. We read it; we never command it |
| PLM / CRM / ERP | Design and required tests / bids and contract terms / cost, revenue, margin |
| Programme register | Ferronova's shared IDs. The backbone every source is mapped to |

## Data architecture

| Term | What it means here |
|---|---|
| Lakehouse | Open storage plus warehouse guarantees on one platform. Holds the conformed picture |
| Bronze / silver / gold | Raw as received / cleaned and mapped to register IDs / read models for app, dashboards and agent |
| ID crosswalk (`xref_id`) | One row per source key mapped to a register ID. Unresolved keys go to a steward, never dropped |
| Quarantine | Where rows that fail quality checks wait, with a count per source. The count is a health metric |
| Expectations / DQX | Declarative data-quality rules in the pipeline. They decide whether data is trustworthy |
| Config as data | Each source is one governed config row (path, keys, mappings, rules). A new factory is config, not code |
| CDC | Read only what changed at the source since last time |
| SCD2 | Keep history of a changing record (for example contract terms) with valid-from and valid-to |
| Grain | What one row means. `rig_booking`: one campaign on one rig in one scenario |
| Business key vs surrogate | The real-world identity that defines the grain vs a technical ID. Rules check business keys |
| Half-open interval `[start, end)` | Time as a range that includes the start, excludes the end. Overlap is one operator, `&&` |

## Our model

| Term | What it means here |
|---|---|
| Two planes | Lakehouse for the picture; a small Lakebase ledger for the committed plan of scarce resources |
| Plan of record / ledger | The only place a committed booking exists. Today it lives in trackers and heads |
| Why not Delta for it | Delta enforces row-level rules only (`NOT NULL`, `CHECK`); keys are informational. Cross-row rules need Postgres |
| EXCLUDE constraint | Postgres rule: no two rows may overlap on the given columns. Makes a double-booked rig unsaveable |
| Composite FK + CHECK | The assignment carries the qualification or window period via a foreign key, then a row-level check proves containment |
| Bays, not a sum | Hall capacity modelled as positions, so "never over-commit" becomes exclusivity. If it is metres, the gate checks a sum |
| R1 to R5 | R1 rig, R2 qualified crew, R3 crew free and in window, R4 hall, R5 price. R1 to R4 block, R5 prices and escalates |
| Scenario | A full branch of the committed plan. `BASELINE` is the committed one. Every scenario obeys the same constraints |
| `booking_key` | Stable ID of a booking across scenarios, so the app can show "moved from RIG-A to RIG-B" |
| Plan version | Each commit increments it. A scenario remembers the version it came from |
| Commit gate G1 to G6 | Planner only, not stale, approval recorded, no conflict with reality, cost within authority, applied in one transaction |
| Reality vs plan | Outages and revoked windows are recorded, never blocked. `v_plan_conflicts` shows where the plan no longer fits reality |
| Rejection log | Every refused write, with actor and rule. Audit, agent feedback, and demand data per resource |
| Rejection pressure | Refusals grouped by resource. Sustained pressure on one rig is the case for renting capacity |
| Guardrail policy | The business's definition of "ruinous", stored as data and changed without a deploy |

## The agent

| Term | What it means here |
|---|---|
| Black box | The optimiser or model. Context in, structured proposal out. We design everything around it |
| Trigger | The agent wakes when `v_plan_conflicts` is not empty (rig down, window revoked) or an event lands |
| Tools | Its whole action list: branch, move a booking, place a crew, submit. Each returns OK or the refusing rule |
| Service principal | The agent's own identity. Can write only its own draft scenario. Cannot commit |
| Human in the loop | A planner approves, edits or rejects every proposal. Directors sign costly ones |
| MLflow traces and evals | Every proposal traced end to end; quality measured against approved, edited and rejected history |
| Auto-commit, later | Only for zero-cost moves, and only once acceptance data justifies it. The gates stay either way |

## Databricks products, and why each

| Product | Role | Why |
|---|---|---|
| Unity Catalog | Governance, grants, row filters, column masks, lineage | One identity and permission model across data, functions and agents |
| Lakeflow Connect | Managed ingestion with CDC from databases | No hand-written extract code to own |
| Auto Loader | Incremental file ingestion | Built for MES exports and planner workbooks |
| Lakeflow Declarative Pipelines | Bronze to silver to gold with expectations | Quality visible by default |
| Lakeflow Jobs | Orchestration, event-triggered | Re-plan runs when reality changes, not on a timer |
| Lakebase | Managed Postgres inside the platform | Transactions and cross-row constraints for the plan of record |
| Synced tables | Silver reference into Lakebase, read-only | One source of truth for reference data |
| Databricks Apps | Hosts the planner workbench | Same identity; commits run as the planner |
| AI/BI dashboards, Genie | Leadership picture and natural-language questions | No second BI stack |
| Mosaic AI Agent Framework, Model Serving | Agent runtime and model endpoint | Tools as governed UC functions; swap models without touching the agent |
| MLflow | Traces and evaluation | "How do you know the agent is any good?" |
