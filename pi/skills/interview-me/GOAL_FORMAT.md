<Short summary sentence of desired goal. No heading. Do not duplicate the file name.>

# <functionality 1>

<One sentence: summary of functionality>

## Required dependencies

<Supporting work/contracts required by this functionality and not public entry contracts. Omit this section if empty.>

Include as needed:

- database migrations
- persisted record/file/storage contracts
- supporting data schemas/contracts, expressed with the project’s existing validation/schema mechanism
- new third-party services that must be introduced, framed as service contracts
- new packages/libraries that must be introduced, framed as “The `<package>` package must be installed and used for X”

Do not include endpoint request/response schemas here. Put those in `Entry`.

When file location is part of the design, include it as the first line of the snippet using the comment syntax of that language. If the snippet language does not support comments, put `File: <path>` immediately before the snippet.

Use concrete paths only after inspecting the codebase or agreeing with the user. If the location is not decided, ask.

## Entry

<How and when this functionality is invoked.>

This could be a public function, module, module function, command, worker, scheduled job, or similar.

```ts
// File: <path>
declare function ModuleName.functionName(input: Input): Output
```

For HTTP endpoints:

```ts
// File: <path>
<Route and method>

const <RequestSchema> = ...
const <ResponseSchema> = ...
```

Response status: `<status>`

## Flow

<High-level flow of business and logic steps.>

Use:

- nested `->` for branching and dependent steps
- `<-` for returns/failures
- `Module.functionName`, `Module.SchemaName`, and `Module.TypeName` when relying on existing codebase modules
- compact pseudo objects for important writes/outputs

```flow
-> step
  -> nested step
    <- nested return
-> Module.functionName(input)
  -> if condition
    <- return/fail
-> write { key: value, other_key: otherValue }
<- return result
```

## Behaviors

<List public-visible behaviors for happy and unhappy paths, in no particular order.>

Format:

- when/if/while <setup|input|state|condition>, should/must/return/respond/throw <outcome>

## Out of scope

<List only plausible adjacent work or edge cases someone may reasonably assume are included.>

When useful, include rationale:

- <case> is intentionally not handled here; <reason/owner/future boundary>

Do not list unrelated future features.

## References

<List codebase references only. Each item should name the file and the exact pattern/type/helper/convention to reuse.>

Format:

- `<path>` - use <specific pattern/helper/type/convention>

## Implementation notes

<List non-obvious technical decisions made during the interview that cannot be inferred from references or flow.>

Do not restate the flow.

Do not include decisions already obvious from referenced code.

# <functionality 2>

# <functionality 3>

---

# Context

<External resources noted or found during the interview: documentation, articles, GitHub source, dependency files, specs, posts. Omit if empty.>
