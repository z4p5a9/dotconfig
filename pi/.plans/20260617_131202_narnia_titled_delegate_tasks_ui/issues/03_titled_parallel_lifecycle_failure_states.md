---
status: done
goal: .plans/20260617_131202_narnia_titled_delegate_tasks_ui/goal.md
blocked-by: .plans/20260617_131202_narnia_titled_delegate_tasks_ui/issues/01_valid_titled_delegate_path.md
---

## What to build

Make the titled task contract work through the full parallel delegate lifecycle. Partial updates, completion, failure, aggregate success counts, aggregate exit code, ordering, and capped returned output should all use task titles and preserve the existing parallel behavior.

## Acceptance criteria

- [ ] partial updates are emitted immediately with one running child per titled task.
- [ ] child rows and final aggregate sections remain in input order even when children finish out of order.
- [ ] one child failure does not cancel or skip waiting for sibling children.
- [ ] aggregate `exitCode` is `1` when any child fails.
- [ ] aggregate `exitCode` is `0` when all children succeed.
- [ ] aggregate returned markdown includes `X/Y tasks succeeded`.
- [ ] aggregate returned markdown uses title headings for every child result.
- [ ] aggregate returned markdown keeps the existing 12KB model-visible cap while full per-child output remains in details.
