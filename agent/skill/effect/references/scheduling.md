# Scheduling

Use this when retrying, repeating, polling, choosing a backoff, or putting a deadline on an effect.

## Retry and repeat

`Effect.retry` runs an effect again after a typed failure. `Effect.repeat` runs it again after a success. Both take options `{ while, until, times, schedule }` or a bare `Schedule`. The effect runs once before the schedule is consulted, so `times: 3` means up to four runs.

```ts
backfill.pipe(Effect.retry({ schedule: Schedule.exponential("1 second"), times: 3 }));
poll.pipe(Effect.repeat({ schedule: Schedule.spaced("1 second"), until: (result) => result.done }));
```

Retry only an operation that is safe to run twice, and only at the boundary that owns it. Defects and interruption are never retried. What happens when a retry runs out, and whether to recover at all, is in the errors reference.

## Building a schedule

A schedule is a value, so a policy used in more than one place is a named constant.

- `Schedule.spaced(duration)` waits the duration after each run completes. `Schedule.fixed(duration)` keeps runs aligned to a cadence regardless of how long each took.
- `Schedule.exponential(base)` doubles the delay each time and `Schedule.fibonacci(base)` grows it more slowly. `Schedule.jittered` randomizes each delay so many clients do not retry in lockstep.
- `Schedule.recurs(n)` counts recurrences with no delay. `Schedule.upTo({ times, duration })` bounds any schedule by count, elapsed time, or both.
- `Schedule.tap((metadata) => ...)` runs an effect on each step with `input`, `output`, `attempt`, `elapsed`, and `duration`, which is where a retry gets logged.
- `Schedule.modifyDelay((metadata) => ...)` replaces a delay, for a source that says how long to wait, and `Schedule.setInputType<E>()` before it fixes the input type when it would otherwise be `unknown`.

```ts
const projectionRetry = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.upTo({ times: 5 }),
  Schedule.tap(({ input, attempt }) => Effect.logWarning("Projection retrying", { attempt, error: input })),
);
```

## Polling workers

A worker that runs a pass on a cadence handles the pass's typed failures before `Effect.repeat`, so an expected failure is logged and the loop continues. A defect still ends the loop and reaches the layer that forked the worker, which is where cause level handling lives, as the errors reference shows.

```ts
const pass = runPass().pipe(
  Effect.tapError((error) => Effect.logError("Worker pass failed", error)),
  Effect.ignore,
);

const worker = pass.pipe(Effect.repeat(Schedule.spaced("1 second")));
```

The worker is forked into its layer's scope with `Effect.forkScoped`, as the services reference shows. When each pass processes a batch, the concurrency reference covers running the items with bounded concurrency and isolating one item's failure.

## Timeouts and delays

`Effect.timeout(effect, "5 seconds")` fails with a `TimeoutError` when the deadline passes. `Effect.timeoutOption` succeeds with `None` instead, and `Effect.timeoutOrElse` runs a fallback. A deadline belongs on an operation with a real limit, not on every call.

`Effect.delay(effect, duration)` starts an effect later. `Effect.sleep(duration)` in production code is for the case where waiting is the behavior itself, such as a pause between passes that no schedule expresses. In a test every one of these reads the test clock, so the test advances it instead of waiting, as the testing reference shows.
