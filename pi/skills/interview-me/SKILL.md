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

The interview should not be bothered with:

- validation gates that need to be run, these should be configured and defined by the projects docs, AGENTS.md, etc. It's not part of this process
- What tests need to be written? The interview should care about defining the behaviors and these behaviors during the implementation time will give birth to the required tests. The interview should not try to look at things from the "should I write this test?" kind of perspective.

Before starting the actual interview, you should do research and code exploration and start by presenting a first draft of the goal, even if that draft is naive, partial, or incomplete. Ask the user for any initial feedback on this first draft and then start the interview process.

If at any point during the interview the user asks to see the current state of the goal, create a draft based on the understanding you have so far. Ask for any feedback and then continue the interview until you reach the point where you feel confident to present a final draft.
