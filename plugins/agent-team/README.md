# Agent Team Plugin

Split a task across role-specialized teammates — a code writer, a test writer, a docs writer — and keep them from stepping on each other's files.

> **Status: one teammate, no enforcement.** `/team` spawns a `test-writer` teammate that owns
> test files while you implement. The ownership boundary is stated in the agent definition and
> the spawn prompt — nothing rejects an out-of-bounds write yet. Tracked in
> [issue #28](https://github.com/kimseungbin/claude-skills/issues/28).

## Why a plugin

A teammate is a full, independent Claude Code session, not a subagent. When a subagent definition is reused as a teammate role, the teammate honors that definition's `tools` allowlist and `model` — so roles are real specialists — but `skills` and `mcpServers` are dropped, and **no mechanism scopes a teammate to a set of paths**. Teammates inherit the lead's permission settings, and per-teammate modes can't be set at spawn time.

That leaves file ownership as prose inside spawn prompts, honored only by convention. Nothing rejects an out-of-bounds write.

## What ships today

**`/team [what to test]`** preflights the env var, spawns a teammate named `test-writer` using the plugin's `test-writer` agent definition, verifies from the team config that both the name and agent type landed, then implements alongside it.

The definition (`agents/test-writer.md`) restricts the teammate's `tools` and instructs it to report a failing test rather than edit the implementation to make it pass — the failure mode that turns a real defect into a green run. That instruction is the role's whole point, and today it rests on the prompt rather than on enforcement.

## What it still needs

1. **A declarative role → owned-globs map**, enforced by one `PreToolUse` hook on `Edit|Write` returning `permissionDecision: "deny"` with a reason. The declarative `if` field is not suitable — the docs call it best-effort, and it fails open.

   Keys are **agent types**, not teammate names. This is settled by probe rather than inference: a `PreToolUse` hook dumping its own stdin during a real `/team` run shows the teammate's `Write` carrying `"agent_type": "test-writer"` and `"agent_id": "atest-writer-e749ef3ae68ee067"`, and **no `name` field at all**. A name-keyed map has nothing to match on. The teammate's name survives only as a substring of the opaque `agent_id`, and recovering it means parsing an undocumented format.

   Two details that only the payload reveals:

   - **`agent_type` arrives unnamespaced.** The team `config.json` records `"agentType": "agent-team:test-writer"`, but the hook receives the bare `"test-writer"`. Key the map on the bare form.
   - **`session_id` does not identify the writer.** An in-process teammate reports the *lead's* `session_id`. What separates them is that lead-authored payloads carry no `agent_id` and no `agent_type` at all, while teammate payloads carry both. So the hook's own rule is: no `agent_type` means the lead, which the map must not constrain.

   The earlier rationale for name-keying — that a recorded agent type is absent whenever the lead spawns without naming a definition — described `config.json`, not hook stdin, and does not transfer. The real consequence of that case survives in a different form: a teammate spawned without a definition arrives as `general-purpose`, which matches no role entry and is therefore unconstrained. That is a limit of any keying scheme here, not an argument for names. `/team` still pins name and agent type to the same string, which now costs nothing and keeps the two readings of the config consistent.

   ```jsonc
   {
     "code-writer": ["src/**"],
     "test-writer": ["**/*.test.*", "**/*.spec.*", "test/**", "tests/**", "__tests__/**"],
     "docs-writer": ["**/*.md", "!BACKLOG.md"],
   }
   ```

   The `test-writer` globs must stay in step with `agents/test-writer.md`, which claims `tests/`, `__tests__/`, and non-TS test files. A map narrower than the definition denies writes the role explicitly authorizes.

2. **The rest of the protocol.** `/team` currently spawns one fixed role. Still missing: the other writer roles (`code-writer`, `docs-writer`), choosing which to spawn for a given task, turn-taking and round caps, and the approval gate. None of this is expressible in an agent definition.

3. **A `Bash` answer.** The teammate needs `Bash` to run tests, which makes any `Edit|Write` path restriction bypassable via `sed -i`, a redirect, or `git checkout`. A hook on `Edit|Write` alone will not close this.

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