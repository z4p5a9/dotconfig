# Services

Use this when defining a service, writing its layers, reading config in it, or wiring layers at an entrypoint.

## Defining a service

A service is a class extending `Context.Service`.

When one implementation owns the service, declare `const make` above the class and pass it as `{ make }`, so the service interface infers from what `make` returns. The class carries it as `Head.make`, which is how tests build a real instance, so the module does not export it. State lives inside `make`, as locals the returned functions close over, never as class fields.

```ts
const make = Effect.gen(function* () {
  const position = yield* Ref.make(0);

  const current = Ref.get(position);
  const advance = Effect.fn("Head.advance")(function* (next: number) {
    yield* Ref.set(position, next);
  });

  return { current, advance };
});

export class Head extends Context.Service<Head>()("@app/Head", { make }) {}

export const layer = Layer.effect(Head, make);
```

When several implementations share one contract, write the interface as the second type argument and leave `make` out. Each implementation is its own module exporting `make` and `layer`. A check that needs an implementation's knowledge, such as whether a harness supports a model, is a member of the contract that each implementation writes, and the contract declares only the error it fails with.

```ts
export class Validation extends Context.Service<
  Validation,
  { readonly check: (snapshot: TransactionId, readSet: ReadSet) => Effect.Effect<void, ConflictError> }
>()("@app/Validation") {}
```

A member that reads is an Effect named as a noun, `head.current`. A member that acts is an `Effect.fn` named with a verb, `head.advance`, whether or not it takes arguments.

## Layers

A service module exports the class and `layer`. When `make` yields services this codebase owns, it also exports `layerNoDeps`, the bare layer, and `layer` provides those dependencies on top of it. Effect, platform, and runtime services stay as requirements of `layer`.

```ts
const make = Effect.gen(function* () {
  const head = yield* Head.Head;
  const log = yield* WriteLog.WriteLog;
  const sql = yield* SqlClient.SqlClient;
  // ...
});

export class Committer extends Context.Service<Committer>()("@app/Committer", { make }) {}

export const layerNoDeps = Layer.effect(Committer, make);

export const layer = layerNoDeps.pipe(
  Layer.provide(Head.layer),
  Layer.provide(WriteLog.layer),
);
```

`layerNoDeps` exists because a service captures its dependencies when it is built, not when it is called. Providing a different `Head` at a call site does not reach inside `make`. A test that wants one composes `layerNoDeps` with its own `Head` layer.

When `make` takes runtime arguments, `layer` is a function with the same parameters:

```ts
export const layer = (api: FunctionTree) => Layer.effect(Registry, make(api));
```

Pick the `Layer` constructor by how the service is built:

```ts
Layer.succeed(Head, value)       // a value that already exists
Layer.sync(Head, () => value)    // a value built synchronously
Layer.effect(Head, make)         // a value built by an effect
```

Real implementations default to `Layer.effect(Head, make)`. The other constructors cover specific shapes:

- `Layer.effectContext` when one effect builds several services.
- `Layer.unwrap` when an effect decides which layer to build.
- `Layer.fresh`, or `Effect.provide(layer, { local: true })` at a call site, when a consumer needs its own instance instead of the shared one.
- `Context.Reference` instead of `Context.Service` only for an ambient value with a real default. Anything that must be provided is a `Context.Service`.

## Config

Every value from the environment enters through `Config`.

A service reads its config values from a module-level `const config = Config.unwrap({ ... })` declared above `make` and destructures it at the top of a parameterless `make`. No type is declared for the record. The destructuring is the type.

```ts
const config = Config.unwrap({
  maxAge: Config.duration("WRITE_LOG_MAX_AGE").pipe(Config.withDefault(Duration.minutes(5))),
  softMaxBytes: Config.int("WRITE_LOG_SOFT_MAX_BYTES").pipe(Config.withDefault(50 * 1024 * 1024)),
});

const make = Effect.gen(function* () {
  const { maxAge, softMaxBytes } = yield* config;
  // ...
});

export class WriteLog extends Context.Service<WriteLog>()("@app/WriteLog", { make }) {}

export const layer = Layer.effect(WriteLog, make);
```

Each field uses the `Config` constructor that matches its meaning: `Config.duration` for time, `Config.int` for counts and sizes, `Config.port` for ports, `Config.boolean` for switches, `Config.redacted` for secrets, `Config.schema` for a value with its own schema. `Config.withDefault` carries the production value and applies only when the key is absent. A malformed value still fails. `Config.option` when absence means something. `Config.orElse` only when every failure, malformed included, should fall through.

A library layer that offers `layerConfig` takes `Config` values directly, as in `MysqlClient.layerConfig({ host: Config.string("MYSQL_HOST"), password: Config.redacted("MYSQL_PASSWORD") })`.

Tests vary tunables by providing `ConfigProvider.layer(ConfigProvider.fromUnknown({ ... }))` around the layer, never through parameters added to `make` for the test's benefit.

## Wiring

`Layer.provide` hides a dependency, so the result exposes only the outer service. `Layer.provideMerge` keeps the dependency exposed for consumers further out. `Layer.mergeAll` combines independent layers side by side. Use `provideMerge` when a consumer needs the dependency, never to make a composition compile.

An entrypoint is the only place that provides a layer to a program, as in `program.pipe(Effect.provide(App.layer), NodeRuntime.runMain)`. Inside the codebase, a service gets its dependencies through its own `layer`, and an effect that needs one service in one place gets it with `Effect.provideService`. At the entrypoint, each group of layers is its own named constant, declared in dependency order, instead of one nested expression.

When startup has ordering constraints that are not service dependencies, the entrypoint layer builds services by hand inside `Layer.effectContext`. It yields each `make` in order, passes earlier services with `Effect.provideService`, and returns `Context.make(A, a).pipe(Context.add(B, b))` with the services to expose.

A layer that starts long-lived work forks it into the layer's scope with `Effect.forkScoped`, so building the layer completes and the work ends when the scope closes. A layer that only starts work and provides nothing is `Layer.effectDiscard`.

```ts
export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const events = yield* Events.Events;
    yield* events.stream.pipe(Stream.runForEach(handle), Effect.forkScoped);
  }),
);
```

The service exposes no `start` member. The layer's lifetime is the work's lifetime.
