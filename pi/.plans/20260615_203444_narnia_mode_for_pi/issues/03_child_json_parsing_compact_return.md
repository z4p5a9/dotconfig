---
status: done
goal: .plans/20260615_203444_narnia_mode_for_pi/goal.md
blocked-by: .plans/20260615_203444_narnia_mode_for_pi/issues/02_minimal_delegate_child_roundtrip.md
---

## What to build

Turn the child process output into the agreed compact root-visible delegate result. Parse child JSON stdout events, keep the full parsed trace in tool details, extract the final assistant text, enforce the 12KB model-visible cap, and record whether the child followed the required markdown section contract.

This slice makes delegate results root-context-safe while preserving enough trace for auditability.

## Acceptance criteria

- [ ] Child stdout is parsed as JSON lines and stored in `details.stdoutEvents`.
- [ ] Child stderr is captured and stored in `details.stderr`.
- [ ] Final assistant text is extracted from child messages and stored as `details.finalOutput`.
- [ ] Root-visible delegate content is capped to 12KB and stored as `details.returnedOutput`.
- [ ] Full final output remains available in details when capped.
- [ ] Required child markdown sections are checked exactly enough to identify missing sections.
- [ ] Missing sections are stored in `details.contractMissingSections`; no retry/repair is attempted.
- [ ] Details include task, timestamps, duration, and child exit code.
- [ ] Delegate does not return `terminate: true`.
