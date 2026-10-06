# Act on the verdicts

## 1. Fix

Make the fixes, each with the remedy from the report. Change only what the fix needs.

When the investigator showed the bug with a run, turn that run into a test if the project tests that kind of thing. Watch it fail before the fix and pass after.

Run the project's checks and fix what they report. Commit each fix on its own, so its reply can link to the commit, then push.

Done when every fix is pushed and the checks pass.

## 2. Reply

Every finding gets a reply in your own plain words, like these:

```
Fixed in a1b2c3d. `decodeKey` now rejects keys longer than 16 bytes.
Not changing this. `id` is a `DocumentId`, so it can't be undefined here.
Not changing this. Only one process writes this table, so the two writes can't overlap.
Real, but outside this PR, which only changes how values are encoded.
```

An inline thread gets one reply. A review body gets one PR comment that answers each of its findings on its own line, in the order the review listed them. A notice gets no reply. Don't @mention a bot, because a mention starts it again.

## 3. Post

Post each reply with the script:

```
node <skill folder>/pr-comments.ts reply <id> < reply.md
node <skill folder>/pr-comments.ts react <id>
```

`<id>` is the id `collect` printed. For a review body, use the review's id. `reply` posts your reply, adds our 🚀 to what it answers, including every waiting comment in a thread, and resolves the thread if a bot started it. `react` only adds the 🚀, for notices.

Then run `collect` again. If it prints new comments, triage them from step 1 of `SKILL.md`. A bot comment that only argues with your earlier reply, and brings nothing new, gets the 🚀 and no reply. A round with no fixes pushes nothing, so the bots have nothing new to review, and the loop ends there.

Done when `collect` prints nothing you acted on and nothing new.
