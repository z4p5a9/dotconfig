---
name: writing-oxlint-rules
description: Conventions for writing custom oxlint rules in a JS plugin. Use when creating, editing, reviewing, or testing an oxlint rule, its options, fixes, or plugin registration.
---

# Oxlint rule

Every rule is **portable**: it runs in another project, with other paths, packages, build setups, module systems, and runtimes, by changing only its config. Rules get copied between projects, so anything tied to one repository is a bug.

The installed `@oxlint/plugins` (`index.d.ts`) and `oxlint/plugins-dev` are the authoritative API for the pinned version. JS plugins are alpha and outside semver, so check them before relying on anything in `references/api.md`. The `coding`, `commenting`, and `testing` skills apply alongside this one.

## Steps

### 1. Check that nothing covers it already

Look, in order, for a native oxlint rule (`oxlint --rules`), a configurable native ban (`no-restricted-imports`, `no-restricted-properties`, `no-restricted-globals`), a type-aware `typescript/*` rule, a compiler option, or a diagnostic of a language service the project already runs.

Done when you can name what covers the check, or name why each of them falls short.

### 2. Pin down the concern

A rule has **one concern**: one thing it reports, so a project can turn it off without losing anything else. Write the code it reports and the code it accepts before writing the rule, including the near misses:

- a local binding that shadows the name the rule looks for, like a parameter named `it` or a local `pipe`
- the construct reached through an aliased import, a namespace import, and a subpath import of the library
- the construct wrapped in parentheses, `as`, `satisfies`, or `!`
- a union nested inside a union, or wrapped in parentheses
- every member of the API family, like each fork variant or each `fn` variant, not only the common one
- every declaration form of the thing: declaration and expression, class member and parameter property, type alias and interface, function and signature
- comments inside the code a fix replaces

Done when every case is a concrete snippet marked reported or accepted, and each reported one has the message it gets.

### 3. Write and test it

Follow the sections below: layout, naming, the rule body, options, messages, fixes, portability, and testing.

Done when every case from step 2 is a test case, every messageId, option, fix, and suggestion has one, and the tests pass.

### 4. Register and turn it on

Add the rule to its plugin's `index.ts`, then enable it in the project's oxlint config with its options, scoped with `overrides` where it applies to some files only. Run the plugin's tests and typecheck, then lint the whole project.

Done when the project lints clean with the rule on, and every existing violation is fixed or sits outside the rule's `overrides.files`.

## Layout

Follow the project's plugin package when one exists. Otherwise:

```text
tools/oxlint-plugins/
  package.json               "exports" maps each plugin to its index.ts
  src/setup.ts               wires RuleTester into vitest
  src/<plugin>/index.ts      default export: eslintCompatPlugin({ meta: { name }, rules })
  src/<plugin>/rules/<rule-id>.ts
  src/<plugin>/rules/<rule-id>.test.ts
  src/<plugin>/shared/<topic>.ts
  fixtures/<rule-id>/        files a filesystem-reading rule's tests point at
```

- The package imports nothing from the rest of the repository, so it moves to another project unchanged.
- A plugin groups rules by what they need to know. Rules for any TypeScript go in one plugin, rules for a specific library in its own plugin named `<plugin>-<library>`.
- A rule file exports one `const <ruleIdInCamelCase>Rule = defineRule({ ... })` with a one-line doc comment in the third person ("Disallows ...").
- `index.ts` imports each rule and lists it under its id, sorted by id.
- A helper moves into `shared/` once a second rule needs it.

## Naming

A rule id is kebab-case. Its family and the verb opening `meta.docs.description` agree:

| Family | Reports | Description opens with |
|---|---|---|
| `no-<thing>` | a construct that is banned | Disallow |
| `require-<thing>` | a construct that is missing | Require |
| `<a>-matches-<b>` | two names that must agree | Require |
| `prefer-<form>` | the worse of two equivalent forms | Prefer |
| `consistent-<thing>` | a form other than the configured one | Enforce |
| `<thing>-order` | a sequence out of order | Enforce |
| `padding-<where>` | missing or extra blank lines | Require |

The description is one sentence that names exactly what the rule reports: `Disallow Effect.sleep inside a loop of an Effect generator.`

## Rule body

```ts
type Options = { readonly extension: string | null };

/** Requires ./ imports to end in the configured extension. */
export const consistentSiblingImportRule = defineRule({
  meta: {
    type: "problem",
    fixable: "code",
    docs: { description: "Enforce the configured extension on ./ imports." },
    messages: { extension: 'A sibling import {{form}}. Import "{{expected}}".' },
    schema: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          extension: { type: ["string", "null"], description: "Extension ./ imports end in." },
        },
      },
    ],
    defaultOptions: [{ extension: null }],
  },
  createOnce(context) {
    let options: Options;

    return {
      before() {
        // oxlint-disable-next-line typescript/consistent-type-assertions, typescript/no-unsafe-type-assertion -- oxlint validates options against meta.schema and merges meta.defaultOptions
        [options] = context.options as readonly [Options];
        return options.extension !== null;
      },
      ImportDeclaration(node) {
        // cheap checks first, then build data and the fix
      },
    };
  },
});
```

- Use `createOnce`. Read options and reset per-file state in `before`, and return `false` from it to skip a file the rule has nothing to say about.
- `meta.type` is `problem` for code that is wrong or breaks a project rule, `suggestion` for a better form of working code, and `layout` for whitespace.
- Find a library's local names from the file's import declarations, in both the named and the namespace form, once per file. A call counts only when its namespace was imported from that library.
- Resolve a global through `context.sourceCode.getScope(node)`, so a local binding with the same name is never reported.
- Visit the most specific node type and return early. An esquery selector (`'CallExpression[callee.property.name="sleep"]'`) is fine when it reads shorter than the guards it replaces.
- JS rules see syntax only, with no type information. A rule reports what the file's syntax proves and accepts that it misses the rest. Resolving aliases or declarations across files is rebuilding a type checker; push that check to a type-aware tool (step 1) instead.
- Read the filesystem only when the concern is about the filesystem, and cache each lookup in a module-level `Map` keyed by directory.

## Options

A rule takes options when a value it checks against, writes, or names differs between projects: paths, prefixes, extensions, package names, allowed names, words. The concern itself is never an option.

- One object option. Every property has a `description` and a default in `meta.defaultOptions`, never a schema `default`. `additionalProperties: false`.
- Read it as a typed `Options` from `context.options[0]`, as in the rule body above. oxlint has already validated it against the schema, merged the defaults under it, and frozen it, so the rule narrows nothing by hand.
- `Options` mirrors the schema. A list field is `Array<T>`, because oxlint types options as JSON whose arrays are mutable, and a `ReadonlyArray` field makes the assertion fail to compile.
- Defaults are neutral. A list defaults to empty. A check that needs a project value stays off until that value is configured.
- A boolean defaults to `false`, so adding one never changes an existing config's behavior. Name it for what `true` turns on, like `allowInTypeGuards`.
- Values that identify the library a plugin targets, like the `effect` module source in an Effect plugin, are constants, not options.

## Messages

Every report uses a `messageId`. Ids are camelCase and name the case, not the rule.

A message states the problem, then the fix, in the code's own words, with code in backticks and every variable part as a `{{placeholder}}`:

```ts
mismatch: 'The key "{{actual}}" must be "{{expected}}".',
run: "`{{call}}` skips the test clock. Return the effect and let it.effect run it.",
```

A reason fits in a clause when the fix alone would look arbitrary. A message names only things the rule knows exist. Advice about a project's own modules or services comes from an option.

## Fixes and suggestions

- A **fix** rewrites code when the result behaves the same and there is exactly one right answer: a key, a path, an import form, whitespace. `oxlint --fix` applies it. Set `meta.fixable` to `"code"`, or `"whitespace"` for layout rules.
- A **suggestion** offers a rewrite that may change behavior, or one of several valid rewrites. `oxlint --fix-suggestions` applies it. Set `meta.hasSuggestions: true`, and give each suggestion its own messageId that says what it does.
- Report without either when the right code depends on intent.

A fixer returns `null` for the cases in which it does not apply. A fix keeps comments, parentheses, statement boundaries, `type` modifiers, and import attributes, and writes line breaks the way the file already does. When the replaced range holds a comment, report without the fix. The fixed code passes the rule.

## Portability

- Paths, package names, prefixes, and extensions come from options, or from `context.filename` and the nearest `package.json`. A rule never holds an absolute path or a repository's folder name.
- Which files a rule runs on is the config's job, through `overrides.files`. A rule reads `context.filename` only when the file's name or location is its concern, as when a key must match the file.
- A rule that applies outside tests is turned off for test files in the config. It never matches `.test.` itself.
- Import paths are read as written, with or without an extension, relative or through a subpath import. The form a fix writes comes from an option.
- Paths are split with `node:path`, so separators work on every platform.
- Runtime globals a rule restricts (`process`, `window`) come from options, unless the plugin targets that runtime.

## Testing

A rule's tests sit beside it as `<rule-id>.test.ts` and run `RuleTester` from `oxlint/plugins-dev` through the package's vitest setup file:

```ts
const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("consistent-sibling-import", consistentSiblingImportRule, {
  valid: [{ name: "accepts an import with the extension", options: [{ extension: ".ts" }], code: `import * as View from "./View.ts";` }],
  invalid: [
    {
      name: "rewrites an import without the extension",
      options: [{ extension: ".ts" }],
      code: `import * as View from "./View";`,
      output: `import * as View from "./View.ts";`,
      errors: [{ messageId: "extension", data: { form: 'ends in ".ts"', expected: "./View.ts" } }],
    },
  ],
});
```

- Every case has a `name` that opens with what the rule does: "accepts", "ignores", "reports", "rewrites", "suggests".
- Every invalid case asserts `messageId` and `data`. A reported case the rule does not fix has `output: null`. A suggestion is asserted with `suggestions: [{ messageId, output }]`.
- Names and paths are neutral: `@acme/core`, `/repo/src/view/View.ts`.
- A rule that reads the filesystem is tested against `fixtures/<rule-id>/`.

## References

- The context, source code, fixer, options merge, RuleTester behavior, or config and loading details: read `references/api.md`.
