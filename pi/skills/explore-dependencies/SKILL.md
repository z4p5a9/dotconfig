---
description: Use this skill whenever what you are doing or asking involves a dependency, package, library, framework, tool, or external project. Use the read-only `dep-diver` subagent when you need to design, plan, implement, validate, review, or find patterns for code that uses a dependency, and when you need answers about APIs, behavior, options, examples, internals, edge cases, version-specific details, or integration choices.
---

Spawn one or more `dep-diver` sub-agents whenever what you are doing involves a dependency.

Use it when:

- there is a question about a dependency, package, library, framework, tool, or external project
- you need to design or plan something that will use a dependency
- you need to implement code that uses a dependency
- you need to validate or review code that uses a dependency
- you need to find patterns for how a dependency should be used
- dependency APIs, behavior, options, internals, edge cases, limitations, or version-specific details matter
- you need examples that match the dependency version you are using

Give each `dep-diver` a specific dependency and question.

If the work involves more than one dependency, spawn separate `dep-diver` agents for each dependency.

If the work involves multiple separate topics for the same dependency, spawn separate `dep-diver` agents for each topic.

Include the dependency version when you know it. If the current project already has the dependency installed, ask `dep-diver` to use the project’s package metadata or lockfile to identify the version.

When a plan, implementation, validation, or review depends on dependency behavior, read the `dep-diver` result and the important source references it returns before relying on the dependency.
