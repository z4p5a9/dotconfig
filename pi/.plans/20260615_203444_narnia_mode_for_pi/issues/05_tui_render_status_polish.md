---
status: done
goal: .plans/20260615_203444_narnia_mode_for_pi/goal.md
blocked-by: .plans/20260615_203444_narnia_mode_for_pi/issues/04_evidence_metadata_extraction.md
---

## What to build

Polish delegate’s TUI behavior so Narnia mode is usable during real sessions. The delegate tool should render compactly by default, expose a useful expanded audit view, and keep the footer accurate while a child is running.

This slice turns the functional delegate into an inspectable workflow without dumping raw child noise into the root view.

## Acceptance criteria

- [ ] Delegate call rendering shows the delegate label and a bounded task preview.
- [ ] While a child is running, footer status shows `Narnia: child running`.
- [ ] Collapsed result shows success/failure state, task preview, final `## Result` excerpt, usage summary, read/changed file counts, and command count.
- [ ] Expanded result shows the full delegated task.
- [ ] Expanded result shows full final child output.
- [ ] Expanded result shows a readable tool-call timeline.
- [ ] Expanded result shows extracted metadata and stderr when present.
- [ ] Expanded result does not render every raw JSON event line by default.
- [ ] Renderers handle missing/partial details without throwing.
