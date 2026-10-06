---
name: glossary
description: Write, edit, and review terms in a project's GLOSSARY.md.
disable-model-invocation: true
---

# Glossary

The glossary is the shared language between you and me on a project. Each term pins one concept to one word, so we both mean the same thing when we use it. A term describes the concept at a high level, never how it works or how it is built, the code is always the source of truth for that. It is our internal language, not the words used in external copy, even when the two overlap.

## File

```md
# Glossary

The internal language of the project, shared by you and me. External copy doesn't follow it.

**you**:
The agent working on this project.

**I/me**:
The human giving you instructions.

**we/us**:
You and me.

**{project}**:
{What the project is, in one sentence.}

**{term}**:
{Definition.}
_Avoid_: {word}, {word}
```

The fixed terms open the file, you, I/me, we/us, and the project's own name. The rest follow in clusters of related terms, so each term sits next to the ones it is defined with. An entry without words to avoid has no `_Avoid_` line.

A project without a glossary gets `GLOSSARY.md` at its root, and this section in its `AGENTS.md`.

```md
## Glossary

The project keeps track of a [glossary](./GLOSSARY.md) in order for both of us to speak the same language. Make sure to read it in full before doing any other actions.
```

## Term

A term is a name, a definition, and the words to avoid in its place.

### Name

- One word, at most two, always lowercase.
- Natural in conversation about the project.
- Reads as is in code, or translates to it directly. `systemPrompt`, `SystemPrompt`, `system_prompt` all read as system prompt, where `instructionsBlob` reads as nothing we say.
- Unambiguous, so neither vague nor jargon. Item, list, service, and object name nothing on their own, where record and journal name one thing each.
- The field's own word where one exists, from its technology, language, or domain. A name someone from the field understands without knowing the project needs less definition. Multiplexer says what tmux is, where session manager makes you guess.

### Definition

A definition is one sentence, two at most. The first says what the concept is, or what it does when its job is what sets it apart, and what separates it from its neighbours. A second sentence carries a rule that holds across terms, such as ownership, how many, or what never happens. A term gets sharper each time another definition uses it, so a definition reaches for a term over a plain word that comes close. Every other word is plain, and an open set gets its members with "such as".

```md
**journal**:
A peer's append-only collection of records, the ones it writes and the ones it pulls from other peers. A peer writes only its own records and never changes a pulled one.

**trimmer**:
Adjusts the start and end of a loop over a media.

**pull**:
A peer fetching from another peer the records its journal lacks.

**settled**:
The state at which an agent isn't doing any active work.
```

### Avoid

The avoid list holds the words either of us would reach for in place of the name. These are its synonyms, the words other projects or libraries use for the same concept, and the neighbouring terms it is easily confused with.

## 1. Read

Read GLOSSARY.md in full, and the code and docs where the concept shows up, or for a review, the code behind every term. When it is unclear where the concept ends and a neighbour begins, ask me before proposing anything. Done when you can name the concept's neighbours in the glossary, what the code calls it, if anything, and every open question is answered.

## 2. Propose

The term is settled in stages, the name first unless I already gave it, then the definition, then the avoid list. Each stage runs this loop.

- You present 4 alternatives as equals, in no order of preference, each different in substance and labelled with one neutral line on how it differs.
- I pick one or more, give feedback, or both.
- You present 4 new alternatives built on my picks and feedback, and the loop starts again.

Done when I approve one for every stage.

## 3. Write

Write the entry exactly as approved. A new term goes in the cluster of the terms it is defined with, and an edited one stays where it is.

## 4. Reread

Reread the whole glossary, not only the entry just written. A review runs 1 and then starts here.

- Is every word in a definition plain or another term?
- Does any definition use a word that another term avoids?
- Is every term spelled as its name, lowercase?
- Would every definition stay true if the code under it were rewritten?

Report every finding to me. Each one I want fixed runs 2 and 3. Done when every check passes, or I chose to leave the finding.
