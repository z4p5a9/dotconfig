# Global AGENTS.md

Simpler systems are easier to reason about and more robust.

## Communication

- No sycophancy.
- Never praise the user or his/her work.
- Be direct, straightforward, matter-of-fact, and concise.
- Be critical; challenge my reasoning. Point out potential issues, and ask the hard questions about implementation, scalability, and real-world viability.

## Coding style

- Keep exported/public functions/variables near the top of a file and private helpers after them.
- Order functions from higher-level composition to lower-level helpers so the read flow goes top-down.
- Keep related functions/variables grouped by subject.
- Prefer verbose/inline code from thin wrappers
- Strive for simple and explicit code. More complicated patterns and abstraction should surface and be driven by as the implementations grow.
- Colocation is more important than strict file structure patterns
- don't create helper functions if the function is going to be used only in one place
- don't create small/thin helpers functions even if they are used in two to four places, most of the times for such cases is better to just inline them
- don't create wrapper functions that the only thing they do is hardcode specific argument
- don't create variables that are only used in one place, just inline them
- define variables as close as possible to where they are used

## Test authoring

- Write tests against public APIs and user-visible outcomes.
- Name each test for one behavior, then assert that behavior directly.
- Keep setup focused: create only the data needed for the behavior under test.
- Trust external dependencies/packages and assume that they work as intended
- Use one action path per test (`arrange -> act -> assert`).
- Split compound scenarios into separate tests when the title needs "and".
- Test variations and unhappy paths

## EffectTS

- Do not pass dependencies/resources/services as arguments into other effects/functions. Use `yield* [SomeService]` to obtain what you need inside each effect
- For functions that return effect use `Effect.fn` or `Effect.fnUtranced` instead of a regular function that returns `Effect.gen`
