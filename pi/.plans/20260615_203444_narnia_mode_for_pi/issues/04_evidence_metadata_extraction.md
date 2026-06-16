---
status: done
goal: .plans/20260615_203444_narnia_mode_for_pi/goal.md
blocked-by: .plans/20260615_203444_narnia_mode_for_pi/issues/03_child_json_parsing_compact_return.md
---

## What to build

Extract evidence metadata from child JSON events independently of the child’s prose. The delegate details should show what tools were used, what files were read or modified, what commands ran, likely tests, best-effort command exit codes, and model/usage/stop information.

This slice makes child summaries auditable without sending raw traces into the root model context.

## Acceptance criteria

- [ ] `details.metadata.tools` records every child tool call name and args from child events.
- [ ] `details.metadata.filesRead` records paths read through the `read` tool.
- [ ] `details.metadata.filesModified` records paths modified through `edit` and `write` tools.
- [ ] `details.metadata.commands` records bash commands.
- [ ] Bash command exit codes are extracted best-effort from child tool execution/result data when available.
- [ ] Commands matching common test command patterns are marked `isTest: true`.
- [ ] Assistant usage is summed across child assistant messages.
- [ ] Metadata records provider, model, stop reason, and error message when present.
- [ ] Metadata arrays are de-duplicated where appropriate without hiding the full tool timeline.
