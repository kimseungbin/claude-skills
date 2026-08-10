# Agent Team Plugin

Split a task across role-specialized teammates — a code writer, a test writer, a docs writer — and keep them from stepping on each other's files.

> **Status: scaffold only.** The `/team` skill is a placeholder and does nothing yet. Tracked in
> [issue #28](https://github.com/kimseungbin/claude-skills/issues/28).

## Why a plugin

A teammate is a full, independent Claude Code session, not a subagent. When a subagent definition is reused as a teammate role, the teammate honors that definition's `tools` allowlist and `model` — so roles are real specialists — but `skills` and `mcpServers` are dropped, and **no mechanism scopes a teammate to a set of paths**. Teammates inherit the lead's permission settings, and per-teammate modes can't be set at spawn time.

That leaves file ownership as prose inside spawn prompts, honored only by convention. Nothing rejects an out-of-bounds write.

## What it will ship

1. **A declarative role → owned-globs map**, enforced by one `PreToolUse` hook on `Edit|Write` returning `permissionDecision: "deny"` with a reason. The declarative `if` field is not suitable — the docs call it best-effort, and it fails open.

   ```jsonc
   {
     "code-writer": ["src/**"],
     "test-writer": ["**/*.test.ts", "**/*.spec.ts", "test/**"],
     "docs-writer": ["**/*.md", "!BACKLOG.md"],
   }
   ```

2. **`/team` — the protocol.** Which roles to spawn, the ownership map for the task at hand, turn-taking and round caps, the approval gate, and what each teammate reads before starting. None of this is expressible in an agent definition.

## Requirements

- **`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.** Agent teams are experimental and off by default. Plugin `settings.json` honors only `agent` and `subagentStatusLine` — arbitrary `env` is ignored — so this plugin cannot enable teams for you. `/team` preflights the variable and says so rather than spawning nothing.

## Scope

Teams cost significantly more tokens than a single session, so `/team` is `disable-model-invocation: true` — it never auto-runs.

This plugin is for teammates that **write**. A read-only review team (reviewers debating one diff) needs no ownership map and no coordination machinery; use subagents for that.