# Concurrency

Use this when forking fibers, managing scopes and finalizers, making a region uninterruptible, sharing state between fibers, waiting for a change, or running work with bounded concurrency.

## Forking

Which fork to use follows from who owns the fiber's lifetime.

- `Effect.forkChild` makes a child of the current fiber. It is interrupted when the parent ends, so it is for work that belongs to one call, such as a test forking the code under test.
- `Effect.forkScoped` binds the fiber to the enclosing `Scope`. It is for background work owned by a layer, which ends when the layer's scope closes.
- `Effect.forkIn(scope)` binds the fiber to a scope captured earlier. A service method that starts work in the service's lifetime captures `Scope` in `make` with `yield* Effect.scope` and forks into it. The scope never appears in the service interface.
- `Effect.forkDetach` attaches the fiber to the global scope, so it outlives the caller. It is for work that nothing owns, which is rare and deliberate.

A group of fibers with one lifetime is a `FiberSet`, or a `FiberMap` when each fiber is looked up by key, such as one worker per session. Closing their scope interrupts all of them, and a `FiberMap` drops finished fibers on its own.

The caller gets the result back with `Fiber.join`, which fails when the fiber failed, or `Fiber.await`, which returns the `Exit` for inspection.

## Scopes and finalizers

A resource is acquired with `Effect.acquireRelease(acquire, release)`. The release runs when the surrounding scope closes, whether the work succeeded, failed, or was interrupted. A resource used within one call is bracketed with `Effect.acquireUseRelease(acquire, use, release)`, which needs no scope. Cleanup that has no acquire step, such as unregistering from a set, is `Effect.addFinalizer((exit) => ...)`.

Whoever opens the scope owns the resource. A service that acquires something in `make` owns it for the layer's lifetime, because `Layer.effect` builds `make` inside the layer's scope and closes that scope when the layer is released. That is why `Scope` never shows up as a requirement of a layer. A single workflow that needs a resource for its own duration wraps itself in `Effect.scoped`, which closes the scope when the workflow ends.

```ts
make: Effect.gen(function* () {
  const connection = yield* Effect.acquireRelease(open, (connection) => close(connection));
  const sets = yield* Ref.make(new Set<LiveSet>());
  yield* Effect.addFinalizer(() => Ref.get(sets).pipe(Effect.flatMap(closeAll)));
  // ...
}),
```

Finalizers run in reverse order of registration and cannot fail, so a release that can fail logs and swallows inside itself.

## Interruption

Interruption is not a failure. It carries no error, `Effect.retry` ignores it, and a `catchTag` never sees it. Code that catches at the cause level checks `Cause.hasInterrupts(cause)` and lets interruption through.

A region that must finish once it has started is uninterruptible. The test is whether an interruption in the middle would leave state that nothing can repair, such as a waiter replaced but never woken, or a durable write done but its in memory record not updated. For a whole function, `Effect.uninterruptible` goes in the trailing transforms of `Effect.fn`.

```ts
const advance = Effect.fn("Head.advance")(function* (next: TransactionId) {
  const fresh = yield* Deferred.make<void>();
  const previous = yield* Ref.modify(position, (current) => [current.changed, { next, changed: fresh }]);
  yield* Deferred.succeed(previous, undefined);
}, Effect.uninterruptible);
```

When one part of the region should stay interruptible, such as code supplied by the caller, `Effect.uninterruptibleMask((restore) => ...)` makes the whole region uninterruptible and `restore(effect)` opens a window inside it.

```ts
return yield* Effect.uninterruptibleMask((restore) =>
  sql.withTransaction(
    Effect.gen(function* () {
      const executed = yield* restore(execute(snapshot));
      yield* commitStaged(executed);
    }),
  ),
);
```

An interrupt inside `restore` rolls the transaction back before any durable write. Outside it, the commit runs to completion.

## Shared state

State that more than one fiber can touch lives in the Effect primitive whose semantics match it, and every change goes through that primitive.

- `Ref` holds a value. `Ref.modify` reads and replaces in one step and returns something from the old value, which is the atomic form of check then set.
- `SubscriptionRef` holds a value that consumers also watch. `SubscriptionRef.changes` is a stream of every new value.
- `Deferred` is a one shot signal, completed once with `Deferred.succeed` or `Deferred.fail` and waited on with `Deferred.await`.
- `Semaphore` hands out permits. `Semaphore.make(1)` with `withPermits(1)` serializes a critical section, and a larger count bounds how many fibers run it at once.
- `Latch` is a gate. `Latch.close` blocks fibers at `Latch.whenOpen` until `Latch.open`.
- `Queue` hands items from producers to consumers, each item to one consumer. `Queue.bounded` applies backpressure when full, `Queue.sliding` drops the oldest, `Queue.dropping` drops the newest.
- `PubSub` delivers every item to every subscriber.

State that only the current fiber touches, such as a loop counter or a cursor inside one function, is a plain local. Wrapping it in a `Ref` adds nothing.

A `Map` or `Set` shared between fibers goes inside a `Ref` and is replaced, never mutated in place, so that every reader sees a consistent snapshot.

## Waiting for a change

Three tools block a fiber until a value changes. Which one to use depends on who is waiting.

- `SubscriptionRef.changes` for a consumer that wants every new value as a stream.
- `Effect.tx` over a `TxRef` for a plain fiber that waits for one condition. `Effect.txRetry` inside the transaction blocks until a ref the transaction read changes. It works by interrupting the fiber and running the transaction again. That breaks inside a `Stream` pull, because the interrupt stops the pull and nothing resumes it.
- A `Deferred` swapped on every change for a waiter inside a stream, such as a paginating tail. The state holds the value and the current `Deferred` together. A writer swaps in a fresh `Deferred` and completes the old one. That swap runs uninterruptible, so an interrupt cannot strand a waiter between the swap and the wake. A reader awaits the `Deferred` only when the value it saw is still current.

```ts
const awaitChange = Effect.fn("Head.awaitChange")(function* (seen: TransactionId) {
  const current = yield* Ref.get(position);
  if (current.transactionId !== seen) return yield* Effect.void;
  return yield* Deferred.await(current.changed);
});
```

## Bounded concurrency

`Effect.forEach(items, f, { concurrency: n })` runs `f` over the items with at most `n` in flight and keeps the results in order. `discard: true` drops the results. `"unbounded"` is for a set known to be small. `Effect.all([a, b], { concurrency })` does the same for a fixed group of effects and returns a tuple or record shaped like its input.

One failure interrupts the rest and fails the whole. When one bad item should not stop the batch, `f` handles its own failure, logs it, and continues. That is only right when skipping the item is the actual policy and not a way to hide the failure.

`Effect.race(a, b)` returns the first to finish and interrupts the other. `Effect.timeout(effect, "5 seconds")` races the effect against the clock and fails with a `TimeoutError` when the clock wins.
