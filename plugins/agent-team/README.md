# Agent Team Plugin

Split a task across role-specialized teammates — a code writer, a test writer, a docs writer — and keep them from stepping on each other's files.

> **Status: one teammate, ownership enforced against tool-level edits.** `/team` spawns a
> `test-writer` teammate that owns test files while you implement, and a `PreToolUse` hook
> rejects its `Edit`/`Write` outside those files. `Bash` remains an open door — see
> [What this does and does not enforce](#what-this-does-and-does-not-enforce). Tracked in
> [issue #28](https://github.com/kimseungbin/claude-skills/issues/28).

## Why a plugin

A teammate is a full, independent Claude Code session, not a subagent. When a subagent definition is reused as a teammate role, the teammate honors that definition's `tools` allowlist and `model` — so roles are real specialists — but `skills` and `mcpServers` are dropped, and **no mechanism scopes a teammate to a set of paths**. Teammates inherit the lead's permission settings, and per-teammate modes can't be set at spawn time.

That leaves file ownership as prose inside spawn prompts, honored only by convention — which is what the hook below exists to replace.

## What ships today

**`/team [what to test]`** preflights the env var, spawns a teammate named `test-writer` using the plugin's `test-writer` agent definition, verifies from the team config that both the name and agent type landed, then implements alongside it.

The definition (`agents/test-writer.md`) restricts the teammate's `tools` and instructs it to report a failing test rather than edit the implementation to make it pass — the failure mode that turns a real defect into a green run.

**A `PreToolUse` hook enforces the boundary.** `hooks/enforce-ownership.ts` matches the acting agent against `config/ownership.json` and returns `permissionDecision: "deny"` with a reason naming what the role does own and how to escalate. The declarative `if` field is not used — the docs call it best-effort, and it fails open.

### What this does and does not enforce

It rejects **tool-level edits**: `Write`, `Edit`, `MultiEdit`, `NotebookEdit`.

It does **not** make file ownership airtight. The teammate needs `Bash` to run the tests it writes, and `Bash` reaches any file through `sed -i`, a redirect, or `git checkout`. No `Edit|Write` hook closes that, and scoping one to `Bash` would mean parsing arbitrary shell — fragile, and failing open on anything it cannot parse. So the honest claim is *enforced against tool-level edits*, not *enforced file ownership*: the hook blocks the honest path and makes the boundary legible to a teammate that respects it. It is not a sandbox and will not stop one that does not.

The hook also fails open by design on every error — unparseable input, a missing or malformed map, an unresolvable module. An unenforced write is recoverable; a session that cannot write anything is not.

### The ownership map

`config/ownership.json` maps **agent type** to owned globs. A project can override it wholesale at `.claude/config/agent-team/ownership.json`.

```jsonc
{
  "code-writer": ["src/**"],
  "test-writer": ["**/*.test.*", "**/*.spec.*", "test/**", "tests/**", "__tests__/**"],
  "docs-writer": ["**/*.md", "!BACKLOG.md"],
}
```

Globs match the path **relative to the project root**; `*` stays within a segment, `**` crosses any depth including zero, `?` is one character, everything else is literal, and a leading `!` subtracts. A path outside the project is denied. An agent type with no entry is **unconstrained** — so a teammate spawned without a definition, which arrives as `general-purpose`, is not restricted. Denying every unknown type instead would block agents from unrelated plugins this map knows nothing about.

Keys are **agent types, not teammate names**, settled by probe rather than inference. A hook dumping its own stdin during a real `/team` run shows the teammate's `Write` carrying `"agent_type": "test-writer"` and `"agent_id": "atest-writer-e749ef3ae68ee067"`, and **no `name` field at all**. A name-keyed map has nothing to match on; the name survives only as a substring of the opaque `agent_id`. Two details only the payload reveals:

- **`agent_type` arrives unnamespaced.** The team `config.json` records `"agentType": "agent-team:test-writer"`, but the hook receives the bare `"test-writer"`. Key the map on the bare form.
- **`session_id` does not identify the writer.** An in-process teammate reports the *lead's* `session_id`. What separates them is that lead-authored payloads carry no `agent_id` and no `agent_type` at all, while teammate payloads carry both. So the hook's rule is: no `agent_type` means the lead, which the map never constrains.

Keying on the type also survives name collisions: re-spawning a `test-writer` in a session that already had one yields the name `test-writer-2`, while the agent type is unchanged.

Each entry must stay in step with the matching `agents/<role>.md`. A map narrower than the definition denies writes the role was explicitly told it owns.

## What it still needs

1. **The rest of the protocol.** `/team` currently spawns one fixed role. Still missing: the other writer roles (`code-writer`, `docs-writer`), choosing which to spawn for a given task, turn-taking and round caps, and the approval gate. None of this is expressible in an agent definition.

2. **A `Bash` answer**, if tool-level enforcement is ever to become real enforcement. See above — this is a design question, not an oversight.

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

**Node ≥ 23.6 is required for the ownership hook**, which is TypeScript run directly by Node's built-in type stripping — no build step, no dependencies, no install. On an older Node the hook fails open: teammates still spawn and work, but out-of-bounds edits are not rejected. `/team` preflights this alongside the env var.

It is read at session start, so set it before launching — toggling it mid-session has no effect. `/team` preflights it and tells you rather than spawning nothing and appearing broken.

## Scope

Teams cost significantly more tokens than a single session, so `/team` is `disable-model-invocation: true` — it never auto-runs.

This plugin is for teammates that **write**. A read-only review team (reviewers debating one diff) needs no ownership map and no coordination machinery; use subagents for that.