---
name: effect
description: Effect v4 conventions and API selection. Use when writing or reviewing TypeScript that imports effect, whether defining services or layers, modeling errors or schemas, writing Effect tests, or coordinating fibers, streams, and shared state.
---

# Effect

The conventions and patterns here are current for Effect v4 and supersede whatever you, the agent reading this skill, remember about Effect. The nearest AGENTS.md overrides them. The `coding` skill carries the naming and shape rules for any code and applies alongside this one.

## Sources

If the `effect` package is installed, its source is the authoritative reference for the exact pinned version. Otherwise the `main` branch of https://github.com/Effect-TS/effect is. The official documentation at https://effect.website/docs/v4 carries the guides and API reference.

## Core defaults

- Write effects as `Effect.gen(function* () { ... })` generators and keep the body plain. Take each value out with `yield*` on its own line and work on it in plain code. Use `.pipe` on an effect to change how it runs or fails, such as retrying, timing out, catching, or providing.
- Anything that applies to the whole call, such as translating errors, taking a permit, or retrying, goes in the arguments after the generator in `Effect.fn`, with error handling before permits, timeouts, and `Effect.uninterruptible`.
- A function that takes arguments is `Effect.fn("Module.operation")` when it is a public service method or an internal one that does real work, and `Effect.fnUntraced` when it is an internal helper where a span adds nothing.
- Define a service as a `Context.Service` class. When it has one implementation, declare `const make` above the class, pass it as `{ make }`, and let TypeScript infer the service interface from it instead of declaring one. When several implementations share one contract, declare the interface and leave `make` out.
- A service member that reads is an Effect named as a noun, and one that acts is an `Effect.fn` named with a verb.
- One concept per file named after it, and one barrel per directory that only re-exports `export * as Name from "./Name.ts"`. Consumers import the namespace and address members through it, `Head.Head`, `Head.layer`.
- Model each distinct failure as its own tagged error class, named for what went wrong and never for its module alone. Use `Data.TaggedError` by default and `Schema.TaggedError` for errors that cross a process boundary. An error made from another error wraps it as `cause`, and also as `reason` when callers should reach it by tag.
- Translate a known error with `Effect.catchTag` naming its tag, so an error added later fails the build instead of being wrapped silently. `Effect.mapError` is for a channel typed `unknown` and for the outermost boundary.
- A check that needs an implementation's knowledge is a member of the contract, and the contract declares only its error.
- Model data with `Schema.Struct`. Model entity ids, units whose raw values could be mixed up, and values with a rule of their own as branded schemas. Decode unknown input at the boundary with `Schema.decodeUnknownEffect`.
- Build a value with `schema.makeEffect(...)` when the input may be invalid. `schema.make(...)` throws, so use it only on trusted input.
- A plain function that can fail returns `Result`. Write it with `Result.gen` when more than one branch can fail.
- Model internal variants with `Data.TaggedEnum` and dispatch with `$match`. Model variants that cross a boundary with `Schema.TaggedUnion` and dispatch with `.match`.
- Keep mutable state shared across fibers in the Effect primitive that matches its semantics: `Ref`, `Deferred`, `Semaphore`. Keep fiber-local control state in ordinary locals.
- Use `Schedule` for retry, repeat, and polling instead of loops with sleeps.
- Use `Stream` for a source that emits many values over time.
- Fork long-lived background work into its owning scope with `Effect.forkScoped`, so layer acquisition completes.

## References

Read only the references that match the task. When a task spans several, read all of them before editing.

- Effect functions, generators, pipelines, `yield*`, or `Effect.fn` transforms: read `references/functions.md`.
- Services, layers, runtime wiring, or config reading: read `references/services.md`.
- Files, directories, barrels, or imports: read `references/modules.md`.
- Error classes, error unions, error translation, causes, or absence handling: read `references/errors.md`.
- Data models, schemas, brands, variants, optional keys, or decoders: read `references/schema.md`.
- Effect tests, time, fakes, test layers, or test config: read `references/testing.md`.
- Fibers, forking, scopes, interruption, or shared state: read `references/concurrency.md`.
- Streams, event sources, queues, pubsubs, pagination, or stream consumers: read `references/streams.md`.
- Retry, repeat, polling, backoff, jitter, or timeouts: read `references/scheduling.md`.
