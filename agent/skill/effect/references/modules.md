# Modules

Use this when creating a file, deciding where a concept lives, writing a barrel, or importing across directories.

## Files

One concept per file, named after the concept, `Head.ts` for the `Head` service and `Envelope.ts` for the `Envelope` schema. Everything the concept owns lives in that file, its errors, its config, its layers. A file that holds no single concept, such as a set of helpers, is kebab-case, and its exports are imported by name, `import { backoff } from "./retry-policy.ts"`.

## Directories and barrels

A directory groups concepts that change together and has one `index.ts` barrel. The barrel re-exports each concept file as a namespace and nothing else. Kebab-case files stay out of it.

```ts
export * as Head from "./Head.ts";
export * as WriteLog from "./WriteLog.ts";
export * as Committer from "./Committer.ts";
```

## Imports

A consumer outside the directory imports the namespaces it needs from the barrel, through the package's subpath alias when it has one, and addresses members through them. The class is `Head.Head`, its layer `Head.layer`, an error `Errors.DecodeError`. Here the alias is `#src`.

```ts
import { Committer, Head } from "#src/log/index";

const committer = yield* Committer.Committer;
const layer = Committer.layerNoDeps.pipe(Layer.provide(Head.layer));
```

With Node's subpath patterns, the mapping in `package.json` carries the extension, `"imports": { "#src/*": "./src/*.ts" }`, because `rewriteRelativeImportExtensions` rewrites `.ts` on relative paths only and rejects it on any other path. That is also why the barrel file is named in the path.

A file inside the directory imports its siblings relatively and as namespaces, `import * as Head from "./Head.ts"`, never through its own barrel. A test imports the module under test the same way. A barrel is therefore never on the import path of its own files, which is what keeps it out of cycles. Two directories that import each other's barrels still cycle, and the fix is to move the shared concept into a directory both import.
