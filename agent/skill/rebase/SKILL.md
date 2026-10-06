---
name: rebase
description: Rebase the current branch onto main, locally, resolving conflicts with me.
disable-model-invocation: true
---

# Rebase

You rebase the current branch onto its base branch, here on this machine. Every command works on local refs, so nothing goes to or comes from the remote until I say to push.

## 1. Prepare

The base is the branch named in the arguments. Without one, it is the branch `origin/HEAD` points to, or else whichever of `main` and `master` exists locally. Stop and ask me if tracked files have uncommitted changes, or if the current branch is the base.

Create a backup branch at the current commit, named `backup/<branch>-<YYYYMMDD-HHMM>`. Done when the backup and the branch point at the same commit.

## 2. Rebase

Run `git rebase <base>`, and continue after each resolution with `GIT_EDITOR=true git rebase --continue`, which keeps every commit message as it is.

A rebase swaps the sides git names. `ours` and `HEAD` are the base plus the commits replayed so far, and `theirs` is the branch commit being replayed. Call the sides by their branch names whenever you talk to me.

At each conflict, first learn what each side meant. Read the base commits that touched the conflicted lines, and the message and whole diff of the branch commit being replayed. Then sort the conflict.

- A conflict is mechanical when the resolution keeps the intent of both sides and follows from them, with nothing left to choose. Such as both sides adding separate things next to each other, one side moving or renaming code the other edits, or a generated file you regenerate from its source. Resolve mechanical conflicts yourself and keep going.
- A conflict is a judgement call when the resolution chooses between the sides, drops part of one, or needs code neither side wrote. Such as both sides changing the same behaviour in different ways, or one side deleting what the other edits. Bring each one to me. Say exactly what conflicts and why, show the base's diff and the branch's diff for the conflicted lines, and propose a resolution with its reason. Apply it once we agree, then move on to the next conflict.

A conflict you can't sort with certainty is a judgement call.

Done when `git status` shows no rebase in progress.

## 3. Check

Run the project's checks, the ones its `AGENTS.md` names, or else its test command. For each failure, find whether a resolution caused it, and bring the failure and its cause to me. Done when the checks pass, or I have seen every failure.

## 4. Review

Skip this step if the rebase had no conflicts. Otherwise delegate a review of the rebase to a model other than yours. Give the reviewer the base, the backup branch, the `git range-diff <base> <backup> HEAD` command, and every conflict with how it was resolved, the agreed ones included. The reviewer checks that each resolution keeps what both sides meant and reports what it finds. Bring me its findings. Done when I have decided on every finding.

## 5. Report

Tell me the backup branch, and that `git reset --hard <backup>` returns the branch to where it was. List every mechanical conflict you resolved, one line each, with the file and what you kept from each side. Give the check results. End with `git range-diff <base> <backup> HEAD`, the command that shows me how each commit changed through the rebase.

## 6. Push

Ask me whether to push the branch. On yes, run `git push --force-with-lease`, adding `-u origin <branch>` when the branch has no upstream.
