# Presentation script · 15 minutes

Spoken text is in plain paragraphs. Stage notes are in *italics*. Target pace: about 130 words per minute. Each slide has a time budget; the running total is in brackets.

Keep two things open in other tabs before you start: `01-data-model.md` (rule table) and `sql/test_output.txt`.

---

## Slide 1 · Title (0:30) [0:30]

Thanks for the time. I'll take about fifteen minutes, then I'd like most of the hour for your questions.

One sentence on how I approached it. I spent most of my two hours on one question: how do we make an infeasible plan impossible to save, for a planner and for an agent alike. The deck is the business story. The data model is the substance, and I'll go into it in the middle.

---

## Slide 2 · The problem (1:30) [2:00]

Let me start with how I understand Ferronova's problem, in business terms.

First, margin is fragile. Rolling-stock makers run single-digit margins, and late-delivery penalties are often capped around five to ten percent of contract value. One slipped milestone can wipe out a programme's profit.

Second, risk spreads silently. A handful of test rigs and crews serve twenty to twenty-five programmes. When one rig goes down, the problem lands on other programmes, and nobody sees it until a date is missed.

Third, planning lives in heads. Excel, local factory tools, and a few very experienced planners.

*Point to the quote.*

Put together, nobody can answer this question in less than days: if this bid lands, or this rig goes down, what happens to everything else, and to our margin? That is the question the system has to answer.

---

## Slide 3 · What changes (1:00) [3:00]

Here is the change in one table.

*Read only three rows, not all six.*

Rig and crew bookings move from trackers to one plan of record, where a double booking cannot be saved. "What if this bid lands" goes from days of planner work to a scenario in minutes, with the penalty exposure attached. And when a rig goes down, the agent proposes a re-plan the same day, and the planner decides.

The last row matters most to me: the planners' expertise gets captured as rules and data, and stays under their control.

---

## Slide 4 · Business value (1:30) [4:30]

Where is the money?

The hard number is penalties. On my assumptions, about seven to eight billion euros in flight, six percent margin and penalties around one percent of revenue, avoiding twenty to forty percent of penalties is worth five to ten million a year. That's three to seven percent of operating profit.

For a board, the bigger argument is bid risk. One large bid committed to dates the rigs cannot meet carries tens of millions in tail exposure.

*Point to the bottom box.*

These are my assumptions, not your numbers. The first thing I'd ask finance for is what penalties actually cost in the last three years. If it's a third of what I assumed, the case rests on bid risk and resilience, and I'd say so.

---

## Slide 5 · The order we unlock it (1:30) [6:00]

Order matters more than scope.

Step one, one picture: get the sources in, resolve the IDs, and show leadership where risk is building. Read-only, low risk.

Step two, the plan of record: rig, crew and hall bookings with hard rules enforced, and the trackers retired. This is where most of the risk reduction happens.

Step three, what-if scenarios for bids and disruptions.

Step four, the agent.

*Point to "Where we push back".*

I want to be direct here. The brief asks for an agent on top. If we built it on today's data, it would reason over spreadsheets that disagree with each other. Steps one and two make the agent safe and deliver most of the value on their own. I'd sell the agent as the payoff, not the starting point.

---

## Transition to the data model (0:15) [6:15]

That's the business story. Now the part I think you care most about: how the model makes the rules hold.

*Switch to `01-data-model.md`, or backup slide 12 if screen-sharing is easier.*

---

## Data model · backup slide 12 or 01-data-model.md (3:30) [9:45]

The key decision is two planes.

The lakehouse, Delta in Unity Catalog, holds everything ingested, conformed and historised. That's the portfolio picture.

But the committed plan for scarce resources lives in a small ledger in Lakebase, which is Postgres. The reason is simple. Delta only enforces rules inside a single row: NOT NULL and CHECK. Primary and foreign keys in Delta are informational. "A rig hosts one campaign at a time" is a rule across rows and over time. Delta can't make it impossible. Postgres can.

*Point to the rule table.*

So every hard rule is a database constraint:

- Rig exclusivity is an exclusion constraint on rig and time period. Two overlapping bookings on the same rig cannot both exist.
- Crew qualification and access windows use a composite foreign key that carries the valid period, plus a CHECK that the assignment sits inside it. No triggers, no race conditions.
- Hall space: I split the hall into physical bays. That turns "don't exceed capacity", which is a sum, into "one batch per bay at a time", which the database enforces natively.

Then three design moves I'm happy to defend:

- Every constraint is scoped by scenario. The committed plan, what-ifs and agent proposals share the same tables. So every scenario is feasible by construction, not just the committed one.
- Milestones are deliberately not constraints. Reality can make a milestone late. So milestones are priced per scenario, with penalty rate, cap and the recoverable link, and escalated above a threshold.
- Reality is never blocked. If a rig breaks, we record it. A conflict view shows where the committed plan no longer matches reality, and that view is what triggers the agent.

Finally, one function writes the committed plan. It checks identity, staleness, approval, conflicts with reality and business policy, then applies everything in one transaction.

---

## Proof · test_output.txt (2:00) [11:45]

*Switch to `sql/test_output.txt`. Scroll slowly.*

I didn't want this to stay on a diagram, so I ran it. This is Postgres 16 with a rig-down story.

Rig A goes down for ten weeks. Two campaigns now conflict, and you see them here.

The agent works in its own sandbox. It tries to move a brake test to a rig that can't run brake tests: rejected by the foreign key. It tries to double-book Rig B: rejected by the exclusion constraint. Unqualified crew, outside the customer window, hall bay already taken: all rejected. It tries to write the committed plan directly, change a contract date, or commit its own proposal: no permission.

Then it submits a feasible proposal. It costs 2.95 million, because type approval is 59 days late.

*Slow down here. This is the moment.*

The planner sees that, knows another campaign can move earlier, edits the proposal, and brings it to 1.4 million. The same rules apply to the planner. Their first edit overlaps and gets rejected too. Because it still costs penalties, the commit is blocked until a programme director approves. Then it commits as plan version two.

The agent does the search. The planner adds what only they know. The data model holds both to the same rules.

---

## Slide 6 · How it stays safe (0:45) [12:30]

*Back to the deck, slide 6.*

This is the same story for a business audience. The agent proposes. The data model refuses what's impossible. A person decides. None of the safety depends on the model behaving well. It depends on what the agent's identity is allowed to write.

---

## Agent scope · backup slide 13 (0:45) [13:15]

On scope, the agent does one thing in the first cut: re-sequence homologation campaigns when a rig goes down. Next would be placing a landed bid.

It never touches contract dates, customer windows, qualifications, factory sequencing, the committed plan, or bid pricing.

*Optional, if time allows: 15 seconds on slide 14, the planner mock. "This is where the planner sees the diff, the impact, and approves, edits or rejects."*

---

## Slide 7 · What makes or breaks it (1:00) [14:15]

Three things decide success, and only one is technical.

Planner adoption: they need to see their own rules in the model and keep the final say. One write path: if the trackers stay alive in parallel, the constraints protect a fiction. That's a management decision. And data you can trust: every factory names things differently, so the ID crosswalk needs named owners.

---

## Slide 8 · Open questions, then close (0:45) [15:00]

I've split my open questions between business and technical. The two I'd most like your view on are what penalties actually cost, and which constraint binds hardest today: rigs, crews or hall space.

*Skip slide 9 unless they ask. If asked, use your own real example.*

That's it. I'm happy to go anywhere from here, and I expect you to change an assumption or two.

---

## If you run short of time

Cut in this order: slide 3, the agent scope section, then shorten slide 5 to the push-back. Never cut the data model or the proof.

## If they interrupt early

Good sign. Answer, then say "let me show you where that lives in the model" and jump straight to the data model section. The deck slides can be skipped. The model and the proof cannot.
