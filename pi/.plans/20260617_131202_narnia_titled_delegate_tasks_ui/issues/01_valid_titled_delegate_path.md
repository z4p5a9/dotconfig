---
status: done
goal: .plans/20260617_131202_narnia_titled_delegate_tasks_ui/goal.md
blocked-by: none
---

## What to build

Implement the happy path for titled delegate tasks. A valid `delegate` call should accept task objects with normalized `title` and `content`, spawn children using both fields, preserve the titled task contract through returned details, and build aggregate output using titles as section headings. The basic renderer should show the task count and title rows without content previews.

## Acceptance criteria

- [ ] `delegate` accepts `tasks: Array<{ title: string; content: string }>` for valid task objects.
- [ ] valid titles are trimmed and whitespace-collapsed before storage, prompting, aggregate output, and rendering.
- [ ] valid content is trimmed before storage and child prompting.
- [ ] child process prompts include `Task title: <title>`, a blank line, `Task:`, then the content.
- [ ] returned details use `tasks: Array<{ title; content }>` and each child detail includes `index`, `title`, and `content`.
- [ ] aggregate returned markdown uses `## <title>` headings instead of `## Task N`.
- [ ] duplicate titles are accepted and input order is preserved.
- [ ] pre-execution call rendering shows `delegate X tasks` plus one title row per task, with no content preview.
