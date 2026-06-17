---
status: done
goal: .plans/20260617_131202_narnia_titled_delegate_tasks_ui/goal.md
blocked-by: .plans/20260617_131202_narnia_titled_delegate_tasks_ui/issues/01_valid_titled_delegate_path.md
---

## What to build

Complete the rejection behavior for malformed titled delegate task input. Invalid calls should fail before child process creation, return compact rejection details, and use the exact user-facing messages agreed in the goal.

## Acceptance criteria

- [ ] missing `tasks` is rejected.
- [ ] non-array `tasks` is rejected.
- [ ] empty `tasks` is rejected.
- [ ] string-array task input is rejected; no backward compatibility path remains.
- [ ] non-object task item is rejected with `Delegate task N must be an object with title and content.`
- [ ] blank title, whitespace-only title, or title longer than four words after whitespace collapse is rejected with `Delegate task N title must be 1-4 words.`
- [ ] blank or whitespace-only content is rejected with `Delegate task N content is empty.`
- [ ] rejected calls do not spawn child processes and return details consistent with the new titled task contract.
