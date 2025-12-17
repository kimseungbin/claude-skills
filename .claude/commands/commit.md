---
description: Create commits following Conventional Commits specification
allowed-tools: Bash, Read, Glob, Grep, Edit, Task
---

Use the `commit-expert` subagent to create git commits following the Conventional Commits specification.

The subagent provides:
- Context isolation (separate from main conversation)
- Pattern learning from project's commit history
- Intelligent multi-commit splitting with smart ordering
- Interactive selection for granular control
- Implementation guides for infrastructure/frontend/backend projects

Invoke: `Task(subagent_type="commit-expert")`
