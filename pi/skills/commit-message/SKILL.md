---
name: commit-message
description: Write commit messages that state the applied effect of the commit. Use when the user asks for a commit message, or before any git commit that needs one.
---

# Commit messages

The subject completes the sentence "If applied, this commit will …" — it names the effect the commit has on the code, not the work that was done.

- Start with the verb, never a `type:` prefix: "Balance subagent pane layout with serialized ownership tracking", not "fix: balanced pane layout".
- One effect per subject. An "and" means you are listing changes instead of naming their effect — move up a level and name the single effect the changes produce together.
- Subject alone by default. Add a short body only when the why is not evident from the change itself.
- The user is the sole author: no agent `Co-Authored-By` trailers or "Generated with" lines.
