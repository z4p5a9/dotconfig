Refactor Narnia delegate input and TUI rendering around titled task objects.

# Titled delegate tasks

Change `delegate` tasks from strings to titled task objects.

## Required dependencies

Delegate task contract:

```ts
// File: extensions/narnia.ts
type DelegateTask = {
  title: string
  content: string
}
```

Delegate tool result details contract:

```ts
// File: extensions/narnia.ts
type DelegateChildDetails = {
  index: number
  title: string
  content: string
  ...
}

type DelegateDetails = {
  tasks: DelegateTask[]
  children: DelegateChildDetails[]
  ...
}
```

No new packages.

## Entry

Tool call:

```ts
// File: extensions/narnia.ts
delegate({
  tasks: Array<{
    title: string
    content: string
  }>
})
```

## Flow

```flow
-> receive delegate tool call
-> validate `tasks`
  -> if missing
    <- reject
  -> if not array
    <- reject
  -> if empty
    <- reject
  -> for each task item
    -> if not object
      <- reject `Delegate task N must be an object with title and content.`
    -> trim title and collapse whitespace
    -> if title is not 1-4 words
      <- reject `Delegate task N title must be 1-4 words.`
    -> trim content
    -> if content is empty
      <- reject `Delegate task N content is empty.`
-> create child details in input order with `index`, `title`, `content`
-> emit partial result with all children running
-> spawn one child Pi process per task
  -> prompt:
    -> `Task title: <title>`
    -> blank line
    -> `Task:`
    -> `<content>`
-> collect child events independently
  -> update matching child details/status
  <- emit partial aggregate result
-> wait until every child exits
-> build aggregate markdown in input order using task titles as headings
<- return aggregate text and details
```

## Behaviors

- when `tasks` is missing, should reject the call.
- when `tasks` is not an array, should reject the call.
- when `tasks` is empty, should reject the call.
- when a task item is not an object, should reject with `Delegate task N must be an object with title and content.`
- when a title is blank or more than 4 words after trimming/collapsing whitespace, should reject with `Delegate task N title must be 1-4 words.`
- when content is blank after trimming, should reject with `Delegate task N content is empty.`
- when titles are duplicated, should allow them and preserve input order.
- when called with valid tasks, should spawn all children without a concurrency cap.
- when one child fails, should continue waiting for all other children.
- when any child fails, aggregate `exitCode` should be `1`.
- when all children succeed, aggregate `exitCode` should be `0`.
- returned markdown should include `X/Y tasks succeeded`.
- returned markdown should use `## <title>` sections, not `## Task N`.
- returned markdown should preserve input order, not completion order.
- returned markdown should keep the existing 12KB cap.
- full per-child output should remain in `details.children[]`.
- no backward compatibility is required for old `tasks: string[]` input or old details.

## Out of scope

- unique-title enforcement
- auto-generating titles from content
- truncating or rewriting invalid titles
- changing child final-output markdown contract
- adding packages
- screenshot-driven pixel-perfect layout beyond the agreed text shape

## References

- `extensions/narnia.ts` - update delegate schema, validation, child detail construction, child prompt, aggregate output, details cloning, renderers.
- Pi `docs/extensions.md` - use `registerTool`, strict TypeBox parameters, `renderCall`, `renderResult`, `onUpdate`.
- Pi `docs/tui.md` - use `Text`, `Container`, `Spacer`, `Markdown`; keep render lines compact.

## Implementation notes

- Use one contract everywhere: `{ title, content }`.
- Store normalized title/content in details and child prompts.
- Update public prompt/error text from `tasks: string[]` to `{ title, content }[]`.

# Delegate TUI rendering

Render delegate calls/results as compact titled rows with metric separators.

## Entry

```ts
// File: extensions/narnia.ts
renderCall(...)
renderResult(...)
```

## Flow

```flow
-> render call before execution
  -> show `delegate X tasks`
  -> for each task
    -> show `  <title>`

-> render collapsed result
  -> show `delegate X tasks`
  -> for each child in input order
    -> choose emoji:
      -> running `⏳`
      -> failed `✗`
      -> completed `✓`
    -> render row:
      -> `<emoji> <title> | <read count> read · <changed count> changed · <cmd count> cmds`
    -> render result excerpt indented on next line

-> render expanded result
  -> show aggregate status
  -> section `─── Tasks ───`
  -> list child rows
  -> for each child
    -> separator `─── <title> ───`
    -> show full content
    -> show full final output
    -> show tool timeline, files, commands, metadata, stderr as current renderer does
```

## Behaviors

- collapsed rendering should not show task content preview.
- collapsed rendering should show title only.
- collapsed row metrics should only include read, changed, cmds.
- collapsed row metrics should use separators exactly like `|` and `·`.
- collapsed row labels should always be `read`, `changed`, `cmds`, without singularization.
- pre-execution call rendering should show only `delegate X tasks` and titled task rows.
- expanded rendering should show full content and audit detail.
- status should be communicated by emoji in child rows; no per-child status word required in collapsed rows.

## Out of scope

- token/cost/duration in collapsed rows
- custom borders beyond existing default tool shell
- rendering raw child JSON events

## References

- `extensions/narnia.ts` - current collapsed/expanded renderer and metadata extraction.
- Pi `examples/extensions/todo.ts` - compact `Text` based tool rendering.
- Pi `examples/extensions/built-in-tool-renderer.ts` - collapsed vs expanded renderer pattern.

## Implementation notes

- Collapsed target shape:

```txt
delegate 2 tasks
  ⏳ Auth cleanup | 3 read · 1 changed · 2 cmds
    output excerpt
  ✓ Tests smoke | 1 read · 0 changed · 1 cmds
    output excerpt
```

- Expanded per-task separator target:

```txt
─── Auth cleanup ───
```
