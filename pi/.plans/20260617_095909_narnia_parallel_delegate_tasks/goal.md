Change Narnia `delegate` from one task to uncapped parallel task fan-out.

# Parallel delegate tasks

Run every provided delegate task in parallel and return one aggregate result.

## Entry

Tool call:

```ts
delegate({ tasks: string[] })
```

Narnia root prompt appends:

```txt
Narnia mode is enabled. Root session is a delegate-only orchestrator. Use only delegate for file, shell, web, edit, and test work. Delegate as many independent tasks in parallel as needed. Always look for work that can be parallelized before delegating. Delegate bounded tasks with enough context. Keep root context compact. Do not ask child agents to recursively delegate.
```

## Flow

```flow
-> receive delegate tool call with tasks
  -> trim and validate tasks
    <- reject empty array or blank task
  -> create child detail entries in input order
  -> emit partial result with all children running
  -> spawn one child Pi process per task
  -> collect child events independently
    -> update that child detail/status
    <- emit partial aggregate result
  -> wait until every child exits
  -> build aggregate markdown in input order
<- return aggregate text and details
```

## Behaviors

- when `tasks` is missing, should reject the call.
- when `tasks` is empty, should reject the call.
- when any task trims to blank, should reject the call.
- when called, should spawn all child processes without a concurrency cap.
- when one child fails, should continue waiting for all other children.
- when any child fails, aggregate `exitCode` should be `1`.
- when all children succeed, aggregate `exitCode` should be `0`.
- while children run, should emit partial results with per-child status.
- returned markdown should include `X/Y tasks succeeded` and `## Task N` sections.
- returned markdown should preserve input order, not completion order.
- returned markdown should keep the existing 12KB cap.
- full per-child output should remain in `details.children[]`.
- overlapping delegate tool calls should be allowed.

## Out of scope

- backward compatibility for `delegate({ task })`.
- sequential/single/parallel mode switches.
- configured/default task caps.
- cancelling sibling tasks after one fails.
- edits to existing `.plans/**` documents.
- prompt/agent text edits unless active contract references require it.

## References

- `extensions/narnia.ts` - current Narnia extension, delegate schema, child spawn/event handling, details, TUI renderers.

## Implementation notes

- replace top-level `details.task` with `details.tasks`.
- add `details.children[]`; each child keeps the existing single-child detail shape plus `index`.
- each child uses current child config unchanged: cwd, model, thinking, trust/approval, bootstrap, non-delegate tools, `PI_NARNIA_CHILD=1`.
- root gate stays unchanged: root can only call `delegate`; children cannot call `delegate`.
- TUI should render one parent delegate component with nested child rows:
  - `delegate 1 <preview>`
  - `delegate 2 <preview>`
- child rows should appear immediately as running and update as each child completes.
- expanded TUI should show each child output/tools/files/commands.
- validation:
  - load/type smoke `extensions/narnia.ts`.
  - behavioral smoke with `delegate({ tasks: ["...", "..."] })`.
  - verify parallel children, aggregate result, and nested per-child TUI/details.
