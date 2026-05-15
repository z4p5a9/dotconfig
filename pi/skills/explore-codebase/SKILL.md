---
description: Use this when you want to use the `codebase.explorer` agent to locate where a feature, behavior, symbol, route, UI, style, test, config, or dependency lives in the codebase.
---

Spawn one or more `codebase.explorer` sub-agents to locate codebase places with precise file and line references.

Use it for discovery, not critique, planning, or implementation. The agent is read-only and should return where things live, how they connect, and which files matter.

Give each explorer a specific search target. If you need to explore separate targets, spawn explorers in parallel with one target each.
