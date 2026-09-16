# Streams

Use this when a source emits many values over time, when adapting a callback or queue into a stream, when consuming a stream in a service, or when shaping backpressure.

## Sources

A `Stream` is for a source that emits many values over time. A loop that repeats one effect and emits nothing is `Effect.repeat` with a `Schedule`, not a stream.

- `Stream.make(a, b)` or `Stream.fromIterable(items)` for values already in memory. In a test, `Stream.concat(Stream.never)` after them keeps the stream open.
- `Stream.fromQueue(queue)` for a callback boundary, where the callback offers into a `Queue` owned by the implementation.
- `Stream.fromPubSub(pubsub)` when every subscriber must see every event.
- `SubscriptionRef.changes` when consumers want the current value and every change after it.
- `Stream.fromSchedule(schedule)` for ticks.
- `Stream.paginate(seed, step)` for a source pulled a page at a time. The step returns `[items, Option.some(nextSeed)]` to continue or `[items, Option.none()]` to end after those items. The stream emits the items one by one, not the pages. An empty page with the same seed is allowed, which is how a tail waits for a change without ending.
- `Stream.fromAsyncIterable(iterable, onError)` for a platform source with no Effect form.
- `Stream.unwrap(effect)` when the stream can only be built after yielding services.

```ts
export const from = (after: TransactionId) =>
  Stream.unwrap(
    Effect.map(Effect.all({ head: Head, log: WriteLog }), ({ head, log }) =>
      Stream.paginate(after, (cursor) =>
        Effect.gen(function* () {
          const seen = yield* head.current;
          const changes = yield* log.since(cursor);
          const last = changes.at(-1);
          if (last !== undefined) return [changes, Option.some(last.transactionId)] as const;
          yield* head.awaitChange(seen);
          return [[], Option.some(cursor)] as const;
        }),
      ),
    ),
  );
```

## Transforming

- `Stream.map(f)` for a pure transformation and `Stream.mapEffect(f)` for an effectful one.
- `Stream.mapEffect(f, { concurrency: n })` runs up to `n` at once and keeps order. Add `unordered: true` when order does not matter and latency does.
- `Stream.flatMap(f)` when one input becomes zero or many outputs, with `{ concurrency: n }` to run inner streams at once.
- `Stream.filter(predicate)` and `Stream.filterEffect(predicate)` to keep matching values.
- `Stream.mapAccum(initial, f)` when the transformation carries state from one value to the next.
- `Stream.merge(a, b)` interleaves two streams as their values arrive. `Stream.chunks` exposes the underlying chunks when a consumer wants a batch at a time.

## Consuming

A stream does nothing until something pulls from it, and the consumer sets the pace.

- `Stream.runForEach(f)` runs `f` on every value. A long lived consumer in a layer uses this.
- `Stream.runDrain` runs the stream for its effects and discards the values.
- `Stream.runCollect` gathers every value into a `Chunk`, so it belongs only on a finite stream. On an open stream it never returns. In a test, `Stream.take(n)` before it bounds the stream.
- `Stream.runFold(initial, f)` reduces the stream to one value.

## Owning a consumer

A service that consumes a stream for its whole lifetime forks the consumer in its layer with `Effect.forkScoped`, as the services reference shows with `Layer.effectDiscard`. A method that starts a consumer later forks into the scope captured in `make`, as the concurrency reference shows with `Effect.forkIn`.

A service that produces events exposes a `Stream` and keeps its `Queue` or `SubscriptionRef` private. Consumers pull from the stream. Nothing outside the implementation offers into the queue.

```ts
const make = Effect.gen(function* () {
  const queue = yield* Queue.bounded<GatewayEvent>(256);
  // the transport offers into queue
  return { events: Stream.fromQueue(queue) };
});

export class Gateway extends Context.Service<Gateway>()("@app/gateway/Gateway", { make }) {}

export const layer = Layer.effect(Gateway, make);
```

The consumer's pace is the stream's pace. `Stream.buffer({ capacity, strategy })` decouples the two only when the producer must not wait, with `"suspend"` to block the producer when full, `"dropping"` to drop new values, and `"sliding"` to drop old ones. `Stream.debounce(duration)` emits after a quiet period. `Stream.throttle` caps the rate.

Work keyed by session or id, where each key runs in order and different keys run at once, goes through one named helper built on `FiberMap`, not fiber bookkeeping spread across consumers.

## Errors

A stream fails with typed errors like an effect. `Stream.mapError` translates them at the owning boundary, and `Stream.catchTag` or `Stream.catchFilter` recovers from the typed ones. `Stream.catchCause` belongs at a supervision boundary only. A defect in a stream reaches the layer that owns the consumer, which is the point, so nothing below it swallows causes.
