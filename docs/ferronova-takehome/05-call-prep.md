# Call prep · 15-minute walkthrough and likely challenges

## 1. The 15-minute walkthrough

| Min | Slide / artefact | Message |
|---|---|---|
| 0–2 | Deck 2–3 | The problem in their words: thin margins, hard penalties, shared scarce resources, plan in heads |
| 2–4 | Deck 4–5 | Value and order. Penalties are the hard number; bid risk is the board case. The agent comes last, on purpose |
| 4–9 | Data model (01) + backup 12 | **The heart.** Two planes. Every hard rule is a constraint scoped by scenario. Show the rule table and one EXCLUDE line |
| 9–11 | Test output | Live proof: agent and planner both refused on infeasible moves; director needed above threshold; stale plan rejected |
| 11–13 | Agent (03) + backup 13–14 | One trigger, one action. Never touches list. Guardrails live in the database, not in the prompt |
| 13–15 | Deck 7–8 | Make or break, open questions. Invite the challenge |

Opening line: "I spent most of my time on one question: how do we make an infeasible plan impossible to save, for a person and for an agent alike."

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

## 3. Questions to ask them back

- Which disruption last year cost the most, and how long did the re-plan take?
- Who in the business owns the threshold for "ruinous"?
- Are the senior planners part of this initiative, or is it being done to them?
