---
description: Use this when you want to use the `coder` agent to implement a bounded coding task, plan phase, or vertical slice.
---

Spawn the `coder` sub-agent to implement code changes and tests for a bounded task.

Use it for implementation work with a clear boundary. Do not call it with vague instructions like “fix this” or “clean this up”.

Before spawning it, give enough context so it can implement the task without guessing:

- the exact task or phase to implement
- relevant files, references, examples, and plan sections
- approved architecture/design decisions
- expected behavior and out-of-scope behavior

Only describe something as approved if it was explicitly stated by the user or in a plan/document handed to you. Do not infer approval just because the current implementation does it or because it seems reasonable.

Keep each task bounded. If a task is too large, split it into vertical slices and give the `coder` one slice at a time.
