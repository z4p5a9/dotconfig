---
description: Use this skill whenever code has been written, changed, generated, or reviewed and you need a harsh AI-slop cleanup pass. Use the read-only `deslopper` subagent with real approved context and a concrete target. Do not call it with vague or fake instructions, and do not ask it to soften, rank, deprioritize, or filter findings that are concrete AI slop.
---

Spawn the `deslopper` sub-agent whenever code has been written, changed, generated, or reviewed and you need a harsh AI-slop cleanup pass.

Use it to find:

- unnecessary abstractions, modules, boundaries, helpers, wrappers, utilities, or machinery
- fake architecture or ceremony that was not explicitly approved
- noisy types, noisy variables, one-off names, and pointless indirection
- public-surface creep, unnecessary exports, broad contracts, and broad argument types
- fragile state, branch mess, boolean flags, and impossible states
- hollow tests, mock theater, snapshot noise, and tests that do not prove real behavior

Before spawning it, give enough context so it knows what is approved versus what is open to critique:

- what the code/change is trying to do
- the task, plan, or implementation summary
- approved architecture/design choices
- intended public surfaces/contracts
- out-of-scope work
- any specific files, diff, branch, or implementation slice to review

Only describe something as approved if it was explicitly stated by the user or in a plan/document handed to you.

Do not call `deslopper` with vague or fake instructions like “review this code”, “find important issues”, or “give actionable cleanup suggestions”. If you do that, it will correctly nitpick everything because you did not tell it what was approved.

Do not try to weaken the review by asking it to be polite, balanced, constructive, highest-impact only, blocking-only, non-blocking, ranked, prioritized, deprioritized, or limited to things worth fixing. If something is concrete AI slop, let `deslopper` report it.

Use `deslopper` for critique only. Do not ask it to fix code.
