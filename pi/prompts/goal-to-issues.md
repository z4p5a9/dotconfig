---
description: Break a goal into independently-grabbable issues
---

Break a goal into independently-grabbable issues using vertical slices (tracer bullets).

# Process

## 1. Target goal.md

Identify the target `goal.md`, the path pattern is `.plans/<YYYYMMDD_HHMMSS>_<plan_name>/goal.md`, from the conversation context. If is not specified, ask the user to provide one.

## 2. Gather context

Work from whatever is already in the conversation context. If needed explore the codebase to understand the current state of the code

## 3. Draft vertical slices

Break the goal into tracer bullet issues. Each issue is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

A slice can cut through multiple sections of the goal, implementing part of them, that later slices build on top of until all sections are completely implemented.

Slices may be 'HITL' or 'AFK'. HITL slices require human interaction, such as an architectural decision or a design review. AFK slices can be implemented and merged without human interaction. Prefer AFK over HITL where possible.

- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests) - A completed slice is demoable or verifiable on its own - Prefer many thin slices over few thick ones

## 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice, show:

Title: short descriptive name
Type: HITL / AFK
Blocked by: which other slices (if any) must complete first
Functionalities/Behaviors covered: which functionalities and which of their behaviors this addresses

Ask the user:

Does the granularity feel right? (too coarse / too fine)
Are the dependency relationships correct?
Should any slices be merged or split further?
Are the correct slices marked as HITL and AFK?
Iterate until the user approves the breakdown.

## 5. Publish the issues to the issue tracker

- Write each slice down as an issue document at `.plans/<YYYYMMDD_HHMMSS>_<plan_name_snake_case>/issues/<issue_number>_<issue_name_slug>.md`.
- Write the issues in dependency order (blockers first) so you can reference real issue identifiers in the "blocked-by" frontmatter field.
- Issues are always in the context and in reference of the goal.md, not as stand alone pieces

Use the following issue template:

```markdown
---
status: ready-for-agent | ready-for-human
goal: .plans/<YYYYMMDD_HHMMSS>_<plan_name_snake_case>/goal.md
blocked-by: reference to the blocking issues, if any, otherwise none
---

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation.

Avoid specific file paths or code snippets — they go stale fast. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it here and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits. This should be in context of, and in reference of, the goal.md

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
```
