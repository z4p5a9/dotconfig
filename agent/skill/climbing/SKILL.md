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
- The measures. A measure is a command that prints a number, or a quality judges score on a scale. The default scale is 1 to 4. Each judged measure gets one line describing each level.
- The anchors, if any. An anchor is anything worth comparing against. Judges score it the same way as the thing being climbed, with no assumed score.
- The bar, in the user's terms, such as "every judge gives the top score on every measure", "beat lru-cache on flow", or "p50 under 5ms". When the bar needs many judged scores at the top in the same round, tell the user that judge noise makes this rare.
- The panel. The default is Opus 5.5, GPT 6.1 Sol, and Muse Wonderful at high reasoning, resolved with `orchestrator_capabilities`.
- The budget. The default is 10 rounds.

Done when the user approves. After that, only the user changes any of these. A ruling the user makes during the climb becomes a principle.

Run round after round without waiting for the user. End a turn only to wait for judges, for a decision only the user can make, or at a stop.

## 2. Measure

The first measure runs on the thing as it is, before any change.

Run every command measure every round, and report only numbers you measured. For judged measures, start one new `delegate_task` per judge, all at once, with `role: "review"`, and hold your edits until they return. Judges get the thing, its scope, the principles, the anchors, the measures with their levels, the declined findings with the reason for each, and these instructions: stay read-only, score each one on every measure, and for every score below the top say where the problem is and what would raise it. A declined finding comes back only with a reason its decline didn't consider. The brief changes between rounds only in its declined list. The bar, the round number, and earlier scores stay with you.

A judge that returns nothing gets one fresh retry, then counts as `no score`. A panel member that is unavailable stops the climb, and you report it.

Judges are noisy. On work that didn't change, a fresh judge moves between one in seven and one in four of its scores by a level, up or down. One round never makes a trend. Give every score that moved one label:

- Regression: its finding points at something this round changed. Only a regression means the work got worse.
- Late find: its finding points at something older that the judge noticed only now.
- Fixed: this round fixed the judge's earlier finding.
- Declined: it rose because its finding went on the declined list.
- Noise: no finding explains it.

Show the round as one table, with the panel order on the line above it:

```md
Judges in order: Opus, Sol, Muse.

| Measure | R0 | R1 | R2 |
|---|---|---|---|
| Idiom | `3 1 2` | `3 3 3` | **`4 4 4`** |
| Words per name | `2.97` | `1.26` | `1.20` |
| Anchor noise | | `20%` | `19%` |
```

- One row per judged measure in setup order, then one per command measure.
- One column per round.
- A judged cell is inline code holding each judge's score in panel order, with `-` for `no score`. It is bold when every judge gives the top score.
- An anchor named in the bar gets its own rows, under its name.
- When there are anchors, the last row is anchor noise, the share of anchor scores that moved since the previous round.

Under the table, list every judge score that moved since the previous round, with its label and the finding behind it.

Done when every judge has answered and the table and the list are shown.

## 3. Step

Stop when the bar holds, when three rounds in a row raise no score, or when the budget ends. A budget end is reported as bar not reached.

Otherwise weigh every finding yourself. Apply the ones you agree with, add the rest to the declined list with a reason, and measure again.

## 4. Present

Show the final table, a table of every anchor's scores from the last round, what changed, what you declined, and whether the bar was reached.
