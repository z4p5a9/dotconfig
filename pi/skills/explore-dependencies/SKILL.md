---
description: Use this when you want to use the `dep-diver` agent to answer questions about a dependency, package, library, framework, tool, or external project by reading its docs and source code.
---

Spawn one or more `dep-diver` sub-agents to explore a dependency and write the missing documentation needed to answer the request.

Use it for dependency docs, APIs, behavior, options, examples, internals, edge cases, and version-specific questions.

Give each `dep-diver` a specific target dependency and question. Include the dependency version when you know it. If you need to explore separate dependencies or unrelated questions, spawn `dep-diver` agents in parallel with one target each.
