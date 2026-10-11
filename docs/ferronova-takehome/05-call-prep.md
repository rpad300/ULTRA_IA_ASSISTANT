# Call prep · 15-minute walkthrough and likely challenges

## 1. The 15-minute walkthrough

| Min | Slide / artefact | Message |
|---|---|---|
| 0–2.5 | Deck 1–3 | The problem in their words: thin margins, hard penalties, shared scarce resources, plan in heads |
| 2.5–4.5 | Deck 4 | **The heart.** Five rules. R1–R4 block, R5 prices. Each is a database constraint, scoped by scenario |
| 4.5–7 | `planner-prototype.html` | Live story: agent EUR 2.95M, planner refused on R1, planner gets to EUR 1.4M, G5 needs a director, plan v2 |
| 7–8.5 | `sql/test_output.txt` | The proof: same story on the real schema, 17 tests |
| 8.5–9.5 | Deck 6 | Refusals are data: audit, agent learning, capacity decisions |
| 9.5–12 | Deck 7–8 | Value and order. The agent comes last, on purpose |
| 12–15 | Deck 9–10 | Make or break, open questions. Invite the challenge |

Full word-for-word version: [`06-presentation-script.md`](06-presentation-script.md). Terms: [`07-concepts.md`](07-concepts.md).

Opening line: "Impossible plans can't be saved. Costly plans need a name on them. I spent my two hours making the first line true in the database, and I'll show it running."

## 2. Likely challenges and how to answer

**"Why not do it all in Delta? Databricks is a lakehouse."**
Delta enforces row-local rules only (`NOT NULL`, `CHECK`). Primary and foreign keys are informational. "One campaign per rig at a time" is a cross-row rule over time. Optimistic concurrency on Delta stops conflicting file writes, not overlapping intervals. I would need a serialised writer plus app code, which is a convention, not a guarantee. Lakebase gives me the guarantee natively, and it is still inside the Databricks platform and Unity Catalog.

**"Why not everything in Postgres then?"**
The ledger holds only what needs transactions: a few thousand rows. Ingestion from ten messy sources, history, conformance, the portfolio picture, Genie and the agent's context belong in the lakehouse. Each plane does what it is good at.

**"The client has no Lakebase / can't use it."**
Fallback: serialise all commits through one function with a lock on the plan head, and check overlaps explicitly inside it before writing. Same guarantee for the committed plan, weaker feedback during drafting. I would state the trade-off rather than pretend Delta constraints cover it.

**"Hall space is in metres, not bays."** (assumption change)
Then the rule is a sum, not an exclusivity. Keep it in the commit plane: inside `commit_scenario`, take a lock per hall and check that peak occupied length per day stays under capacity. Same gate, different check. The model shape does not change.

**"A rig can actually host two light campaigns."** (assumption change)
Model rig lanes as positions, exactly like hall bays: `rig_lane`, EXCLUDE on (lane, period). Capacity 2 means two lanes.

**"A bid at 30% probability: does it reserve a rig?"**
Not in the committed plan. Bids live in what-if scenarios. Business sets a threshold (for example 70% or a signed LOI) above which a bid gets soft holds that planners see. That threshold is an open question for them.

**"Penalties are recoverable if a later milestone is met. Where is that?"**
`milestone.recoverable_by_milestone_id`. Exposure is shown gross and net: net excludes it when the recovery milestone is forecast on time. The planner sees both, because "recoverable" is a bet.

**"Why not let the agent auto-commit trivial moves?"**
Later, with evidence. First cut: human commits everything. Once acceptance data shows proposals with zero penalty delta and no milestone change are approved as-is, auto-commit that class only. The gates stay in place either way.

**"How do you get the knowledge out of planners' heads?"**
Workshops on real past disruptions: "what did you do when rig X broke last year, and why?" Every "we never do that" becomes a constraint or a policy row. Then show them the system refusing a move they would also refuse. That is the moment trust starts.

**"Factories won't accept a central plan."**
They should not have to. The ledger owns shared scarce resources and interface dates between factories. Shop-floor sequencing stays in each MES. Factories see their own data (row filters) and propose interface changes.

**"What breaks at 100 programmes?"**
Scenario fan-out (move heavy what-if exploration to Spark, promote only candidates to the ledger), the single commit lock (partition per resource pool), and false precision in the five-year horizon (soft holds instead of exact dates far out).

**"What do you build in the first two weeks?"**
Ingest the planner workbook and the register, build the ID crosswalk, load rigs and crews into the ledger, show the current rig plan with its conflicts. If the first demo finds a double booking that exists today, the business case writes itself.

**"Where did AI help, where did you override it?"**
Have your own example ready. Honest and specific beats impressive.

**"Why not just validate in one commit service with a serialised queue?"**
That works, and it is my fallback. The difference is where the guarantee lives. In a service, the rule holds as long as that code is right and nothing else writes. In the schema, it holds for every writer, including a future one nobody planned for. I keep the gate for what only a gate can do (staleness, approvals, cost), and put the physical rules in constraints.

**"Why don't committed decisions flow back through bronze and silver like every other source?"**
Because the ledger is the system of record for decisions; it is not a source we copy. Its change feed lands in Delta for history and analytics. Sending a decision through four ingestion layers adds latency and blurs "what sources told us" with "what we decided".

**"Isn't a rejection just noise? Why keep it?"**
It is the cheapest demand signal Ferronova will ever get. A rig refused fifteen times a quarter is the case for renting capacity. It is also the agent's evaluation set, and the audit trail.

**"Where does data quality sit versus the commit rules?"**
Two questions, two places. "Is this data trustworthy?" lives in the pipelines (expectations, crosswalk, quarantine). "Is this plan committable?" lives only at commit. A pipeline check can report a double booking tomorrow; it cannot refuse it now.

**"How do you onboard factory five?"**
Config as data: one governed config row per source (connection, keys, mappings, quality rules), reviewed in Git, read at runtime. A new factory is a config entry plus crosswalk work, not a new pipeline.

## 3. Questions to ask them back

- Which disruption last year cost the most, and how long did the re-plan take?
- Who in the business owns the threshold for "ruinous"?
- Are the senior planners part of this initiative, or is it being done to them?
