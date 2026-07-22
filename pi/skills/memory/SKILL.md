---
name: memory
description: Distill corrections and preferences from the conversation into persistent memory files so learnings carry over to future sessions. Use when the user corrects your code or approach, refactors your output, explains why something was wrong, gives guidance on coding style, principles, patterns, architecture, testing, or best practices, corrects domain terminology or naming, or says "remember this".
---

Distill what the user taught you into a **learning**: the general rule behind the specific correction. A learning is never about a file, line, or this task's code — it is the preference the user would have stated up front if asked. From "move this validation up to the endpoint" distill "validate at the outermost layer, where side-effects happen".

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

1. Distill the learning. Grep both stores for an existing entry covering it — when one exists, propose an edit to that entry instead of a new one.
2. Propose it, exactly in this shape:

    > **Slug**: name-slug
    > **Kind**: global/principles, project/database, global/lang/elixir, …
    > **Description**: one sentence — what this is / when it applies
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

- **name-slug** - short one sentence description of what-is-this/when-to-use

# Memories

---

**name-slug**

{The memory — concise, the general learning}

## Examples

{only when a snippet carries the point better than prose}

---
```

New entries append after the last `---`; their index line appends to `# Index`.
