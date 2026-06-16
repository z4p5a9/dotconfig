---
name: interview-me
description: Interview me to turn a rough feature or change idea into a precise implementation goal/spec before planning or coding.
disable-model-invocation: true
---

Interview me relentlessly about every aspect of my goal until we reach a shared understanding and you can present my goal in the form of [GOAL_FORMAT.md](./GOAL_FORMAT.md).

Use [examples](./examples) as style references.

Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. Ask questions one at a time, waiting for feedback on each question before continuing. For each question, provide your recommended answer.

- If a question can be answered by exploring the codebase, explore the codebase instead. Do not guess existing codebase facts.
- If a question can be answered by researching, do a research then. Do not guess facts that can be validated by external resources.
- If a question can be answered from the current conversation context, and previous answers the user gave, infer your answer from that context. Do not keep asking the user same questions with different phrasing, but also don't make guesses or assumptions, when needed clarify.

During the interview, lock down:

- entry points
- public behaviors
- required migrations
- required schemas/contracts
- required packages
- required third-party services
- dependencies on existing modules/functions/types/schemas
- intentionally out-of-scope adjacent cases
- implementation decisions that are not obvious from existing code
- codebase references and external context
