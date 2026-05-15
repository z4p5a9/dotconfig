---
description: Use this when you want to use the `implementation-reviewer` agent to review completed implementation changes against a given task.
---

Spawn the `implementation-reviewer` sub-agent to check whether completed changes correctly implement the task and report only blocking issues.

Use it after implementation work is done. Do not call it with vague instructions like “review this”.

Before spawning it, give enough context so it can review against the actual task instead of its own preferences:

- the exact task, plan phase, or slice the changes were supposed to implement
- the target changes to review, like a diff, branch, files, or implementation slice
- relevant files, references, examples, and plan sections
- approved architecture/design decisions
- expected behavior and out-of-scope behavior
- validation commands or project gates when known

Only describe something as approved if it was explicitly stated by the user or in a plan/document handed to you. Do not infer approval just because the current implementation does it or because it seems reasonable.

The goal is not a general code review. The goal is to verify task completion and surface blocking issues only.
