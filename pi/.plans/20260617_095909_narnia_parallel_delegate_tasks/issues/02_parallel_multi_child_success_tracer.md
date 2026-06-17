---
status: done
goal: .plans/20260617_095909_narnia_parallel_delegate_tasks/goal.md
blocked-by: .plans/20260617_095909_narnia_parallel_delegate_tasks/issues/01_array_contract_single_child_tracer.md
---

## What to build

Extend the new contract from one task to multiple successful tasks, preserving the same child behavior for each task while spawning every child immediately and returning one ordered aggregate result.

## Acceptance criteria

- [ ] `delegate({ tasks: ["...", "..."] })` spawns one child process per task without waiting for earlier children to complete.
- [ ] No configured/default concurrency cap is introduced.
- [ ] Aggregate markdown includes `X/Y tasks succeeded` and `## Task N` sections in input order.
- [ ] Returned details include one child entry per input task, with stable indexes matching input order.
- [ ] TUI shows one nested child row per task.
