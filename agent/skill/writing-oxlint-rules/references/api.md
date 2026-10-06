# Oxlint JS plugin API

Facts checked against oxlint 1.85 and 1.86. The installed `@oxlint/plugins` `index.d.ts` wins where it disagrees.

## Rule shape

```ts
defineRule(rule: Rule): Rule                     // identity, for types only
eslintCompatPlugin(plugin: Plugin): Plugin       // adds an ESLint `create` that delegates to `createOnce`
type Plugin = { meta?: { name?: string }; rules: Record<string, Rule> }
type Rule = { meta?: RuleMeta; create?: (context: Context) => Visitor; createOnce?: (context: Context) => VisitorWithHooks }
type VisitorWithHooks = Visitor & { before?: () => boolean | void; after?: () => void }
```

- The plugin is the module's default export.
- `createOnce` runs once per rule at load time. When both exist, `create` is ignored.
- Inside the `createOnce` body, reading `context.filename`, `sourceCode`, `settings`, `cwd`, or calling `report` throws, and `context.options` is `null`. Read them in `before` or in a visitor.
- `before` runs before each file's walk. Returning `false` skips the file and its `after`. oxlint may later skip `before` for files with no node the rule visits, so a report that must happen on every file belongs in `Program`.
- `after` runs after `Program:exit`, even when a visitor throws.
- A `createOnce` visitor with hooks and no node visitors never runs.
- Selectors follow esquery: attributes, `:matches`, `:not`, combinators, and `:exit`.
- Code path listeners (`onCodePathStart` and the rest) work.

## Meta

oxlint reads only `fixable`, `hasSuggestions`, `schema`, `defaultOptions`, and `messages`. `type`, `docs`, and `deprecated` matter only to ESLint and doc generators. Diagnostics carry no docs URL.

## Context

```ts
context.id                 // "<plugin>/<rule>"
context.options            // Readonly<JsonValue[]>, validated, defaults merged, frozen
context.settings           // the config's whole top-level `settings`, the same for every override
context.filename, context.physicalFilename, context.cwd
context.languageOptions    // sourceType, ecmaVersion, parserOptions, globals
context.report({ node | loc, messageId, data?, fix?, suggest? })
```

- `loc` lines are 1-based and columns 0-based.
- `data` values are strings, numbers, booleans, bigints, `null`, or `undefined`. An unknown `messageId` throws.
- `report` does not use `this`, so `const { report } = context` works.

`context.sourceCode` carries `text`, `ast`, `lines`, `visitorKeys`, `scopeManager`, `getText(node?)`, `getAncestors(node)`, `getScope(node)`, `getDeclaredVariables(node)`, `isGlobalReference(node)`, the comment helpers (`getAllComments`, `getCommentsBefore`, `getCommentsAfter`, `getCommentsInside`, `commentsExistBetween`), the ESLint token helpers, `getDisableDirectives()`, and `node.parent` on every node.

Not available:

- `parserServices` is `{}`. No type information, and no way to plug a rule into the type-aware `typescript/*` rules, which run in the Go binary `oxlint-tsgolint`.
- `getJSDocComment` throws.
- `markVariableAsUsed` does not reach the native `no-unused-vars`.
- Custom parsers, and files other than JS and TS (Vue, Svelte).
- Context methods ESLint removed in v9, such as `context.getScope()`.

## Fixes

```ts
type FixFn = (fixer: Fixer) => Fix | Array<Fix | null> | Iterable<Fix | null> | null
fixer.replaceText(node, text)   fixer.replaceTextRange([start, end], text)
fixer.insertTextBefore(node, t) fixer.insertTextBeforeRange(range, t)
fixer.insertTextAfter(node, t)  fixer.insertTextAfterRange(range, t)
fixer.remove(node)              fixer.removeRange(range)
```

- All fixes of one report merge into one edit. Overlapping fixes produce an "invalid fixes" diagnostic.
- Reporting a `fix` without `meta.fixable` throws. Reporting a suggestion that produces a fix without `meta.hasSuggestions: true` throws.
- `"code"` and `"whitespace"` behave the same in oxlint.
- A `fix` is applied by `--fix`, a `suggest` entry by `--fix-suggestions`, which also applies fixes. JS rules cannot emit the dangerous kind that `--fix-dangerously` applies.

## Options

- Validation is AJV with JSON Schema draft-04. `schema: [a]` is shorthand for an array of at most one item shaped `a`.
- No schema, or `schema: []`, means the rule accepts no options, and configuring any is an error. `defaultOptions` without a schema throws at load.
- Merge order is config over `defaultOptions` over schema `default`. Objects merge deeply. Arrays are replaced, not merged.
- Inline comments cannot change options.

## RuleTester

```ts
import { RuleTester } from "oxlint/plugins-dev";
new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } }, cwd? })
tester.run(ruleId, rule, { valid: Array<string | ValidCase>, invalid: Array<InvalidCase> })
// case: { name, code, options?, settings?, filename?, output?, errors: [{ messageId, data?, line?, column?, suggestions? }] }
```

- Wire it into vitest once, in a setup file: `RuleTester.describe = (title, body) => { describe(title, body); }; RuleTester.it = it;`.
- Columns are 0-based unless the tester gets `eslintCompat: true`.
- An invalid case of a fixing rule must give `output`. `output: null` asserts no fix. `output` equal to `code` fails.
- A suggestion must give its `output`. `data` without `messageId` fails. Duplicate cases fail.
- `sourceType` defaults to `"unambiguous"`, and the filename to `file.<lang>`. Pass an absolute `filename` when the rule reads it, and `cwd` when it depends on it.
- It needs Node 22 or newer.

## Config and loading

```ts
jsPlugins: ["./path/plugin.ts", "package-name", { name: "alias", specifier: "package/subpath" }]
```

- A specifier resolves relative to the config file.
- The plugin's name comes from the alias, else `meta.name`, else the package name. `eslint-plugin-` and `oxlint-plugin-` prefixes are stripped. Native plugin names (`unicorn`, `typescript`, `import`, `jsdoc`, `vitest`, and the rest) are reserved. Two plugins with one name fail to load.
- `categories` never turn on JS rules. Each is listed in `rules`, so a preset is an exported rules object the config spreads.
- `overrides` entries take `files`, `excludeFiles`, `rules`, `jsPlugins`, `plugins`, `env`, and `globals`, but not `settings`.
- TS plugin files load without a build through Node's type stripping: erasable syntax only (no enums, namespaces, or parameter properties) and explicit `.ts` import extensions. TS inside `node_modules` fails to load, so a plugin published to npm ships JS. A workspace package works because Node follows the symlink out of `node_modules`.
- `// oxlint-disable-next-line plugin/rule` and the `eslint-disable` forms suppress JS rules. `reportUnusedDisableDirectives` reports unused ones.
- `oxlint --debug=timings` shows time per rule, JS rules included.
