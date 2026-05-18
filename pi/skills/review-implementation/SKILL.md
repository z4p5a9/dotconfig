---
description: Use this skill whenever code changes have been made and you need to validate whether they correctly implement the task, plan phase, or vertical slice they were supposed to implement. Use the read-only `implementation-reviewer` subagent to run validation gates first, then review completeness, correctness, tests, and consistency with approved scope and existing patterns. It reports only blocking issues.
---

Spawn one or more `implementation-reviewer` sub-agents whenever code changes have been made and you need to check whether they correctly implement the task.

Use it after implementation work to review:

- whether the requested task, plan phase, or vertical slice is complete
- whether the changed behavior is correct
- whether the required tests were added or updated
- whether the relevant validation gates pass
- whether the implementation matches approved scope, decisions, and out-of-scope work
- whether the changes follow existing patterns that matter for the task

Give it:

- the exact task, plan phase, or slice the changes were supposed to implement
- the target changes to review, like a diff, branch, files, or implementation summary
- expected behavior and undesired behavior
- approved architecture/design decisions
- out-of-scope work
- relevant references, examples, and plan sections
- validation commands or project gates when known

Ask it to run validation first. If validation fails, it should stop and report the failed command and relevant output instead of continuing into code review.

Use separate `implementation-reviewer` agents when you need separate review angles for different independent slices, validation areas, or parts of the task.

The goal is not a general code review. The goal is to check whether the completed implementation satisfies the task and to report blocking issues only.
