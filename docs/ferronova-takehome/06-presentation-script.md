# Presentation script · 15 minutes

Spoken text is in plain paragraphs. Stage notes are in *italics*. Target pace: about 130 words per minute. Each block has a time budget; the running total is in brackets.

Open in tabs before you start, in this order:

1. `ferronova-pitch.pptx` (or the PDF)
2. `planner-prototype.html` in a browser, on the Portfolio tab
3. `sql/test_output.txt`
4. `01-data-model.md`, scrolled to section 4 (rule table), as backup

---

## Slide 1 · Title (0:30) [0:30]

Thanks for the time. I'll take about fifteen minutes, then I'd like most of the hour for your questions.

The title is the whole design in two lines. Impossible plans can't be saved. Costly plans need a name on them. I spent most of my two hours making the first line true in the database, not on a diagram, and I'll show you it running.

---

## Slide 2 · The problem (1:15) [1:45]

Here's how I understand Ferronova's problem, in business terms.

Margin is fragile. Rolling-stock makers run single-digit margins, and late-delivery penalties are often capped around five to ten percent of contract value. One slipped milestone can wipe out a programme's profit.

Risk spreads silently. A handful of test rigs and crews serve twenty to twenty-five programmes. One rig goes down and the problem lands on other programmes, and nobody sees it until a date is missed.

And planning lives in heads: Excel, local factory tools, a few very experienced planners.

*Point to the quote.*

So nobody can answer this in less than days: if this bid lands, or this rig goes down, what happens to everything else, and to our margin?

---

## Slide 3 · What changes (0:45) [2:30]

*Read three rows only.*

Rig and crew bookings move from trackers to one plan of record, where a double booking cannot be saved. "What if this bid lands" becomes a scenario in minutes, with its price attached. And when a rig goes down, a costed re-plan is waiting the same day, and the planner decides.

---

## Slide 4 · Five rules (2:00) [4:30]

This is the heart of it. Five rules the plan cannot break.

R1, one campaign per rig, and only on a rig that can run the test. R2, only crews qualified for that vehicle, on those dates. R3, crews free, travel included, and inside the customer's window. R4, halls have a fixed number of bays.

Those four block what is physically impossible.

R5 is different on purpose. It doesn't block. It prices. Every plan carries its late milestones, its penalties, and whether they're recoverable. Sometimes slipping a milestone is the right call. It should never happen with the price hidden, and above a threshold it needs a director's name on it.

*Point to the bottom band.*

The important word is "database". Each rule is a constraint in the plan-of-record ledger, which runs on Lakebase, Databricks' managed Postgres. Delta can't do this: it only enforces rules inside a single row, and "one campaign per rig at a time" is a rule across rows and over time. So the plan of record sits in Postgres, and everything else stays in the lakehouse.

And every constraint is scoped by scenario. The committed plan, a what-if and an agent proposal are the same tables. So every one of them is feasible by construction.

---

## Demo · planner-prototype.html (2:30) [7:00]

*Switch to the browser. Portfolio tab.*

Let me show you the story. Rig A goes down for ten weeks. The portfolio flags it, and the agent has already drafted a re-plan.

*Click "Review the agent's proposal".*

The agent moved both campaigns to other capable rigs. Here's the price: type approval fifty-nine days late, 2.95 million.

The planner knows something the agent doesn't: the other campaign on Rig B can start earlier. Watch what happens if they move the wrong one first.

*Change BK-1 start to 1 May. It is refused with R1.*

Refused, R1. Rig B is busy. The rules bind the planner exactly like the agent.

*Change BK-3 start to 1 March, then BK-1 to 1 May.*

Now it fits. The price drops to 1.4 million, twenty-eight days late.

*Click "Approve and commit".*

The gate runs. It stops at G5: that's still a penalty, so a director has to sign.

*Click "Request director sign-off", then "Approve and commit".*

Director signs, plan version two. The agent did the search. The planner added what only they knew. Nobody could save something impossible.

---

## Proof · sql/test_output.txt (1:15) [8:15]

*Switch to the test output. Scroll slowly.*

The prototype is there to tell the story. This is the proof. The same scenario, run against the real schema in Postgres 16. Seventeen tests.

The agent tries a rig that can't run brake tests: R1. Double-books Rig B: R1. An unqualified crew: R2. Outside the window, or no travel time: R3. A hall bay already taken: R4. It tries to write the committed plan, change a contract date, or commit its own proposal: no permission. The planner's commit without a director: R5. A stale plan, or one that books a broken rig: refused by the gate.

None of that depends on the model behaving well. It depends on what each identity is allowed to write.

---

## Slide 6 · Refusals are data (1:00) [9:15]

*Back to the deck.*

One more thing I like here. Every refusal is kept, with the rule that refused it.

That gives you three things for free. Audit: who tried what, and what stopped it. Agent learning: each refusal is feedback, and the history is its evaluation set. And capacity decisions. In the test run, Rig B was refused four times. Over a quarter, that pattern is the business case for renting rig capacity, or the evidence that you don't need to.

---

## Slide 7 · Business value (1:30) [10:45]

Where is the money?

The hard number is penalties. On my assumptions, about seven to eight billion euros in flight, six percent margin and penalties around one percent of revenue, avoiding twenty to forty percent of them is worth five to ten million a year. Three to seven percent of operating profit.

For a board, the bigger argument is bid risk. One large bid committed to dates the rigs can't meet carries tens of millions in tail exposure.

*Point to the bottom box.*

These are my assumptions, not your numbers. The first thing I'd ask finance for is what penalties actually cost in the last three years. If it's a third of what I assumed, the case rests on bid risk and resilience, and I'd tell you that.

---

## Slide 8 · The order (1:15) [12:00]

Order matters more than scope. See: sources in, IDs resolved, one risk picture. Commit safely: the plan of record with R1 to R5, trackers retired. What-if. And only then, the agent.

*Point to "Where we push back".*

I'll be direct. The brief asks for an agent on top. On today's data it would reason over spreadsheets that disagree. Steps one and two deliver most of the risk reduction and make the agent safe. If we stopped after step two, Ferronova would already have one trusted plan.

---

## Slide 9 · What makes or breaks it (1:00) [13:00]

Three things, and only one is technical.

Planners must want to switch. If the app is slower than the lead planner's Excel, it dies. They see their own rules in the model, and they keep the final say.

One write path. If the trackers live on in parallel, the constraints protect a fiction. That's a management decision.

Data you can trust. Every factory names things differently, so the ID crosswalk needs named owners. And penalty terms have to be data, not paragraphs in contract PDFs.

---

## Slide 10 · Open questions, then close (1:00) [14:00]

My questions are split business and technical. The two I'd most like your view on: what penalties actually cost, and which constraint binds hardest today, rigs, crews or hall space. And one technical: are halls really bays, or metres? It changes how R4 is enforced, not whether.

*Skip slide 11 unless asked. If asked, use your own real example.*

That's it. Where would you like to push first? I expect you to change an assumption or two.

*Leave the last minute as buffer for interruptions.* [15:00]

---

## If you run short of time

Cut in this order: slide 3, slide 6, then shorten slide 8 to the push-back. Never cut slide 4, the demo, or the proof.

## If the demo fails

Go straight to `sql/test_output.txt`. It tells the same story, and it is the stronger evidence anyway.

## If they interrupt early

Good sign. Answer, then "let me show you where that lives" and jump to slide 4 or backup slide 14 (rule to constraint mapping).
