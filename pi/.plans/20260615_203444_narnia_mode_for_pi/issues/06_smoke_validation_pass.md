---
status: done
goal: .plans/20260615_203444_narnia_mode_for_pi/goal.md
blocked-by: .plans/20260615_203444_narnia_mode_for_pi/issues/05_tui_render_status_polish.md
---

## What to build

Run a human validation pass against the local Pi installation to confirm Narnia mode behaves correctly with real extension loading, real model/auth config, real tool registration, and real TUI expansion. Capture any follow-up work as new issues rather than expanding the MVP scope.

This slice validates the completed tracer bullet in the actual environment it is meant to improve.

## Acceptance criteria

- [ ] Extension loads without errors through Pi.
- [ ] `/narnia` reports state and usage.
- [ ] `/narnia on` enables Narnia and only exposes `delegate` to the root agent.
- [ ] A direct non-`delegate` root tool call is blocked with the agreed deterministic error.
- [ ] `delegate` can run a simple child task such as checking the working directory.
- [ ] Child result returns compact text to root and full trace/details in expanded TUI.
- [ ] `/narnia off` enables all configured tools except `delegate`.
- [ ] Reload/resume/tree navigation preserves explicit Narnia branch state.
- [ ] Any discovered local Pi/OAuth/tool incompatibilities are recorded as follow-up issues.
