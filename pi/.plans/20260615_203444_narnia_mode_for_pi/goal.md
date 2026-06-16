Add a local Pi extension that turns the root session into a delegate-only orchestrator and runs tool-heavy work in isolated child Pi processes.

# Narnia mode

Enable/disable a local mode where root Pi can only use `delegate`.

## Required dependencies

Narnia session state contract:

```ts
// File: extensions/narnia.ts
type NarniaState = {
  enabled: boolean
}
```

Delegate tool result details contract:

```ts
// File: extensions/narnia.ts
type DelegateDetails = {
  task: string
  startedAt: number
  endedAt: number
  durationMs: number
  exitCode: number
  stdoutEvents: unknown[]
  stderr: string
  finalOutput: string
  returnedOutput: string
  contractMissingSections: string[]
  metadata: {
    filesRead: string[]
    filesModified: string[]
    tools: Array<{ name: string; args: unknown }>
    commands: Array<{ command: string; exitCode?: number; isTest: boolean }>
    usage: {
      input: number
      output: number
      cacheRead: number
      cacheWrite: number
      cost: number
      contextTokens: number
      turns: number
    }
    provider?: string
    model?: string
    stopReason?: string
    errorMessage?: string
  }
}
```

Child final-output contract:

```md
## Result
Short outcome.

## Changed
- path: what changed

## Inspected
- path: why relevant

## Commands
- command: pass/fail + important output only

## Decisions
- decision: rationale

## Risks
- unresolved risk / none

## Needs Parent/User
- question / none
```

No new packages.

## Entry

Local extension:

```ts
// File: extensions/narnia.ts
export default function narniaExtension(pi: ExtensionAPI): void
```

Command:

```sh
/narnia
/narnia on
/narnia off
```

Tool, registered lazily after first enable or saved enabled-state restore:

```ts
// File: extensions/narnia.ts
delegate({
  task: string
}): Promise<{
  content: [{ type: "text"; text: string }]
  details: DelegateDetails
}>
```

Events:

```ts
// File: extensions/narnia.ts
pi.on("session_start", ...)
pi.on("session_tree", ...)
pi.on("before_agent_start", ...)
pi.on("tool_call", ...)
pi.on("session_shutdown", ...)
```

## Flow

```flow
-> extension loads
-> if `PI_NARNIA_CHILD=1`
  <- return without registering command/tool/gates

-> register `/narnia`

-> on session_start/session_tree
  -> scan branch for latest custom entry `narnia`
  -> if no state
    -> update footer only
    <- do not touch active tools
  -> if state enabled true
    -> ensure `delegate` registered
    -> pi.setActiveTools(["delegate"])
  -> if state enabled false
    -> ensure `delegate` registered
    -> pi.setActiveTools(all configured tools except delegate)
  -> update footer

-> `/narnia on`
  -> ensure `delegate` registered
  -> append `narnia` custom entry { enabled: true }
  -> pi.setActiveTools(["delegate"])
  -> show warning that user paste/`!` output can still pollute root context
  <- notify enabled

-> `/narnia off`
  -> ensure `delegate` registered
  -> append `narnia` custom entry { enabled: false }
  -> pi.setActiveTools(all configured tools except delegate)
  <- notify disabled

-> before_agent_start while enabled
  -> append system prompt guidance:
    -> root is orchestrator
    -> use only delegate for file/shell/web/edit/test work
    -> delegate bounded tasks
    -> keep root compact
    -> do not ask child to recursively delegate

-> tool_call while enabled
  -> if toolName is `delegate`
    <- allow
  <- block with "Narnia Mode: root session cannot call tools directly. Use delegate with a bounded task."
```

## Behaviors

- when no Narnia state exists, should not modify active tools
- when `/narnia on` runs, should make only `delegate` active
- when `/narnia off` runs, should activate all configured tools except `delegate`
- when enabled root calls any non-`delegate` tool, should block deterministically
- when enabled root calls `delegate`, should allow
- when enabled, should show footer status `Narnia: on`
- when disabled after explicit `/narnia off`, should show footer status `Narnia: off`
- when context usage is available, footer should include compact root ctx tokens
- when branch changes, should restore latest branch-local Narnia state
- when child env has `PI_NARNIA_CHILD=1`, extension should no-op

## Out of scope

- blocking user `!` commands or large pasted text
- preserving/restoring pre-Narnia active tool subset
- `/narnia status` alias
- project/package publishing

## References

- `extensions/runtime-metrics.ts` - use footer status, branch custom-entry restore, concise formatting style
- Pi `docs/extensions.md` - use `registerCommand`, `registerTool`, `tool_call`, `before_agent_start`, `setActiveTools`, `appendEntry`
- Pi `examples/extensions/permission-gate.ts` - use deterministic `tool_call` blocking pattern
- Pi `examples/extensions/tools.ts` - use branch-persisted active-tool state pattern

## Implementation notes

- `delegate` should be registered lazily so default/off sessions do not get it active by registration side-effect.
- Explicit saved off-state wins over CLI/default tool selection after first Narnia use.

# Delegate child process

Run bounded work in an isolated child Pi process and return only compact output to root.

## Entry

```ts
// File: extensions/narnia.ts
delegate({ task: string }): Promise<ToolResult>
```

## Flow

```flow
-> trim task
-> if empty
  <- return compact error text, no child spawn
-> if another delegate running
  <- return compact error text, no child spawn
-> mark child running and update footer
-> build child tools from pi.getAllTools()
  -> exclude `delegate`
-> spawn current Pi executable with:
  -> --mode json
  -> -p
  -> --no-session
  -> --tools <all configured non-delegate tools>
  -> --append-system-prompt <inline bootstrap>
  -> --model current root provider/model if available
  -> --thinking current root thinking level
  -> --approve if ctx.isProjectTrusted()
  -> --no-approve otherwise
  -> prompt `Task: ${task}`
  -> env PI_NARNIA_CHILD=1
  -> cwd ctx.cwd
-> parse stdout JSON lines as events
-> collect stderr
-> on abort signal
  -> SIGTERM child
  -> SIGKILL after timeout if needed
-> derive final assistant text
-> validate required markdown sections
-> cap returned text to 12KB
-> extract metadata from JSON events
-> clear running state and update footer
<- return capped text + full details
```

## Behaviors

- when task is valid, should launch exactly one child Pi process
- when child runs, should use `--no-session`
- when root project is trusted, child should receive `--approve`
- when root project is not trusted, child should receive `--no-approve`
- when root model/thinking are set, child should use same model/thinking
- when configured tools include web/code/custom tools, child should receive them through `--tools`
- when child exits nonzero, should return failure text and details, not throw
- when child assistant stop reason is `error` or `aborted`, should return failure text and details, not throw
- when child process spawn/abort infrastructure fails, should throw
- when a second delegate starts while one is running, should return an error result
- when final child output exceeds 12KB, should cap model-visible output and keep full output in details
- when child final output misses required sections, should record `contractMissingSections`

## Out of scope

- read-only vs mutating delegate profiles
- parallel delegates
- recursive Narnia delegates
- automatic task splitting
- retry/repair of malformed child summaries
- separate trace files/databases

## References

- Pi `examples/extensions/subagent/index.ts` - use JSON child process spawning, event parsing, abort propagation, usage aggregation, custom rendering patterns
- Pi `docs/json.md` - parse `message_end`, `tool_execution_start`, `tool_execution_end`, `agent_end`
- Pi `docs/session-format.md` - use assistant usage/model/stopReason and toolResult message shapes
- Pi `docs/usage.md` / CLI help - use `--mode json`, `-p`, `--no-session`, `--tools`, `--approve`, `--no-approve`

## Implementation notes

- Child bootstrap is an inline string passed as `--append-system-prompt`, not a temp file.
- Child prompt contains no automatic root conversation summary; root must include necessary context in `task`.
- `delegate` must not return `terminate: true`.

# Delegate rendering and metadata

Show compact child progress/result in TUI while preserving full trace in tool details.

## Entry

```ts
// File: extensions/narnia.ts
renderCall(...)
renderResult(...)
```

## Flow

```flow
-> render call
  -> show delegate label and task preview

-> while running
  -> stream partial result updates with current child progress
  -> footer says `Narnia: child running`

-> render result collapsed
  -> status success/failure
  -> task preview
  -> final `## Result` excerpt
  -> usage
  -> changed/read file counts
  -> command count

-> render result expanded
  -> full task
  -> full final child output
  -> tool-call timeline
  -> extracted metadata
  -> stderr if present
```

## Behaviors

- collapsed rendering should stay compact
- expanded rendering should expose audit trail without dumping raw JSON by default
- details should contain full parsed JSON events and raw stderr
- command metadata should mark likely tests using command text regex for common test commands
- metadata should include files read, files modified, tools called, commands, usage, model/provider, stop reason, error message, exit code, duration

## Out of scope

- rendering every raw JSON event line in the default expanded view
- storing traces outside the parent session
- formal automated tests for the local extension

## References

- Pi `examples/extensions/subagent/index.ts` - use collapsed/expanded tool renderers and usage formatting
- Pi `examples/extensions/status-line.ts` - use `ctx.ui.setStatus`
- Pi `examples/extensions/message-renderer.ts` - use expandable details rendering style
- Pi `examples/extensions/structured-output.ts` - reference only for non-terminating decision

## Implementation notes

- Metadata is evidence from child JSON events, independent of child prose.
- Bash exit code may need best-effort extraction from `tool_execution_end.result` / tool result message details/content; if unavailable, leave undefined.

---

# Context

- HN comment: https://news.ycombinator.com/item?id=48525305
- HN post: https://news.ycombinator.com/item?id=48524620
- Pi extension docs: `/Users/alkis/.local/share/mise/installs/node/22.22.3/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`
- Pi JSON mode docs: `/Users/alkis/.local/share/mise/installs/node/22.22.3/lib/node_modules/@earendil-works/pi-coding-agent/docs/json.md`
- Pi subagent example: `/Users/alkis/.local/share/mise/installs/node/22.22.3/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/subagent/index.ts`
