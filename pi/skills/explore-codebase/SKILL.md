---
description: Use this whenever your need explore and locate a target in the current codebase
---

Spawn one or more `codebase.explorer` sub-agents, if you spawn more than one do it in parallel, in order to explore and locate files, implementations, functions, types, definitions, tests etc in the codebase you are working on. Each sub-agent should be given a targeted and specific request.

Example requests:

- Find where and how `Inbox` service is consumed
- Locate all `command` related database migrations
