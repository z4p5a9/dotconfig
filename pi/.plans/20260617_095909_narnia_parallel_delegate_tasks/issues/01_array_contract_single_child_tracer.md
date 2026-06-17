---
status: done
goal: .plans/20260617_095909_narnia_parallel_delegate_tasks/goal.md
blocked-by: none
---

## What to build

Update Narnia delegate to accept only the new `tasks` array contract while preserving a complete one-task path end to end. A single-item `tasks` call should validate input, run one child through the existing child execution path, return aggregate details shaped for the new parallel model, render one nested child row, and include the updated root prompt guidance from the goal.

## Acceptance criteria

- [ ] `delegate({ tasks: ["..."] })` runs one child successfully through the new contract.
- [ ] `delegate({ task: "..." })`, missing `tasks`, empty `tasks`, and blank task strings are rejected.
- [ ] Returned details use `tasks` and `children[0]` rather than top-level `task`.
- [ ] TUI renders the parent delegate component with one nested child row.
- [ ] Narnia root prompt includes the agreed parallel delegation guidance.
