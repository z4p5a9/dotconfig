---
status: done
goal: .plans/20260617_131202_narnia_titled_delegate_tasks_ui/goal.md
blocked-by: .plans/20260617_131202_narnia_titled_delegate_tasks_ui/issues/01_valid_titled_delegate_path.md, .plans/20260617_131202_narnia_titled_delegate_tasks_ui/issues/03_titled_parallel_lifecycle_failure_states.md
---

## What to build

Finish the delegate renderer so titled tasks have the agreed compact collapsed layout and the expanded view exposes full content plus the existing audit details. This is the final UI pass over the titled delegate behavior.

## Acceptance criteria

- [ ] collapsed result starts with `delegate X tasks`.
- [ ] each collapsed child row uses emoji status and title: `<emoji> <title> | <read count> read · <changed count> changed · <cmd count> cmds`.
- [ ] collapsed metrics include only read, changed, and cmds.
- [ ] collapsed metric labels are always `read`, `changed`, and `cmds`, without singularization.
- [ ] collapsed child rows do not include task content previews or status words.
- [ ] result excerpts render indented under their task row.
- [ ] expanded view includes `─── Tasks ───` and lists titled child rows.
- [ ] expanded per-task sections use `─── <title> ───`, show full content, then show final output, tool timeline, files, commands, metadata, and stderr as applicable.
