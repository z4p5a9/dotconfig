# Functions

Use this when writing an Effect function, choosing between `Effect.fn` and `Effect.fnUntraced`, or writing the body of one.

## Defining functions

A function that takes arguments and returns an Effect is `Effect.fn` or `Effect.fnUntraced` over a generator function, never an arrow returning `Effect.gen`. The generator function is reused across calls. The arrow form allocates a new closure on every call. A standalone Effect value with no arguments is `Effect.gen`.

Three forms, by what they record:

- `Effect.fn("Module.foo")(function* (args) { ... })` opens a span and captures stack frames. Use it for public service methods and internal ones that do real work.
- `Effect.fn(function* (args) { ... })` captures stack frames without a span. Use it for internal functions that should still show in a stack trace.
- `Effect.fnUntraced(function* (args) { ... })` records nothing. Use it for internal helpers and hot paths.

## Transforms

Arguments after the generator function are transforms. Each receives the effect built so far and the original arguments, `(effect, ...args)`, and returns the next effect. Anything that applies to the whole call goes there and the body stays plain: translating errors, recovering locally, annotating logs, retrying, timing out, taking a permit, running uninterruptibly, ensuring cleanup, mapping the result.

Order transforms from the operation's own error handling outward to how it runs, so `catchTag` comes before `withPermits`, which comes before `uninterruptible`. One or two transforms is the normal case.

```ts
const cancel = Effect.fn("Job.cancel")(
  function* (jobId: JobId) {
    const job = yield* jobs.get(jobId);
    if (job.status !== "running") {
      return yield* new JobNotRunningError({ jobId });
    }
    yield* workers.stop(job.workerId);
    yield* jobs.update(jobId, { status: "cancelled" });
  },
  (effect, jobId) =>
    effect.pipe(
      Effect.catchTag("RecordNotFoundError", (cause) => new JobNotFoundError({ jobId, cause })),
    ),
  Effect.uninterruptible,
);
```

## Getting values out of effects

Take the value with `yield*` on its own line and work on it in plain code. `.pipe` on an effect is for changing how that effect runs or fails: retrying, timing out, catching, providing.

```ts
const entries = yield* read(cursor);
const names = entries.map(toName);
```

## Nesting Effect.gen

An `Effect.gen` inside another function is a smell. Steps that belong to the current function are written in it with `yield*`, and a step with a name of its own is its own `Effect.fn`. Flatten a nested `Effect.gen` wherever removing it leaves the outer function reading straight down.

An inner effect belongs only where an API takes an Effect as a value and that effect has more than one step: the body of `sql.withTransaction`, `Effect.uninterruptibleMask`, `Stream.paginate`, `Effect.forkScoped`, or a finalizer. A single step is passed directly. When the inner effect is substantial, build it as a named local and hand that in, instead of extracting a function just to shorten the call.

```ts
const backfill = Effect.gen(function* () {
  // several steps
});
yield* Effect.forkScoped(backfill.pipe(Effect.retry({ schedule, times: 3 })));
```
