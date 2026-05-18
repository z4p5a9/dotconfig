---
description: Use this skill whenever you need to make actual code changes for a clear bounded task, approved plan phase, or vertical slice. Use the `coder` subagent to edit files, add or update tests, run validation, and report decisions or deviations. If the work can be split into independent non-conflicting slices, spawn multiple `coder` agents in parallel with one clear slice each.
---

Spawn one or more `coder` sub-agents whenever you need actual implementation work.

Use it for:

- implementing a clear bounded task
- implementing an approved plan phase
- implementing one vertical slice of behavior
- fixing validation failures after implementation
- applying approved review feedback
- adding or updating tests for the behavior it changes

Before spawning `coder`, make sure the implementation scope is clear enough that it does not need to guess.

Give it:

- the exact task, phase, or slice to implement
- expected behavior and undesired behavior
- relevant files, references, examples, and plan sections
- approved architecture/design decisions
- validation gates and exact commands when known
- tests to add or update
- out-of-scope work
- decisions that are already approved
- what to report back when it is done

If the work can be split into independent non-conflicting slices, spawn multiple `coder` agents in parallel. Give each one a separate slice with clear boundaries, expected behavior, files or areas to work in when known, and validation gates.

Do not parallelize implementation slices that are likely to edit the same files, depend on each other’s changes, or require shared design decisions that are not already approved. In those cases, run the coders in sequence.

If the task is too large, split it into vertical slices and give `coder` one slice at a time.

If `coder` reports a decision or deviation, read it and decide whether it is acceptable before continuing.
