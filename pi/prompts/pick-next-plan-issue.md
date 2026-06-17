---
description: Pick and tackle the next available issue of target plan
---

# Pick issue

Find the next not blocked issue with `status: ready-for-agent` or `status: ready-for-human` of plan `$1`.
An issue is not blocked if frontmatter is `blocked-by: none`, or if all the referenced issue of `blocked-by` are have `status: done`

If all issue are done, say so, and stop.

If the issue has status `ready-for-human`, present to the user what they need to do step by step and assist them in order to achieve that.

If the issue has status `ready-for-agent`, follow the process below:

## 1. Gather context

- Start by understanding the overall goal that this plan wants to achieve and then locate the surface of this gaol that this issue tackles. The implementation of the issue is going to be guided by the overall goal and the decisions it specs.
- Explore the appropriate references indicated by the `goal.md` that relate to this issue.
- If needed, explore for more existing patterns in order to make sure that your implementation will be consistent with the rest of the code base.

## 2. Implement

You should delegate a task to implement the picked issue.

The task should include all the required context such as:

- the goal.md
- the picked issue
- progress of the gaol so far - done issues and their logs

The task should instruct the delegated child to:

- Implement only the picked issue
- Implement the issue completely
- Explore the appropriate references indicated by the `goal.md` that relate to this issue.
- If needed, explore for more existing patterns in order to make sure that your implementation will be consistent with the rest of the code base.
- Make sure to always run the validation gates as defined by the project in order to ensure that you are not introducing any other issues as you implement.
- If there are other issues that prevent green validation gates, make sure to also tackle that in order to leave the validation gate green when you are done with your implementation.

You can use the following format to structure the task:

```
<goal path=".plans/goal-id/goal.md>
// the contents of goal.md
</goal>

<issue path=".plans/goal-id/issues/issue-id.md>
// the contents of the picked issue
</issue>

<progress>
// a summary of the tasks already done, and their logs
</progress>

// instructions
```

## 3. Close issue

Update the `status` of the issue to `status: done`

## 4. Log

Add an implementation log at `.plans/<plan_id>/log/<YYYYMMDD_HHMMSS>.md`, based on the following format:

```markdown
---
timestamp: <epoch_ms>
issue: <issue_id>
---

# Summary

<One sentence: what changed, outcome-focused, past tense.>

# Input

<Condensed statement of the user/task request that drove the run.>

# Files

- `<path>` [created|modified|deleted|renamed] - <specific change made>
- `<path>:<lines>` [modified] - <specific change made>

# Gaps

- <Requirement/spec ambiguity and the decision made.>
- None.

# Out of scope

- <Code/content changed despite not being part of the direct request.>
- None.

# Preexisting working tree items

- `<path>`
- None; `git status --short` was clean before changes.
```

- Keep the log factual, concise, and implementation-focused.
- Record the result, not the process.
- Do not record validation commands or results.
- Do not fabricate missing data; use only observed input, files, gaps, and preexisting working tree state.
- `Summary` is one sentence describing the completed outcome.
- `Input` is the request/spec intent, condensed. Do not paste the whole conversation. Otherwise record user's request/task and decision, so future readers can understand why implementation was changed or drifted based on the user's decisions.
- `Files` is exhaustive for files changed by the run. Each bullet names the file, status, and concrete change.
- Line ranges in `Files` are optional. Use them only when they clarify the touched area.
- `Gaps` records underspecified requirements and the decision made to proceed. Use `None.` when there were no gaps.
- `Out of scope` records authored changes outside the direct request. Use `None.` when there were none.
- `Preexisting working tree items` records dirty files present before the run, to distinguish user-owned changes from agent changes.

## 5. Summary

Show a summary of what happened to the user.
