---
status: done
goal: .plans/20260615_203444_narnia_mode_for_pi/goal.md
blocked-by: .plans/20260615_203444_narnia_mode_for_pi/issues/01_narnia_toggle_root_gate.md
---

## What to build

Make `delegate({ task })` run a bounded task in one isolated child Pi process and return a compact result to the root. This is the first working child roundtrip: spawn child Pi with the agreed flags/env/cwd, stream enough progress for the parent tool lifecycle, enforce one running delegate at a time, and return failure text instead of throwing for child-agent failures.

This slice should prove the Narnia architecture works end-to-end: root can only call `delegate`, and `delegate` can run normal Pi work outside the root context.

## Acceptance criteria

- [ ] Empty/whitespace-only `task` returns a compact error result without spawning a child.
- [ ] A valid task spawns exactly one child Pi process with `--mode json`, `-p`, `--no-session`, cwd `ctx.cwd`, and env `PI_NARNIA_CHILD=1`.
- [ ] Child receives all configured tool names except `delegate` via `--tools`.
- [ ] Child receives inline Narnia bootstrap text via `--append-system-prompt`.
- [ ] Child receives root model/thinking when available.
- [ ] Child receives `--approve` when root project is trusted and `--no-approve` otherwise.
- [ ] Concurrent delegate calls are rejected with a compact error result.
- [ ] Abort signal terminates child with SIGTERM and escalates to SIGKILL after timeout.
- [ ] Child nonzero exit or assistant error/abort returns failure text and details, not an infrastructure throw.
- [ ] Spawn/abort infrastructure failures still throw as tool errors.
