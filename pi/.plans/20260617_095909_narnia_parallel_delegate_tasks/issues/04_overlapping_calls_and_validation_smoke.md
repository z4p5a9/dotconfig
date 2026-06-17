---
status: done
goal: .plans/20260617_095909_narnia_parallel_delegate_tasks/goal.md
blocked-by: .plans/20260617_095909_narnia_parallel_delegate_tasks/issues/03_all_settled_failure_partial_tracer.md
---

## What to build

Finish the production behavior around concurrent delegate invocations, output limits, expanded rendering, and validation evidence. Multiple delegate tool calls should not be serialized by an extension-level lock, and the final implementation should have smoke evidence for loading and behavior.

## Acceptance criteria

- [ ] Overlapping delegate calls are allowed; the old `delegate already running` behavior is gone.
- [ ] Returned aggregate text still respects the existing 12KB cap.
- [ ] Expanded TUI shows each child's output, tools, files, and commands.
- [ ] Load/type smoke for the extension passes.
- [ ] Behavioral smoke with multiple tasks verifies parallel children, aggregate result, and nested per-child details/TUI state.
