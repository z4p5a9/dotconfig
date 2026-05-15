---
description: Use this when you need a harsh AI-slop/code-cleanliness review by the `deslopper` agent.
---

Spawn the `deslopper` sub-agent to review code for AI slop, unnecessary abstractions, fake architecture, noisy helpers/types/variables, public-surface creep, fragile state, and hollow tests.

The `deslopper` agent is very harsh and direct. Do not call it with vague instructions like “review this code”.

Before spawning it, give enough context so it knows what is approved versus what is open to critique:
- what this code/change is trying to do
- relevant plan/user-approved decisions
- approved architecture/design choices
- module or grid boundaries
- intended public surfaces/contracts
- what is explicitly out of scope

Only describe something as approved if it was explicitly stated by the user or in a plan/document handed to you. Do not infer approval just because the current implementation does it or because it seems reasonable.

The goal is not to make `deslopper` polite. The goal is to aim it correctly so it attacks real AI slop instead of wasting time criticizing explicitly approved decisions.

Use read-only/review-only by default unless the user explicitly asks for fixes.
