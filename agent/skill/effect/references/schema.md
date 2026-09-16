# Schema

Use this when modeling data, wire or storage shapes, brands, variants, optional fields, or decoders.

## Records

A record is a `Schema.Struct` with a type alias of the same name taken from the schema.

```ts
export const User = Schema.Struct({
  id: UserId,
  name: Schema.NonEmptyString,
  email: Schema.optionalKey(Schema.String),
});

export type User = typeof User.Type;
```

Data models are structural schemas. `Schema.Class` and `Schema.TaggedClass` are not used for them. Numbers are `Schema.Finite`, since `Schema.Number` admits `NaN` and the infinities. Add `.annotate({ identifier: "User" })` only when tooling consumes it, such as JSON Schema, OpenAPI, or codegen.

Construct a value with `User.makeEffect(input)` when the input may fail its checks, so the failure stays in the error channel. `User.make(input)` throws on failure and is for trusted input.

## Field reuse

Related contracts share fields by reference instead of repeating them.

```ts
export const CreateUserInput = Schema.Struct({
  name: User.fields.name,
  email: User.fields.email,
});

export const StoredUser = Schema.Struct({
  ...User.fields,
  createdAt: Schema.DateTimeUtcFromString,
});
```

`Schema.fieldsAssign(fields)` adds the same fields to a struct or to every member of a union of structs. `Schema.encodeKeys({ userId: "user_id" })` covers the case where decoded and encoded shapes differ only in key names. `Schema.extendTo` adds fields computed from the decoded value that are stripped on encode, and is rare. When the two shapes differ in behavior, validation, or meaning, the mapping is written out as a function instead of derived by schema.

Reuse builds small related contracts. One large struct that every other struct derives from is inheritance by schema and is avoided.

## Optionality

`Schema.optionalKey(S)` is a key that may be absent. `Schema.optional(S)` is a key that may be absent or hold `undefined`, and it encodes `undefined` as JSON `null`, so it is used only when the contract really has `undefined` in it. `Schema.NullOr`, `Schema.UndefinedOr`, and `Schema.NullishOr` are for contracts where the nullish value itself is data.

A field with a default is a required field in the type. The default is applied with `Schema.withConstructorDefault` for `make`, or `Schema.withDecodingDefault` for an absent key in the encoded form, so the decoded value always has it.

A domain value is not made optional to make construction easier. Optionality is resolved at the boundary that has it, and inner code receives the value.

## Branded values

Every entity identifier is a branded schema, and so is a unit whose raw values could be mixed up, such as milliseconds or cents, and a string or number with a rule of its own, such as an email address or a slug. Display text, counters, and indexes stay primitives until they gain an invariant.

The checks come first and the brand last, so the brand names the checked value.

```ts
export const Principal = Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(200)).pipe(
  Schema.brand("Principal"),
);

export type Principal = typeof Principal.Type;
```

A branded value is only produced by its schema, through `Principal.make` on trusted input or `Principal.makeEffect` when the input may fail, or by decoding. `Schema.isPattern(regExp)` is the general string check. `Schema.isUUID` accepts both hex cases, so an id that must be canonical needs its own pattern.

`Schema.fromBrand` is for a project that already models brands with `Brand.Constructor` and wants the checks packaged with the constructor.

## Variants

A variant that stays inside the process is a `Data.TaggedEnum`. It gives constructors, `$is`, and an exhaustive `$match` with no schema.

```ts
type Step = Data.TaggedEnum<{
  Continue: { readonly cursor: number };
  Finished: { readonly count: number };
}>;
const Step = Data.taggedEnum<Step>();

const label = Step.$match(step, {
  Continue: ({ cursor }) => `continue at ${cursor}`,
  Finished: ({ count }) => `finished ${count}`,
});
```

A variant that crosses a boundary is a `Schema.TaggedUnion`. It decodes and encodes, and carries `cases` for construction, `guards`, and an exhaustive `match`.

```ts
export const Event = Schema.TaggedUnion({
  Started: { runId: RunId },
  Finished: { runId: RunId, result: Schema.Json },
});
export type Event = typeof Event.Type;

const event = Event.cases.Started.make({ runId });
const label = Event.match(event, {
  Started: ({ runId }) => `started ${runId}`,
  Finished: ({ runId }) => `finished ${runId}`,
});
```

A single variant on its own is `Schema.TaggedStruct("Started", { runId: RunId })`.

The discriminator of a contract we own is `_tag`. When a contract needs a custom key, the key names what it discriminates, `kind` by default or a domain word, and never `type`. Each member declares it with `Schema.tag`, as in `Schema.Struct({ kind: Schema.tag("started"), ... })`, and `Schema.toTaggedUnion("kind")` builds the union helpers over them. An external contract keeps whatever key it has. When the encoded form omits the discriminator entirely, `Schema.tagDefaultOmit` fills it on decode and drops it on encode.

## Decoding and encoding

Unknown input is decoded where it enters, and inner code receives the decoded type. This includes database rows, cache hits, responses, and consumed events, even when the same process wrote them, since writing through a schema does not prove the stored bytes stayed valid. The encoded shape stays inside the boundary that owns it.

```ts
const Row = Schema.Struct({ documentId: Schema.Uint8Array, deleted: Schema.Literal(0) });
const decodeRows = Schema.decodeUnknownEffect(Schema.Array(Row));

const rows = yield* sql`SELECT ...`.pipe(Effect.flatMap(decodeRows));
```

A decoder is built once at module level and applied per call. `Schema.decodeUnknownEffect` is the default and fails with `SchemaError` in the error channel. `Schema.decodeEffect` is for input already typed as the encoded shape. `Schema.decodeUnknownResult` is for plain code. `Schema.decodeUnknownOption` is for the rare case where the mismatch details are of no use. `Schema.decodeUnknownSync` throws, and belongs in scripts, tests, and startup paths only. Every decoder has an `encode` twin with the same shape.

JSON goes through a schema too. `Schema.fromJsonString(S)` parses a string and decodes it with `S`, and `Schema.toCodecJson(S)` derives a JSON codec from any schema, following what each type declares for its JSON form. Bytes become base64 and dates become strings without a choice made by hand.

A measured hot path may skip read time decoding under a documented trust invariant, with the unchecked representation kept inside its owner.
