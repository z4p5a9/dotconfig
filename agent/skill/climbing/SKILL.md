---
name: climbing
description: Improve anything in rounds, scored by judges or commands, until it reaches a bar you set. T3 Code only.
disable-model-invocation: true
---

# Climbing

A climb improves one thing in rounds until it reaches the bar. It measures where it starts, takes a step, measures again, and repeats.

## 1. Set up

State these back to the user:

- The goal, and what may change to reach it.
- The scope, meaning what judges review and what they leave out, such as "the public surface: exports, names, signatures, types, errors and docs, not the implementation".
- The principles, if any. A principle is a rule from the user that the work follows and judges score against, such as "no `Type` suffix on names".
- The measures. A measure is a command that prints a number, or a quality judges score from 1 to 10 in steps of 0.1. Each judged measure gets one line for each of 1, 4, 7 and 10.
- The bar, in the user's terms, such as "a panel mean of 9 on every measure" or "p50 under 5ms".
- The panel. The default is Opus 5.5, GPT 6.1 Sol, and Muse Wonderful at high reasoning, resolved with `orchestrator_capabilities`. Muse is slow and expensive, so it judges every third round starting at round 0, and any round where the bar holds without it.
- The budget. The default is rounds 0 to 9.

Done when the user approves. After that, only the user changes any of these. A ruling the user makes during the climb becomes a principle.

Run round after round without waiting for the user. End a turn only to wait for judges, for a decision only the user can make, or at a stop.

## 2. Measure

The first measure runs on the thing as it is, before any change.

Run every command measure every round, and report only numbers you measured. For judged measures, start one new `delegate_task` per judge, all at once, with `role: "review"`, and hold your edits until they return. Judges get the thing, its scope, the principles, the measures with their levels, the declined findings with the reason for each, and these instructions: stay read-only, score the thing on every measure, and for every score below the top say where the problem is and what would raise it. A declined finding comes back only with a reason its decline didn't consider. The brief changes between rounds only in its declined list. The bar, the round number, and earlier scores stay with you.

A judge that returns nothing gets one fresh retry, then counts as `no score`. A panel member that is unavailable stops the climb, and you report it.

Judges are noisy, so one score moving means nothing on its own. Read the scores for the trend, and act on the findings.

Show the round as one table, with the panel order on the line above it:

```md
Judges in order: Opus, Sol, Muse.

| Measure | R0 | R1 | R2 |
|---|---|---|---|
| Idiom | `6.5 4.0 5.2` | `7.8 8.1` | **`9.1 9.4 9.0`** |
| Words per name | `2.97` | `1.26` | `1.20` |
```

- One row per judged measure in setup order, then one per command measure.
- One column per round.
- A judged cell is inline code holding each judge's score in panel order, with `-` for `no score`. A judge that sat the round out is left out of the cell. It is bold when it meets the bar.

Done when every judge has answered and the table is shown.

## 3. Step

Stop when the bar holds, when three rounds in a row raise no measure's panel mean above its best earlier round, or when the budget ends. A budget end is reported as bar not reached.

Stop and ask the user for a ruling when the climb circles, meaning a round undoes an earlier round's change or brings back a finding an earlier round fixed. Show the findings that pull against each other.

Otherwise weigh every finding yourself. A finding about something this round changed is a regression, so fix it or undo the change. Judges find something new every round, so the scope holds only because you hold it. Apply a finding when its fix stays inside the scope and what may change, using the smallest fix that answers it. Add the rest to the declined list with a reason, as out of scope even when the judge is right. Show what you apply and what you decline, with the reason for each, then measure again.

## 4. Present

Show the final table, what changed, what you declined, and whether the bar was reached.
