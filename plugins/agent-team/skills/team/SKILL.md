---
name: team
description: Spawn an implementation agent team that splits a task across role-specialized teammates — a code writer, a test writer, a docs writer — each reusing an existing subagent definition for its tools and model, with file ownership enforced by a hook. Use when the work has distinct specialties and a single session would serialize them.
argument-hint: "[task description]"
disable-model-invocation: true
---

# /team — Implementation Agent Team

> **Status: not implemented.** This skill is a placeholder. See
> [issue #28](https://github.com/kimseungbin/claude-skills/issues/28) —
> _Proposed feature: `/team` — a build team with enforced file ownership_.

## Scope, once built

Two pieces, per the issue:

1. **The ownership table.** A declarative agent → owned-globs map, enforced by one
   `PreToolUse` hook on `Edit|Write` that returns `permissionDecision: "deny"` with a
   reason. The declarative `if` field is _not_ suitable — the docs call it best-effort and
   it fails open.
2. **The protocol.** Which roles to spawn, the ownership map for this task, turn-taking
   and round caps, the approval gate, and what each teammate reads before starting. None
   of it is expressible in an agent definition.

## Constraints to honor

- **Preflight `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.** Agent teams are off by default and
  this plugin cannot set it. If unset, stop and tell the user rather than spawning nothing
  and appearing broken.
- **`disable-model-invocation: true`** stays set. Teams cost significantly more tokens than
  a single session; spawning one is always an explicit user decision.
- **A read-only review team is not the feature.** Reviewers debating one diff need no
  ownership table and no gate scoping. This skill is for teammates that write.
