---
status: done
goal: .plans/20260615_203444_narnia_mode_for_pi/goal.md
blocked-by: none
---

## What to build

Implement the first vertical slice of Narnia mode: a local `/narnia` command that can turn root-session orchestration on/off, restore branch-local Narnia state, expose the `delegate` tool only when Narnia has been activated, and deterministically block all non-`delegate` tool calls while enabled.

This slice should make the mode observable and enforceable end-to-end, even before `delegate` can run useful child work.

## Acceptance criteria

- [ ] With no saved Narnia state, loading the extension does not change the current active tools.
- [ ] `/narnia` with no args reports current Narnia state and basic usage.
- [ ] `/narnia on` persists enabled state and makes only `delegate` active.
- [ ] `/narnia off` persists disabled state and enables all configured tools except `delegate`.
- [ ] When enabled, any root tool call except `delegate` is blocked with the agreed deterministic error.
- [ ] When enabled, a root `delegate` tool call is allowed through the gate.
- [ ] Latest branch-local Narnia state is restored on session start and tree navigation.
- [ ] Footer status reflects `Narnia: on` / `Narnia: off` and includes compact context usage when available.
- [ ] When `PI_NARNIA_CHILD=1`, the extension registers no command, no delegate tool, and no gates.
