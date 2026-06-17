---
status: done
goal: .plans/20260617_095909_narnia_parallel_delegate_tasks/goal.md
blocked-by: .plans/20260617_095909_narnia_parallel_delegate_tasks/issues/02_parallel_multi_child_success_tracer.md
---

## What to build

Make multi-child delegation all-settled and observable while tasks are running. A failed child should not cancel or hide sibling results; partial updates should keep per-child status visible until all children finish.

## Acceptance criteria

- [ ] If one child fails, remaining children continue and complete normally.
- [ ] Delegate returns only after every child has exited.
- [ ] Aggregate exit code is `1` when any child fails and `0` only when all children succeed.
- [ ] Failed child output is preserved under that task's aggregate markdown section and child details.
- [ ] Partial results expose per-child running/completed/failed status for TUI updates.
