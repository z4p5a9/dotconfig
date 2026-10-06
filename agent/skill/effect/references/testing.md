# Testing

Use this when writing an Effect test, faking a service, driving time, waiting on a fiber in a test, or providing config to a test.

## Writing a test

A test is `it.effect` from `@effect/vitest`, with `describe` and `expect` from `vitest`. `it.effect` runs the effect with a test clock that starts at zero and a test console. `it.live` runs on the real clock, for the rare test where real time is the behavior under test.

Each test is self contained. It builds the layers it needs at its own `Effect.provide`, so it gets a fresh instance of everything stateful. Repeating a literal across tests is the expected cost. A file level layer is one reusable fixture, never an aggregate test environment. `it.layer(layer)` shares one built layer across a block and is for a resource too expensive to build per test, such as a database.

```ts
describe("Committer.commit", () => {
  it.effect("numbers transactions from one", () =>
    Effect.gen(function* () {
      const committer = yield* Committer.Committer;
      const first = yield* committer.commit(envelope, execute);
      expect(first.transactionId).toBe(1n);
    }).pipe(Effect.provide(Committer.layer)),
  );
});
```

## Fakes

A fake is a `Layer.succeed` over the real service interface, written inside the test that needs it. Most fakes wrap a real instance and intercept the one member the test observes, so everything else keeps its real behavior.

```ts
const real = yield* Head.Head.make;
const waiting = yield* Deferred.make<void>();
const watched = Layer.succeed(Head.Head, {
  ...real,
  awaitChange: (seen: TransactionId) =>
    Effect.andThen(Deferred.succeed(waiting, undefined), real.awaitChange(seen)),
});
```

`Layer.mock(Service, { member })` is a partial fake whose missing members fail with a defect when used, for a test that touches one member and wants the rest to be loud.

A fake that many tests share, such as a recording sender or a database harness, is a module in the package's `testing/` directory. Its layer provides the real service tag, and its control and inspection surface is a second `Context.Service` tag provided by the same layer with `Layer.effectContext`, so the production interface gains nothing for the test's sake. Production code depends only on the real tag.

## Time

The test clock starts at zero and only moves when the test moves it. Every sleep, schedule, retry, and timeout in the code under test reads that clock, and so does every timestamp taken through `Clock`. A test that depends on time advances the clock with `TestClock.adjust("1 second")` or pins it with `TestClock.setTime(millis)`.

Fork a sleeping effect before advancing the clock. Advancing wakes the fibers already waiting on it. A fiber forked afterwards sleeps until the next adjust.

```ts
const fiber = yield* Effect.forkChild(worker.pipe(Effect.timeout("5 seconds")));
yield* TestClock.adjust("5 seconds");
const exit = yield* Fiber.await(fiber);
```

When a test has no choice but to let real time pass, such as polling a fiber blocked on something other than the clock, wrap that one effect in `TestClock.withLive`.

## Synchronization

A test that involves more than one fiber waits on a signal, never on a sleep. `Deferred` is a one shot signal that something happened. `Queue` hands events from the code under test to the test one at a time. `Latch` is a gate the test opens and closes more than once. `Ref` holds what the test observed.

The signal comes from the fake that wraps the real service, so the code under test is unchanged.

```ts
const real = yield* Head.Head.make;
const waiting = yield* Deferred.make<void>();
const watched = Layer.succeed(Head.Head, {
  ...real,
  awaitChange: (seen) => Effect.andThen(Deferred.succeed(waiting, undefined), real.awaitChange(seen)),
});

const reading = yield* Effect.forkChild(
  Stream.runCollect(Stream.take(Tail.from(TransactionId.make(0n)), 1)).pipe(Effect.provide(watched)),
);
yield* Deferred.await(waiting);
yield* real.advance(TransactionId.make(1n));

expect(yield* Fiber.join(reading)).toHaveLength(1);
```

## Config

To run a service with a specific config value, a test wraps the service's `make` or `layer` in `ConfigProvider.layer(ConfigProvider.fromUnknown({ ... }))`. The keys are the environment names the service's `config` reads, so the test goes through the same decoding as production.

```ts
const log = yield* WriteLog.WriteLog.make.pipe(
  Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ WRITE_LOG_MAX_AGE: "300 seconds" }))),
);
```

## Property tests

A property test states a rule that holds for every input, such as decoding what was encoded gives the original back, and runs it against generated inputs. A parser, codec, smart constructor, or branded schema gets one, because those are the places where a rule spans more inputs than a person would write down.

`it.prop` takes schemas or fast-check arbitraries by name and passes generated values to the test. A schema generates values that satisfy its checks, so a branded schema needs no extra generator.

```ts
it.prop("round trips every principal", { principal: Principal }, ({ principal }) =>
  Effect.gen(function* () {
    expect(yield* decode(encode(principal))).toEqual(principal);
  }),
);
```

A property test does not replace the tests with fixed inputs and expected values. When encode and decode are both wrong in the same way, the round trip still passes, and only a test that says what `encode("a")` must produce catches it. Beside the generated inputs, keep a short list of nasty inputs written by hand inside the test, such as empty strings, boundary numbers, and escape sequences, each with its expected result, so a failure names the input that broke.
