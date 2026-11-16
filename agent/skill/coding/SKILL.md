---
name: coding
description: Principles and taste for building software, from picking the problem to deciding where the work stops. Use whenever you discuss, plan, write, read, review, or debug code, an app, or a system, built or only an idea.
---

# Coding

Be ambitious about the problem and ruthless about complexity. Pick the biggest problem worth solving, then solve it completely with the least code that does the whole job.

Each section below is an angle, a question to ask of any code, ours or someone else's, built or only proposed. When building, take them in order. When reviewing or discussing, use whichever angles the code raises.

## The goal

What is this for? Name the goal the task serves, one level up, and aim at that. Asked to fix one flaky test, find what makes the suite flaky. A task as stated is often an XY problem. When the goal changes what was asked, bring it to the user before building.

Done when you can name the goal and say whether the task as stated reaches it.

## The source

How does it work today, and why does the problem exist? Work from primary sources, the code, the logs, the error codes, the history, the docs, and the program running. A summary, the user's included, is a lead to check. Cleverness is what gets written when the problem is half understood.

Done when every claim about the current behaviour traces to something you read or ran.

## Prior art

Who already solves this? Restate the task as what it does, in verbs, and find the fields, libraries, papers, and platform primitives that already do that. Use their methods, not their vocabulary. A settings page is "let people change behaviour they rarely touch and find it again later", which interface designers already solve.

Then ask what a top practitioner would add that nobody asked for. Asked to add retries to an API client, they raise idempotency keys, which errors are safe to retry, backoff with jitter, and a retry budget, and they start from the provider's error codes and real failure logs. Propose the idea that sounds insane when it benefits the work.

## The obvious solution

What is the simplest thing that does the whole job? The obvious solution is the one a reader who understands the problem would have written themselves. Simple means the fewest moving parts for the same result. The result itself stays production grade, as complete, as fast, and as hard to break as the job demands. A tutorial version that skips the error handling, concurrency, or scale the job needs solves a smaller problem, and that is a cut in scope, made only on the line below.

The biggest simplicity win is refusing to solve problems we don't have. When a more obvious way exists, push for it, against the user's plan too.

## The line

Which cases does it handle, and which does it leave? Every solution leaves some. Draw the line before building, as a written list of the cases handled and the cases left, with the reason for each. The cases left are the known defects.

- A case is worth handling when a caller the work is for can reach it, and its failure costs more than the code that prevents it. The callers the work is for are the code that calls it today, the feature it is the foundation for, and for a library, API, or tool, every outside project that uses its public surface. Today's call sites are a floor, never the full list.
- Every other case is a known defect and gets no code.
- A known defect fails loudly, with a clear error. A fallback that hides it is a bug.
- A finding past the line, from a review or a stress test, joins the known defects, and the work moves on. The work is done when it meets the line, not when the findings run out.
- When three fixes in a row patch one mechanism, stop and bring it to the user. The mechanism is wrong, or the line is.
- The known defects ship with the work, in the report to the user.

## Trust

Who does a failure land on? Code is trusted when its failure lands on whoever caused it, such as our code calling our code, or a developer's code running in our library through its API or hooks. Code is untrusted when its failure lands on someone else, such as a customer's function running on our servers beside other customers. Intent does not change this, a bug and an attack get the same guard.

- Trusted code leans on the guards that come free. For a hook in a TypeScript library, a `readonly` argument type is enough, and a developer who casts around it owns what follows.
- An untrusted boundary accepts the inputs the happy path needs and rejects everything else with a loud error. One allowlist covers every bad input. Untrusted code runs where its failure stays inside its own limits, such as a sandbox with time and memory caps.
- Parse, don't validate. Data that crosses I/O is decoded once where it enters, then trusted everywhere inside. A config file the user wrote gets a clear parse error, not a sandbox.
- Guard once, at the boundary. A check repeated in an inner layer guards nothing.
- A value the types guarantee gets no runtime check.

## The oracle

What, other than you or the user, shows it is right? Pick the oracle before building, a test that goes red on the bug, the type checker, a benchmark with a number, the real app, the provider's spec. A claim of done names its oracle and what it said.
