---
name: commenting
description: Conventions for writing comments in any language. Use whenever you write or edit a comment, doc block, or module header.
---

# Commenting

Every rule here is language neutral. Translate it into the project's comment syntax and doc tool before applying it. Examples are pseudo-code.

## 1. Decide whether the comment earns its place

A comment carries a fact the code cannot show. The reason behind a constant's value, the invariant a block preserves, the ordering the caller must respect, the platform quirk a branch works around, when to pick this function over its neighbour. The signature, the name, and the type already carry what they carry, and a comment that repeats them gets deleted.

Two tests. Would a junior dev on their first day have to stop and look something up, or read the code twice, to get what the comment says? Then it earns its place. Would the comment still be true after the code below it is renamed or reordered? Then it is stating a reason, which is the only kind of fact that lasts.

Done when every comment you plan to write names the fact it carries.

## 2. Write the comment

### Voice

Present tense, third person, literal and technical. The reader is a junior dev on their first day. A comment states a fact. It does not persuade, hedge, apologise, joke, or address the reader.

### Self-contained

A comment is complete on its own. It calls things by the names a reader would search for and carries its own reason rather than pointing at another comment or a document elsewhere.

### Doc block

A doc block is read at the call site, without the file open, so it stands alone there. The first sentence says what the symbol is or does, and for most symbols it is the whole comment.

Whatever the first sentence and the signature do not carry goes below, one paragraph or list per kind of fact:

- When to use it. Which of its alternatives this one is for, opening with "Use when", "Use to", or "Use over".
- Details. Behavior the caller cannot guess, a side effect, an ordering to respect, a limit on the input. Prose for one fact, a list for two or more.
- Gotchas. The trap stated flat, then the way out. "The handler must not throw. A thrown value becomes a crash, not an error. Use try when throwing is expected."
- An example, per the section below.

Whether these carry a heading, and how, follows the project's doc tool.

### Module header

One sentence naming the module's job, opening with a verb. Then at most one paragraph on what the module contains and the shape of its central type.

The header sits at the start of the file or of the module declaration, whichever the language uses, with an empty line between it and the imports.

```
Parses the CLI arguments into a Command.

A Command is one of run, build, or test, each with its own option record. The parser
rejects unknown flags and applies no defaults, the caller fills those in.
```

### Function

The first sentence opens with a verb, "Creates", "Returns", "Checks". The signature carries the parameters, the return value, and the error types, and prose never restates them.

```
Returns the user's display name, falling back to the email when no name is set.

Use over formatName when the value is shown to the user. formatName returns an empty
string for a missing name, this never does.
```

### Type

The first sentence says what the type represents, "Represents a time range", "Configuration for the HTTP client", "The tag that names an error". The fields carry their own names and types, so the sentence stays at the level of the whole. When an invariant holds across the fields, it follows in the same sentence or the next.

```
Represents the time range between two instants, where start is always before end.
```

### Property

A property gets a doc block only when its name and type do not already carry its meaning. A unit, a bound, a default, what happens when it is left out, or a relation to another field.

```
Configuration for an outbound request.
  timeout: Duration       Total budget, including connection setup and retries.
  correlationId: String   Forwarded unchanged to downstream services.
```

### Inline comment

An inline comment is read with the file open, by whoever is changing the code next to it. It carries one reason the code cannot show, on the line or block it protects. The invariant being kept, the ordering that must hold, why a constant has its value, the platform quirk a branch works around.

Code whose reasons are visible reads bare. A comment that names the section below it, or narrates what the next line does, gets deleted.

Inline comments are scarce. Needing one every dozen lines means the code hides its reasons, and the fix is clearer names and structure.

```
// The payment provider blocks the card after three failed charges in a row.
const attempts = 3

// Safari reports 0 for scrollHeight until the first paint.
if height == 0 then schedule(measure)
```

### Example

An example belongs on a symbol that another project imports, when the call shape or the outcome is not obvious from the signature. Code inside the project reads its own call sites and needs none.

Around ten lines, one insight, written exactly as the consumer writes it, imports included, through the package's public entry points. The outcome is shown next to the call that produces it. An example that only restates the first sentence gets deleted.

```
import { parseDuration } from "@acme/time"

parseDuration("1h30m")  // => Duration(minutes: 90)
parseDuration("90")     // => fails with MissingUnit
```

## 3. Reread as the first-day dev

Read every comment you wrote as a junior dev on their first day, with only the code in front of you. Three checks:

- Nothing to look up. Every term either reads plain or carries its own explanation.
- Nothing restated. The comment says nothing the name, the signature, or the type already says.
- A reason, not a description. Delete the code below it and the comment still makes a claim.

Done when every comment passes all three.
