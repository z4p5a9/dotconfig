---
description: Use this skill whenever you need to find files or file locations in the codebase, including definitions, usages, references, routes, tests, configs, validation gates, examples, wiring, or existing patterns. Loads the read-only `codebase.explorer` subagent to pin down where something is defined, processed, used, tested, configured, or where similar code already exists.
---

Spawn one or more `codebase.explorer` sub-agents whenever you need to find files or file locations in the codebase.

Use it to find:

- references to a feature, behavior, concept, or dependency
- where a function, class, type, constant, route, command, component, style, or config is defined
- where something is used, called, imported, rendered, processed, handled, tested, or wired
- examples of existing patterns for doing something similar
- tests, fixtures, mocks, validation gates, docs, generated code, or migrations related to something
- the file path through a behavior, from entrypoint to implementation to tests

Give each explorer a specific thing to locate.

Examples:

- find references to authorization and where authorization is used
- find existing patterns for confirmation dialogs
- find where request retries are processed
- find where `createSession` is defined and where it is called
- find tests and validation gates for the CLI command flow

If you need to locate separate things, spawn explorers in parallel with one target each.

When you plan to copy, reuse, mirror, or follow existing code, use `codebase.explorer` first. Then read the files and line ranges it returns before relying on them. Do not copy from memory or from a vague summary.
