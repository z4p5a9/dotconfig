---
name: coding
description: Naming and form conventions for code in any language. Use whenever you name or declare a function, value, identifier, or type, extract or inline a helper, choose a function's arguments, or write TypeScript.
---

# Coding

Every rule here is language neutral, and the language's own casing convention applies on top. A section named after a language holds the rules specific to it.

## Identifiers

An identifier is always named with its owner, `harnessId` and `Harness.HarnessId`, never a bare `id` or `Id`, because a bare id travels through code that handles several of them. Every other export of a module leans on the module's qualifier, `Agent.Slug`, `Agent.Ref`, and does not repeat it.

## Functions

- A predicate is `has` or `is`, `hasSession`, `isRunning`.
- A converter is `to` followed by its target, `toSessionTarget`, `toEnvFlags`.
- A lookup is `get` with the suffix that says what a miss returns, `getPaneOrUndefined`, `getPaneOption`, and the plain name when a miss is a failure.
- A function takes the narrowest argument it uses, a `Flock.Slug` rather than the whole ref.
- A general operation is named for what it does, never for the first caller that needed it. `Process.foreground` brings a process to the foreground, and the caller that attaches to it is one of its users.

## Single use

A value with one use is written at that use, folded into the expression that needs it. A function with one caller is written in its caller. A name is earned by a second reference, or by an expression too long to read in place. This holds for plain values, schemas, and effects alike.

## TypeScript

- Trust the type system. A value the types guarantee needs no runtime check.
- Let the compiler infer types rather than writing them out.
- A function that only renames or casts another is inlined at its callers.
