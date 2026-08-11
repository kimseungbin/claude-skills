---
name: team
description: Spawn a test-writer teammate that owns test files while you keep implementing, so tests get written in parallel by an agent that cannot edit the source to make them pass. Use when a task needs tests alongside the implementation.
argument-hint: "[what to test]"
disable-model-invocation: true
allowed-tools: Bash Read Glob Grep Agent AskUserQuestion
---

# /team — Implementation Agent Team

Spawns one teammate: **`test-writer`**, which owns test files while you keep writing source.

> **Current scope.** One teammate. File ownership is enforced against tool-level edits by a
> `PreToolUse` hook, but `Bash` bypasses it — see [Known limits](#known-limits).
> Tracked in [issue #28](https://github.com/kimseungbin/claude-skills/issues/28).

## Step 1: Preflight

Agent teams are experimental and off by default, and this plugin cannot enable them.

```bash
echo "teams=${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-UNSET}" && node --version 2>/dev/null || echo "node=MISSING"
```

If the teams value is anything other than `1`, **stop here.** Tell the user teams are disabled, that it must be set in their own settings or environment, and that it is read at session start so the session needs restarting afterward. Do not attempt to spawn — the Agent tool will produce a subagent instead of a teammate, silently giving them something that looks right and behaves differently.

If Node is missing or older than 23.6, do **not** stop — spawn anyway, but say plainly that the ownership hook cannot run and the boundary is back to convention for this session. The hook is TypeScript executed by Node's type stripping, and it fails open, so an old runtime costs enforcement silently unless you say so.

## Step 2: Settle the task

The task is `$ARGUMENTS`. If empty, use `AskUserQuestion` to ask what should be tested.

Then read enough to brief the teammate properly: the implementation under test, and one existing test file to identify the framework and conventions in use. The teammate loads `CLAUDE.md` and project skills on its own, but **not your conversation history** — anything it needs that came out of this session has to go in the spawn prompt.

## Step 3: Spawn the teammate

Use the `Agent` tool. Three things are non-negotiable:

1. **Use the `test-writer` agent type.** This is the one that matters for enforcement: the `PreToolUse` payload carries `agent_type` and no teammate name, so the agent type is what the ownership map keys on. It also applies the definition's `tools` allowlist and appends its body to the teammate's system prompt.
2. **Name it exactly `test-writer`.** Do not improvise a name or add a suffix. The name is not what the map matches, but keeping it identical to the agent type is what makes the team config readable and keeps every role's two identities in step.
3. **It must be a teammate, not a subagent.** A subagent reports back and exits; a teammate is an independent session you can message. If a subagent gets spawned instead, say so rather than proceeding — the whole point is a peer that works while you do.

Spawn prompt — fill in the specifics, keep the boundary verbatim:

> You are the test writer on a two-agent team. The lead is implementing; you write the tests.
>
> **Task:** [what to test, in concrete terms]
> **Implementation:** [files, and what they are supposed to do]
> **Framework and conventions:** [what you found in step 2 — runner, file naming, assertion style, how to run a single file]
>
> You own test files only. The lead owns the implementation and is editing it right now. Do not edit any file outside your test files, and do not edit the implementation to make a failing test pass — report the failure to the lead instead, with file, line, expected, and actual.
>
> Start by reading the implementation. Write tests, run them, then report what passed, what failed, and for each failure whether you believe the test or the implementation is wrong.

## Step 4: Verify the spawn landed as intended

Do not take the spawn at face value — confirm the teammate's recorded identity, because both the name and the agent type are what enforcement will key on:

```bash
cat "$HOME/.claude/teams/session-${CLAUDE_CODE_SESSION_ID:0:8}/config.json"
```

In `members`, the teammate's entry should read `"name": "test-writer"` with `"agentType": "agent-team:test-writer"`.

- **No such directory** — no team formed. The spawn produced a subagent; return to step 3.
- **`agentType` absent, or `general-purpose`** — the agent definition was not applied. Report this: the teammate is running as a generic agent without the definition's `tools` allowlist, so its role is prose-only. It is also unconstrained by the ownership map, which matches on agent type.
- **A name other than `test-writer`** — say so plainly and re-spawn. The map does not key on the name, but a name that disagrees with the agent type makes the team config lie about which role is running.

The plugin-namespaced `agent-team:` prefix is expected here and appears only in `config.json`. The hook payload receives the bare `test-writer`, which is the form the ownership map uses — do not copy the namespaced string into the map.

## Step 5: Work in parallel

Implement while the teammate writes tests. Do not sit and wait for it, and do not write tests yourself — that is the file it owns.

Handle its reports as they arrive:

- **Failure it attributes to the implementation** — treat it as a real bug report and check it. It is the one agent here with no incentive to make the test pass.
- **Failure it attributes to its own test** — let it fix its test.
- **A request for a change outside its files** (a missing export, an untestable private) — that is yours to make. Make it and tell the teammate.

When the work is done, tell the teammate to shut down by name.

## Known limits

- **`Bash` is an open door.** `hooks/enforce-ownership.ts` rejects `Write`, `Edit`, `MultiEdit` and `NotebookEdit` outside the role's globs, but the teammate needs `Bash` to run tests, and `Bash` reaches any file via `sed -i`, `git checkout`, or a redirect. The hook blocks the honest path and makes the boundary legible; it is not a sandbox. Claim *enforced against tool-level edits*, never *enforced file ownership*.
- **The hook fails open.** Unparseable input, a missing or malformed map, or a Node older than 23.6 all result in the write being allowed. That is deliberate — a hook that bricks a session is worse than one that misses — but it means enforcement can be absent without any signal, which is why step 1 checks Node.
- **An agent type with no map entry is unconstrained.** A teammate spawned without a definition arrives as `general-purpose` and matches nothing, so it is not restricted at all. Only roles named in `config/ownership.json` are enforced.
- **Permission prompts surface in the lead session.** The teammate's prompts appear where you are, not in its own transcript. Pre-approving the project's test command before spawning avoids interrupting it.
