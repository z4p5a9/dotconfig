---
name: spiking
description: Find and test designs across models in parallel worktrees, with throwaway code, until one holds. T3 Code only.
disable-model-invocation: true
---

# Spiking

A spike is throwaway code that finds or tests a design. A design here is an abstraction, an architecture, or both. It is where the system is sliced, the surface callers use, and the primitives that surface exposes. On paper every design fits. Code shows where a need doesn't fit, where the surface blocks the implementation or its performance, and where the slice sits in the wrong place. A bad implementation under a good design is cheap to fix later. A good implementation under a bad design is expensive to walk away from. So the design is under test, and the code is the instrument. A spike builds what it needs to load the design honestly, and no more. The code is thrown away. The knowledge is the output.

A good design exposes the right primitives at the right level, so callers compose them with little friction. It hides the decisions the implementation needs free, so the implementation can be fixed, made faster, or replaced beneath it without callers changing.

## 1. Understand

- The problem, and why it is asked for.
- The needs any design must meet, such as features, use cases, scale, and the implementations it must allow. Every spike draws its load from these.
- Any design already in mind or already in the code.
- The current state of the code and everything around it, such as docs, history, issues, dependencies, and data.

Done when every item above is clear.

## 2. Frame

Pick this round's spikes. A spike is one of three kinds.

- A solve meets the problem, or one need, in whatever way it sees fit, and reports the design that came out of its code. Rounds lean on solves while no design is worth studying yet. A later solve starts from what earlier rounds taught.
- A load puts one need on an existing design, either above it as a caller or beneath it as an implementation, and reports where the design broke and where it caused friction. Pick needs that pull the design in different directions, the awkward ones included, and implementations that differ where the design claims to hide a decision.
- A probe tests one fact a design rests on. It is thin, end to end, and through the real risk, so its result can prove the fact false.

Settle by reading whatever reading can settle. Write each load's and each probe's question as a falsifiable hypothesis, which is a claim and the result that would prove it false, before any code. When no design exists, run at least two solves. A design brought to the spike still gets at least one rival solve, because a rival that slices the problem differently is the strongest test of a slice.

Done when every spike of the round has its question, and every load and probe has its hypothesis.

## 3. Spike

Give each spike its own worktree at `~/.t3/worktrees/<repo>/spike-<slug>` on branch `spike/<slug>`, and spawn a child for it with `delegate_task` in async mode, all at once. Pick each child's model by its spike's main demand. The child sees only its brief, so shape each brief around its spike. Tell the child that the design is under test and the code is the instrument, so the code is real on the path that loads the design and crude everywhere else.

The child reports in whatever shape fits what it found, as long as every claim points to the evidence behind it. A solve shows its design as code, meaning the modules, what each one owns, and the interfaces and types at each boundary. Every spike reports its friction, each mark with where it sits in the code:

- changes it had to make to the design's surface
- workarounds, such as casts, escape hatches past the surface, and glue at call sites
- rules the surface states and nothing enforces
- costs the implementation could not remove without changing the surface

Done when every spike of the round has come back.

## 4. Challenge

Spawn a challenger for each spike, on a different model than the one that ran it. It reads and runs the code in the worktree, and leaves it unchanged. It challenges the design, not the implementation. It looks for a need the design can't meet without changing its surface, a decision the design hides that an implementation needs, and a detail the design exposes that callers will come to depend on. It writes code to show each one.

- A blind challenger gets the spike's question and the worktree, but not the report, and forms its own reading, so the report cannot anchor it. This fits a probe, whose verdict it can reach on its own.
- An informed challenger gets the report and the worktree, and tries to break every claim the report makes about the design. This fits a solve and a load.

Where the challenger and the spike disagree, running code settles it, not argument.

Done when every spike has been challenged, and every dispute is settled by evidence or marked open.

## 5. Weigh

Give every break and every mark of friction one verdict.

- Reshape means the design changes. It fits a break that comes back across spikes, blocks a whole class of needs or implementations, or makes every caller work around it.
- Absorb means the implementation handles it beneath the surface, and the design stays.
- Accept means the design keeps it as a documented limit or error.

Before accepting a break, try to reshape the design so the case cannot happen, because a case that cannot happen beats an error every caller handles. A break with an absorb or accept verdict is finished. Only reshapes and open questions carry into the next round.

Done when every break and every mark of friction has a verdict and the evidence behind it.

## 6. Iterate

Frame the next round from what this one left. That is reshaped designs to load again, new designs to load, needs no spike has met yet, and disputes still open. A new spike may start from an earlier spike's branch to go deeper.

Done when a round ends with no reshape, no new design worth loading, and no open dispute.

## 7. Present

Present the journey round by round. For each round, cover what it spiked, which designs came out, what the loads and challenges broke, the verdict on each break, and how the round shaped the next.

Then present the design that held, written as code. It draws on everything the rounds taught, never on one spike's design carried over unexamined. Judge it on each of these, with evidence:

- Does it hold up under every need loaded on it?
- Is it sliced in the right places, at the right granularity?
- Does its surface expose the right primitives, at the right level, neither too low nor too abstract?
- Do callers compose those primitives with little friction?
- Does it hide the decisions the implementation needs free, and expose what callers need and no more?

List each reshape and the break behind it. List the absorbed breaks, because the implementation will need them. List the accepted limits. Name the rabbit holes to stay away from, each with its reason. Keep the worktrees until the work is done, since they are the evidence.

Done when the journey and the design are presented, every judgement points to evidence, and every break appears with its verdict.
