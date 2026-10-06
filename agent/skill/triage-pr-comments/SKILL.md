---
name: triage-pr-comments
description: Triage the review comments on a pull request. Use whenever you look at, address, or act on PR comments.
---

# Triage PR comments

Most comments on a PR now come from AI reviewers. They chase edge cases this product never meets, pull the work past what the PR set out to do, and ask for defensive code that guards nothing real. Every comment is a hypothesis. You test each one through the funnel and act only on what survives. The PR ships what it set out to do, with the real problems fixed and nothing added out of fear.

## 1. Collect

Read the PR's title, description, linked issues, and diff, and write its intent in two sentences before you read any comment.

In the project's checkout, run `node <skill folder>/pr-comments.ts collect`, where `<skill folder>` is this skill's folder. It prints every comment on the current branch's PR, or on the PR you were given, that does not carry our 🚀 yet. Turn the comments into findings:

```
finding
  claim     what is wrong, in one sentence, in your words
  where     path:line
  sources   every comment that raised it, by id
```

One review body often holds many findings, including folded nitpicks and "outside diff range" sections. One finding raised by several reviewers is one finding with several sources. A comment with nothing to test, such as a walkthrough summary, is a notice.

A finding about something we already met while building this PR and decided not to tackle is a decline that names that decision. It goes to no investigator.

Done when the intent is written and every collected comment is a source of a finding or a notice.

## 2. Investigate

Group findings that one agent should investigate together, because the code and context they need overlap. A finding that shares nothing with the others gets its own agent.

Send each group to its own subagent, all in parallel. Give each one the PR's intent, its findings with their full threads, and the funnel section of this file. Investigators read and run code, and leave the working tree as they found it. A claim about behavior is true only when a run shows it, such as a failing test or a script and its output. Each returns, for every finding:

```
verdict   fix, decline, defer, or ask
reason    the funnel check that decided it, with the evidence: path:line, a command and its output, or the fact only the user knows
remedy    for a fix, the smallest change at the right layer
```

Done when every finding has a verdict with evidence behind it.

## 3. Report

Read every verdict and its evidence. You own each one. Where the evidence does not hold, decide the verdict yourself. When three or more findings attack variations of one mechanism, such as a third edge case of one guard, the mechanism itself becomes an ask instead of the next fix.

Show the user the asks and fixes in full, and the defers and declines one line each:

```
Ask
  path:line · reviewers · the claim
    what you need from the user, and the options
Fix
  path:line · reviewers · the claim
    the evidence, then the remedy
Defer   path:line · the claim · why it waits
Decline path:line · the claim · the check it failed
Notices: their count
```

Done when every finding and notice appears once.

## 4. Discuss

Go through the report with the user. They answer the asks, change any verdict they disagree with, and tell you to go ahead. Verdicts they don't mention stay as they are. If they want to leave something for later, leave it. It comes up again the next time you triage this PR.

On autopilot, when the user told you to handle PR comments without them, as a babysit skill does, there is no discussion. Act on every verdict except the asks, and leave those for the user.

Done when the user has answered every ask and told you to go ahead, or right away on autopilot. Then read `ACTING.md` in this skill's folder and follow it.

## The funnel

Each finding goes through five checks in order and leaves at the first one it fails.

| Check | Passes when | Often fails on |
|---|---|---|
| Current | the code the comment describes is still there | an outdated thread whose code moved or changed. Search the file for the symbol before failing it |
| True | the code does what the comment claims | a misread of the code, an API the installed version lacks, a case the callers already handle |
| Reachable | a real user of this product can trigger it today | two tabs editing one thing, users or organisations we don't have, input the types or schema rule out, scale we don't run at, consumers that don't exist |
| In scope | fixing it belongs to the PR's intent. A defect this PR introduced always does | "while you're at it", a refactor of nearby code, an option or abstraction for a future need, a problem in code the PR didn't touch |
| Worth it | the failure costs more than the code that prevents it | a null check the types rule out, a catch that hides an error, a guard repeated at an inner layer, a style preference no project rule backs, a failure that already surfaces loudly before it costs anything |

Facts about the product come from `AGENTS.md`, the README, and the docs. A fact none of them settles is the user's to give.

A finding that fails current, true, reachable, or worth it is a decline. One that fails in scope is a defer. One that turns on a fact only the user knows is an ask. One that passes all five is a fix.

The remedy for a fix is yours, not the reviewer's. Fix the cause at the layer that owns it. A type that makes the bad state impossible beats a runtime check, and an error that stays loud beats a fallback that hides it.
