# Errors

Use this when defining an error class, deciding what an operation can fail with, translating one error into another, handling errors, or modeling absence.

## Defining errors

Every distinct failure is its own class, and its name states what went wrong, `DocumentNotFoundError`, `MalformedModelSettingsError`, `ModelNotSupportedError`, `JobRunningError`. A class is never named for its module alone. `MultiplexerError` says where, not what. A contract that several implementations share still owns its failures, named for what went wrong at its level, `MultiplexerUnavailableError`, and each implementation wraps its own errors in them. The module's name is fine for a union of its failures.

`Data.TaggedError` is the default. `Schema.TaggedError` is for errors that cross a process boundary, where they need encoding. The split keeps internal errors from leaking through an API by accident, since only the schema backed ones can be serialized.

```ts
export class DocumentNotFoundError extends Data.TaggedError("DocumentNotFoundError")<{
  readonly collection: string;
  readonly documentId: string;
}> {}

export class EmailTakenError extends Schema.TaggedError<EmailTakenError>()("EmailTakenError", {
  email: Schema.String,
}) {}
```

Fields carry the data that failure has. Human-readable text goes in `message`, so native stringification, stacks, and logs work.

An error made from another error wraps it as `cause`, the standard link that logs and tools follow. The field is `readonly cause: unknown` on a `Data.TaggedError`, or the source's class when it is always the same one, and `cause: Schema.Defect()` on a `Schema.TaggedError`, which encodes it as JSON. The field is required when every instance wraps a source, so leaving the source out is a type error. It is optional, `cause?: unknown` or `Schema.optional(Schema.Defect())`, only when the error is sometimes raised with no source.

## Error unions

An operation's error channel is the union of the classes it can fail with, written inline in its signature. The union gets a name when two signatures share it, named for the operation or the module.

```ts
export type EncodeError = Int64OutOfRangeError | UnpairedSurrogateError | InvalidDocumentIdLengthError;
```

Each operation exposes errors that describe its own failures. When it calls a lower operation, it translates that operation's errors at its own boundary instead of passing them through because the names look alike. There is no broad application-wide error type. The only place errors are collapsed is the outermost boundary that turns them into a response or exit code.

## Reasons

A `reason` also wraps the error this one was made from, typed, so callers can still reach it by tag. It comes on top of `cause`, never instead of it, since logs and tools follow `cause` only. Use it when callers should branch on the wrapped error, and leave it out when the source is only for the log. A `reason` is never a label for a kind of failure. Each distinct failure is its own class in the operation's union.

```ts
class RateLimitError extends Data.TaggedError("RateLimitError")<{ readonly retryAfter: number }> {}
class QuotaError extends Data.TaggedError("QuotaError")<{}> {}

class RequestError extends Data.TaggedError("RequestError")<{
  readonly reason: RateLimitError | QuotaError;
  readonly cause: unknown;
}> {}
```

Handle reasons with the reason combinators. `Effect.catchReason("RequestError", "RateLimitError", (reason, error) => ...)` handles one reason, `Effect.catchReasons` handles several, and reasons that did not match keep the parent error in the channel. `Effect.unwrapReason("RequestError")` replaces the parent with its reasons in the error channel, for a caller that wants to `catchTag` them directly.

```ts
request.pipe(
  Effect.catchReason("RequestError", "RateLimitError", (reason, error) =>
    reason.retryAfter > 0 ? retryAfter(reason.retryAfter) : Effect.fail(error),
  ),
);
```

## Translating

The module that owns a client, SDK, or driver translates its failures into that module's own tagged errors before they cross its interface. `Effect.try` and `Effect.tryPromise` take a `catch` that receives the thrown value, and `Result.try` does the same for plain code. `Effect.tryPromise` hands its `try` an `AbortSignal`, which goes into the call so that interruption cancels it.

```ts
const fetchUser = Effect.fn("Users.fetch")(function* (userId: UserId) {
  return yield* Effect.tryPromise({
    try: (signal) => client.get(`/users/${userId}`, { signal }),
    catch: (cause) => new UserFetchError({ userId, cause }),
  });
});
```

A known error is translated with `Effect.catchTag` or `Effect.catchTags` naming its tag, even when it is the only one in the channel, so an error added later stays in the channel and fails the build instead of being wrapped silently. `Effect.mapError` is for a channel typed `unknown`, and for the outermost boundary that collapses every failure into one response.

Every conversion from one error into another passes the untouched source as `cause`.

A failure that means the program is wrong, such as a violated invariant or an impossible branch, is a defect. `Effect.orDie` turns a typed failure into one and `Effect.die` raises one directly. Expected failures stay typed even when the immediate caller cannot recover, and the caller returns them upward.

## Handling

Recover at the narrowest boundary that has a truthful response. `Effect.catchTag` handles one class and `Effect.catchTags` several. `Effect.catchIf` handles the errors a type guard selects, and `Effect.catchFilter` does the same through a reusable `Filter` that can narrow or transform the error first. A boundary without a real fallback lets the failure through.

`Effect.retry` is recovery by repetition. It retries typed failures only, never defects or interruption, and takes a `Schedule` or options `{ while, until, times, schedule }`. A retry that runs out of attempts stays visible. `Effect.retryOrElse` is for the case where exhaustion has a fallback or a report of its own.

Recover at the cause level only at a supervision boundary whose policy is to report and continue, such as a forked worker. There, log the complete `Cause` first, since it holds every failure, defect, and interruption, and keep interruption passing through.

```ts
yield* Effect.forkScoped(
  backfill.pipe(
    Effect.tapCause((cause) => Effect.logError("An index backfill failed", cause)),
    Effect.retry({ schedule: Schedule.exponential("1 second"), times: 3 }),
    Effect.catchCauseIf(
      (cause) => !Cause.hasInterrupts(cause),
      (cause) => Effect.logError("An index backfill gave up", cause),
    ),
  ),
);
```

Convert a `Cause` into something smaller only after it has been logged whole. `Cause.squash` keeps the first failure or defect and drops the rest, so it is for deriving text a person reads and nothing else.

## Absence

The shape of a lookup says what a missing value means. When the caller cannot go on without it, the lookup fails with a typed error such as `DocumentNotFoundError`. When absence is an ordinary result, the lookup returns an `Option` or `undefined` and never fails for it.

When both meanings are real for the same lookup, the service exposes them side by side. The strict operation keeps the plain name and fails with the domain error. `<name>Option` returns an `Option` and `<name>OrUndefined` returns `undefined`. Each variant reads the underlying state itself, so no variant is built by catching another's error. A caller picks the variant that matches what absence means at its call site.

```ts
return {
  firstOption: Effect.map(first, Option.fromNullishOr),
  firstOrUndefined: first,
};
```
