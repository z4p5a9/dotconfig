---
description: Use this when you want to use the `architect` agent to propose high-level architecture decisions for a concept, task, plan, code area, workflow, or system behavior.
---

Spawn the `architect` sub-agent to analyze an architecture target and recommend the system shape.

Use it for decisions about boundaries, modules, public contracts, state shape, ownership, data flow, failure behavior, recoverability, friction, and tradeoffs.

Do not call it with vague instructions like “think about the architecture”. Give it a concrete architecture target and the decision you need from it.

Before spawning it, give enough context so it knows what is fixed and what is open:

- the concept, task, plan, workflow, behavior, or code area to analyze
- the architecture decision being asked for
- relevant files, docs, plans, constraints, and examples
- approved architecture/design decisions
- expected behavior and out-of-scope behavior
- boundaries, public contracts, or dependencies that are already fixed

Only describe something as approved if it was explicitly stated by the user or in a plan/document handed to you. Do not infer approval just because the current implementation does it or because it seems reasonable.

The goal is one clear architecture recommendation by default. Ask for options or tradeoffs only when they are actually useful.
