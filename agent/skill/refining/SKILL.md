---
name: refining
description: Improve an implementation beneath a fixed design across models in parallel worktrees, with throwaway rewrites and attacks, until no candidate beats the best. T3 Code only.
disable-model-invocation: true
---

# Refining

Refining improves the implementation beneath a design whose surface stays fixed. A design here is an abstraction, an architecture, or both, and its surface is what callers use. Rival rewrites compete to be simpler, faster, and clearer, and attackers break each one by running code. The rewrites are thrown away. The knowledge and the tests are the output, and we decide on the final implementation from them.

The surface is fixed for the whole run. A break that only a surface change can fix is escalated to `/spiking`, and the run goes on without it.

## 1. Understand

- The surface, named as the files and interfaces callers use.
- The base, which is the current implementation, saved on branch `refine/base`.
- The goals, each as a measure that moves one way, such as p50 latency, test suite time, lines, casts, and lint disables.
- The shared suite and benchmark that every candidate will run, and the baseline number for every goal, taken on the base.
- The current state of the code and everything around it, such as docs, history, issues, and earlier spikes.

Done when every goal has a baseline number, and the shared suite and benchmark run on the base.

## 2. Frame

Pick this round's candidates. A candidate is one of two kinds.

- A rewrite builds the implementation again as if we had known from the start everything we know now. Rival rewrites differ in their main choice, such as owning connections or going through a library.
- A probe tests one fact a rewrite would rest on, such as whether a driver call frees a busy connection within 100ms.

Settle by reading whatever reading can settle. Write each candidate's hypothesis before any code, as a claim with a number and the result that would prove it false.

Done when every candidate of the round has its hypothesis.

## 3. Run

Give each candidate its own worktree at `~/.t3/worktrees/<repo>/refine-<slug>` on branch `refine/<slug>`, starting from `refine/base` or from the best earlier candidate. Spawn a child for it with `delegate_task` in async mode, all at once. Pick each child's model by its candidate's main demand. The child sees only its brief, so give it the surface, the goals with their baselines, and the shared suite and benchmark. The child leaves the surface as it is. A goal it can only meet by changing the surface goes into its report.

The child measures every goal with the shared benchmark and reports each against the base. It reports in whatever shape fits what it found, as long as every claim points to the evidence behind it.

Done when every candidate of the round has come back.

## 4. Attack

Spawn an attacker for each candidate, on a different model than the one that ran it. It reads and runs the code in the worktree, and leaves it unchanged. It breaks the candidate by running code, with faults, races, lost replies, load, and odd inputs, and it reruns the measures. Each break becomes a test written against the surface that goes red on the candidate. Because it goes through the surface, the test holds for any implementation beneath it, the final one included.

- A blind attacker gets the hypothesis and the worktree, but not the report, and forms its own reading, so the report cannot anchor it. This fits a probe, whose verdict it can reach on its own.
- An informed attacker gets the report and the worktree, and tries to break every claim. This fits a rewrite.

Where the attacker and the candidate disagree, running code settles it, not argument.

Done when every candidate has been attacked, every break has its red test, and every dispute is settled by evidence or marked open.

## 5. Weigh

Give every break one verdict.

- Fix means the next round's candidates must turn its test green, and the test joins the shared suite.
- Accept means the implementation keeps it as a documented limit.
- Escalate means only a surface change can fix it, and it goes on the list for `/spiking`.

A test written from a break went red against a real fault, and that is its proof that it can fail.

Weigh every gain against what it costs. A gain that rests on fragile preconditions, or costs more clarity than it saves, goes on the rabbit hole list with its reason.

Done when every break and every gain has a verdict and the evidence behind it.

## 6. Iterate

Frame the next round from the best candidate and what this round left. That is breaks to fix, goals still unmet, rival rewrites that combine what the candidates taught, and disputes still open.

Done when a round finds no break worth fixing, no candidate beats the best on any goal, and no dispute is open.

## 7. Present

Present the journey round by round. For each round, cover what it ran, what the attacks broke, the verdict on each break, and how the round shaped the next.

Then show every goal in one table, with the base and every candidate as columns. Propose the final implementation, combining what every candidate and attack taught, with why and the evidence behind each reason. It is never one candidate's code carried over. The shared suite carries over to it. List the fixed breaks with their tests, the accepted limits, the escalations for `/spiking`, and the rabbit holes with their reasons. Keep the worktrees until the work is done, since they are the evidence.

Done when the journey and the proposal are presented, every reason points to evidence, and the proposal draws on every round, not on one candidate alone.
