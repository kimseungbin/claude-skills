---
name: team
description: Spawn a test-writer teammate that owns test files while you keep implementing, so tests get written in parallel by an agent that cannot edit the source to make them pass. Use when a task needs tests alongside the implementation.
argument-hint: "[what to test]"
disable-model-invocation: true
allowed-tools: Bash Read Glob Grep Agent AskUserQuestion
---

# /team — Implementation Agent Team

Spawns one teammate: **`test-writer`**, which owns test files while you keep writing source.

> **Current scope.** One teammate, no enforcement. File ownership is stated in the spawn
> prompt and the agent definition, not yet enforced by a hook — see [Known limits](#known-limits).
> Tracked in [issue #28](https://github.com/kimseungbin/claude-skills/issues/28).

## Step 1: Preflight

Agent teams are experimental and off by default, and this plugin cannot enable them.

```bash
echo "teams=${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-UNSET}"
```

If the value is anything other than `1`, **stop here.** Tell the user teams are disabled, that it must be set in their own settings or environment, and that it is read at session start so the session needs restarting afterward. Do not attempt to spawn — the Agent tool will produce a subagent instead of a teammate, silently giving them something that looks right and behaves differently.

## Step 2: Settle the task

The task is `$ARGUMENTS`. If empty, use `AskUserQuestion` to ask what should be tested.

Then read enough to brief the teammate properly: the implementation under test, and one existing test file to identify the framework and conventions in use. The teammate loads `CLAUDE.md` and project skills on its own, but **not your conversation history** — anything it needs that came out of this session has to go in the spawn prompt.

## Step 3: Spawn the teammate

Use the `Agent` tool. Three things are non-negotiable:

1. **Name it exactly `test-writer`.** Do not improvise a name or add a suffix. The ownership map keys off the teammate's name, so a name this skill did not choose is a teammate the map will not match once enforcement lands.
2. **Use the `test-writer` agent type**, so the definition's `tools` allowlist applies and its body is appended to the teammate's system prompt.
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

In `members`, the teammate's entry should read `"name": "test-writer"` with `"agentType": "test-writer"`.

- **No such directory** — no team formed. The spawn produced a subagent; return to step 3.
- **`agentType` absent, or `general-purpose`** — the agent definition was not applied. Report this: the teammate is running as a generic agent without the definition's `tools` allowlist, so its role is prose-only.
- **A name other than `test-writer`** — say so plainly and re-spawn. Silently accepting an improvised name is how the ownership map ends up unable to match the teammate it was written for.

## Step 5: Work in parallel

Implement while the teammate writes tests. Do not sit and wait for it, and do not write tests yourself — that is the file it owns.

Handle its reports as they arrive:

- **Failure it attributes to the implementation** — treat it as a real bug report and check it. It is the one agent here with no incentive to make the test pass.
- **Failure it attributes to its own test** — let it fix its test.
- **A request for a change outside its files** (a missing export, an untestable private) — that is yours to make. Make it and tell the teammate.

When the work is done, tell the teammate to shut down by name.

## Known limits

- **Ownership is convention, not enforcement.** Nothing rejects an out-of-bounds write yet. The teammate has `Edit` and `Write`, and the boundary holds only because the definition and spawn prompt say so — the same unenforced arrangement this plugin exists to replace. The `PreToolUse` deny hook is the next piece of work.
- **`Bash` is an open door.** The teammate needs it to run tests, but it also makes any Edit-level path restriction bypassable via `sed -i`, `git checkout`, or a redirect. A hook scoped to `Edit|Write` will not close this.
- **Permission prompts surface in the lead session.** The teammate's prompts appear where you are, not in its own transcript. Pre-approving the project's test command before spawning avoids interrupting it.
