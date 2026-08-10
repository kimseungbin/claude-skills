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

**`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is required.** Agent teams are experimental and disabled by default: without it no team is set up at session start, no team directories are written, and Claude does not spawn or propose teammates.

A plugin cannot set it for you. Plugin `settings.json` honors only the `agent` and `subagentStatusLine` keys, and unknown keys are silently ignored — so it has to go in your own settings or environment:

```json
// ~/.claude/settings.json or .claude/settings.local.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Or per-shell: `export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

It is read at session start, so set it before launching — toggling it mid-session has no effect. `/team` preflights it and tells you rather than spawning nothing and appearing broken.

## Scope

Teams cost significantly more tokens than a single session, so `/team` is `disable-model-invocation: true` — it never auto-runs.

This plugin is for teammates that **write**. A read-only review team (reviewers debating one diff) needs no ownership map and no coordination machinery; use subagents for that.