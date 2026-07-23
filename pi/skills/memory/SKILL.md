---
name: memory
description: Distill corrections and preferences from the conversation into persistent memory files so learnings carry over to future sessions. Use when the user corrects your code or approach, refactors your output, explains why something was wrong, gives guidance on coding style, principles, patterns, architecture, testing, or best practices, corrects domain terminology or naming, or says "remember this".
---

Distill what the user taught you into a **learning**: the standing convention that surfaced through the correction. The conversation is only the episode — no residue of it survives into the memory:

- Write in timeless present, as how things are done — "validation lives at the outermost layer, where side-effects happen" — never as a transformation of existing code ("move/replace/change X to Y"). The memory must read the same whether authoring new code or refactoring old code.
- Swap the feature, module, or (for global) project where the learning surfaced: memory, description, and triggers must read unchanged. Names from the current code belong only in `domain.md` memories.
- Triggers are tokens that recur wherever the convention applies — library APIs, patterns, task phrasings — never identifiers from the current diff.

Write every memory as a positive convention: state the behavior to reproduce, not the mistake to avoid — a prohibition puts the bad pattern in context and gives no target. From "stop creating helpers everywhere" distill "write logic inline at its call site; extract only at a named domain boundary". When a hard guardrail can't be phrased positively, keep the prohibition but pair it with what to do instead.

## Stores

- Global: `~/.config/memories/` — the learning holds in any codebase
- Project: `./.memories/` — the learning is tied to this repo's stack, domain, or conventions

Files inside either store:

- `principles.md` — general coding philosophy and style
- `architecture.md` — system structure, boundaries, layering, module design
- `testing.md` — what to test, how to structure and write tests
- `database.md` — schema modelling, queries, migrations
- `types.md` — type and schema modelling
- `ui.md` — components, styling, UI state
- `domain.md` — domain terms, domain language, domain concepts and how they relate; almost always project, not global
- `lang/<language>.md` — language-specific (e.g. `lang/typescript.md`, `lang/elixir.md`)
- `library/<library>.md` — library/framework-specific (e.g. `library/react.md`, `library/effect.md`)

Most specific file wins: a TypeScript-only typing preference goes to `lang/typescript.md`, not `types.md`. The seven top-level files are a fixed set — create `lang/` and `library/` files on demand, never new top-level files.

## Flow

1. Distill the learning. Grep both stores for an existing entry covering it — when one exists, propose an edit to that entry instead of a new one. And note: getting corrected on something an entry already covers means that memory failed to fire — its description didn't match the situation, or its body didn't land. Rework it against the miss: sharpen the description so the index line matches situations like this one, and restate the body so it would have prevented the mistake.
2. Propose it, exactly in this shape:

    > **Slug**: named like a lint rule — a short kebab-case prescription of the behavior the memory enforces, readable on its own (ESLint/Credo style): `validate-at-boundaries`, `inline-types-at-use-site`, `prefer-rewrite-over-polish`. A topic label (`validation-handling`, `typescript-style`) is not a slug.
    > **Kind**: global/principles, project/database, global/lang/elixir, …
    > **Description**: one sentence — what this is / when it applies
    > **Triggers**: optional — 3–6 concrete tokens the agent will literally face when this memory applies: function/module/API names, error messages, task phrasings. Skip when the description alone matches.
    >
    > {The memory}

    and prompt: **approve / decline / edit**.

3. Write only after an explicit approve. On decline, drop the learning for good. On edit, revise and re-present.
4. On approve, append the entry and its index line in the same edit. Create a missing file from the skeleton below.

Usually a correction distills into a single memory, but a conversation can yield several learnings, and occasionally one learning genuinely spans files — e.g. a general rule for `global/principles` plus a language-specific nuance for `project/lang/elixir`. When that happens, route each piece to its own file and store, mixing global and project freely, and propose each memory separately.

## File format

Every memory file:

```markdown
# Index

- **name-slug** - short one sentence description of what-is-this/when-to-use [triggers: useEffect, subscription, cleanup]

# Memories

---

**name-slug**

{The memory — concise, the general learning}

## Examples

{only when a snippet carries the point better than prose}

---
```

New entries append after the last `---`; their index line appends to `# Index`.
