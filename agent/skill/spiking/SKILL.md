---
name: spiking
description: Spike a piece of work across models in parallel worktrees, attacking each learning, until every open question has evidence behind it. T3 Code only.
disable-model-invocation: true
---

# Spiking

A spike is throwaway code written to answer a question. Thinking about a piece of work gives us guesses, and building it is where the surprises are. You spike the work across models, attack every learning, and spike again, until we know it as if we had already built it several ways and found the hard parts. The code is thrown away. The knowledge is the output.

## Models

Use only these two models, exactly as named. Never use another version, even one that looks newer or close. Set reasoning on every child, since the defaults are lower. Use `high` for most spikes and `xhigh` for the hard ones. Claude calls the option `effort` and Codex calls it `reasoningEffort`.

Scores run 1 to 4, higher is better. Each column is a `delegate_task` target.

| | `claudeAgent` / `claude-opus-5-5` | `codex` / `gpt-6.1-sol` |
|---|---|---|
| taste | 4 | 1 |
| ui | 4 | 1 |
| craft | 4 | 2 |
| scrutiny | 2 | 4 |
| thoroughness | 3 | 4 |
| economy | 1 | 4 |

- Taste is API and product sense.
- UI is building good-looking, usable interfaces.
- Craft is writing correct, clean code.
- Scrutiny is finding bugs, holes, and false claims.
- Thoroughness is covering every case.
- Economy is being cheap and fast enough to spawn many of.

Never switch models on your own. If a prompt gets flagged, rewrite the prompt and try again on the same model. If the model is out of capacity or fails for a passing reason, wait a bit and try again. If it still cannot run, stop and tell the user. Only the user decides whether to switch models or wait.

## 1. Understand

- What the work is, and why it is asked for.
- The current state of the code and everything around it, such as docs, history, issues, dependencies, and data.
- What we need to do, meaning the outcome and not the approach.

Done when every item above is clear.

## 2. Frame

- Guesses are the things we know we are betting on.
- Assumptions are the things we take as true without noticing.
- Directions are the distinct ways to approach the work.

Settle by reading whatever reading can settle. Every guess and assumption left becomes a falsifiable hypothesis, which is a claim and the result that would prove it false, written before any code. Order them riskiest first.

Done when every guess and assumption is settled or a hypothesis, and there are at least two directions.

## 3. Spike

A spike is one of two kinds.

- A probe tests a hypothesis. It is thin, end to end, and through the real risk, so its result can prove the hypothesis false.
- A build carries a direction through to a working end state, so we see how it looks, where it had to diverge, its strong and weak points, and what it uncovered that we did not foresee.

Give each spike its own worktree at `~/.t3/worktrees/<repo>/spike-<slug>` on branch `spike/<slug>`, and spawn a child for it with `delegate_task` in async mode, all at once. Pick each child's model from the table. The child sees only its brief, so shape each brief around its spike. The child reports in whatever shape fits what it found, as long as every claim points to the evidence behind it.

Done when every probe and build of the round has come back.

## 4. Attack

Spawn an attacker for each spike, on a different model than the one that ran it. It reads and runs the code in the worktree, and leaves it unchanged. It attacks in one of two ways.

- A blind attacker gets the hypothesis or direction and the worktree, but not the report, and forms its own reading, so the report cannot anchor it. This fits a probe, whose verdict it can reach on its own.
- An informed attacker gets the report and the worktree, and tries to break every claim. It reruns the evidence, finds what the spike skipped or got wrong, and names the assumptions it leaned on without seeing. This fits a build, whose claims are what need breaking.

Where the attacker and the spike disagree, running code settles it, not argument.

Done when every spike has been attacked, and every dispute is settled by evidence or marked open.

## 5. Iterate

Each round leaves new material, such as surprises, assumptions the attacks uncovered, disputes still open, and directions that died or newly appeared. Take it back to step 2 and frame the next round from it. A new spike may start from an earlier spike's branch to go deeper.

Done when every guess and assumption is settled by evidence, and no dispute is open.

## 6. Present

Present a summary of the whole journey. Cover each round, what it spiked, what came back, what the attacks broke, what surprised us, and how each round shaped the next.

Then present the conclusion. Remember that the code is thrown away and the knowledge is the output. Give your final proposal for how to do the work, combining what every spike and attack taught us, why, and the evidence behind each reason. It is never a spike's code or one spike's approach carried over. Name the rabbit holes to stay away from, each with its reason. Keep the worktrees until the work is done, since they are the evidence.

Done when the journey and the proposal are presented, every reason points to evidence, and the proposal draws on everything learned, not on one spike alone.
