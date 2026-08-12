# lint-gate

Run a project's formatter on every edit, and its linter and typechecker only when an agent believes it has finished.

## Why the split

The obvious design — lint after every edit, on `PostToolUse` — is wrong, and wrong in a way that actively damages the work.

Claude routinely edits a file across several tool calls: add the import, then use it; write the signature, then the body; add the type, then the field that needs it. **Every intermediate state is legitimately invalid.** A linter run between edit one and edit two reports the import as unused — which is true, and useless. The agent is then told its last action was a defect, and the plausible correction is to undo it. Then the next edit needs it back.

So the rule is: **run what is valid on a partial file, when the file is partial.**

| | Trigger | Why |
| --- | --- | --- |
| **format** | `PostToolUse`, on the edited file | Pure syntactic transform. Valid on anything that parses; indifferent to whether an import is used. |
| **lint** | `Stop`, `TeammateIdle` | Semantic. Only meaningful once the agent claims to be done. |
| **typecheck** | `Stop`, `TeammateIdle`, after lint | Same, and slower — worth running once rather than per-edit. |

`Stop` and `TeammateIdle` both **block with a reason**, which is what makes this a gate rather than a report: the failing output goes back to the agent as its next instruction, at the moment it was about to declare the work finished. `Stop` covers the main session; `TeammateIdle` covers each teammate in an agent team, and fires whenever one settles.

## Configure

**`/lint-setup`** does this for you: it detects what the project already uses, proposes a toolchain only if there genuinely is none, records the commands, and verifies each one actually runs. That last check matters more than it sounds — a linter that reports problems but exits 0, which some do by default, will never trigger the gate, and a gate that cannot fail is worse than no gate because it looks configured.

To do it by hand, copy `config/samples/lint-gate.json` to `.claude/config/lint-gate.json` in your project:

```json
{
  "format": "npx prettier --write {file}",
  "lint": "npm run lint",
  "typecheck": "npm run typecheck"
}
```

All three keys are optional and there are **no defaults** — an absent key means that check never runs. A command is only ever run because the project named it. In `format`, `{file}` is replaced by the edited path; without the placeholder the path is appended. Either way it is shell-quoted, since it arrives from a tool payload.

## Scoping lint to what the agent edited

`lint` runs project-wide by default. On a repo with any pre-existing backlog, that means the gate fails at the end of **every** task, reporting problems in files the agent never opened. The honest response is "none of these are mine" — which is exactly what the block reason tries to discourage, and once it happens the agent has learned to discount every later report.

`{files}` asks the narrower question instead. It expands to every path edited during this session, shell-quoted and space-joined:

```json
{
  "format": "npx prettier --write --ignore-unknown {file}",
  "lint": "npx eslint --no-warn-ignored {files}"
}
```

- Paths accumulate on each `PostToolUse`, in the same per-session, per-teammate state as the blocked signatures — so in an agent team, one teammate is never linted against another's files.
- **Paths outside the project are dropped.** Claude Code writes outside it as a matter of course — plan mode lands a file under `~/.claude/plans`, memory under `~/.claude/projects` — while every command a gate can be configured with resolves from the project cwd. A tool that discovers its config per file (`eslint`, `stylelint`, `tsc` given a path list) fails the *entire* invocation on one such path, which would take the in-project files down with it and report a failure nothing in the repo can fix. Dropping them costs nothing: no project command could have checked them anyway.
- **An empty list skips the command** rather than running it bare. A linter with no path argument silently checks nothing under some configs and errors under others; neither is a useful gate result, and if nothing was edited then nothing is owed. A session whose every edit landed outside the project therefore runs nothing, rather than something that cannot succeed.
- Paths that no longer exist are dropped. An agent may write a file and then delete or rename it; handing that path to a linter exits non-zero on "no files matching", which would reach the agent as a failure it cannot act on.
- A command **without** the placeholder keeps running project-wide, exactly as before. Nothing changes for a config that never asked for scoping.

**`{files}` is for linters, not typecheckers.** `tsc --noEmit` needs the whole program; handing it individual paths breaks `tsconfig` resolution and quietly changes what is checked. The hook will not second-guess you — it runs the command the project wrote, `{files}` and all — so keep `typecheck` project-wide. `/lint-setup` says so when it writes the config.

`{file}` and `{files}` are distinct: `{file}` is the single edited path and belongs in `format`, which runs per edit; `{files}` is the accumulated list and belongs in `lint`, which runs at the end.

## The two loop guards

A blocking hook that fires repeatedly will bounce an agent forever if it reports something the agent cannot fix. Two guards prevent that:

- **`stop_hook_active`** — a `Stop` hook that already blocked this turn does not block again.
- **Blocked-signature memory** — failures are hashed by command name and output, and a signature already reported is not reported twice. Fix one failure and the signature changes, so the remaining ones still surface; fail to fix anything and the gate goes quiet rather than looping. State lives at `~/.claude/lint-gate/<session_id>.json`, scoped per teammate so two agents settling at different times cannot silence each other. The same file holds the edited-path list that `{files}` consumes, under the same scope.

`TeammateIdle` needs the second guard particularly, because it fires on *every* idle transition rather than once.

## Requirements

**Node ≥ 23.6.** The hooks are TypeScript executed by Node's built-in type stripping — no build step, no dependencies, no install.

The gate **fails open everywhere**: no config, an unparseable config, a command that cannot spawn, or an unexpected exception all let the work through. A missed lint is recoverable; a session that cannot finish a turn is not. The cost is that enforcement can be absent with no signal, so verify it runs before relying on it.

## What this does not do

- **It does not attribute failures by ownership.** A project-wide `lint` on `TeammateIdle` may fail on files that teammate never touched, and the block reason then tells the agent to say so explicitly rather than silently fixing or ignoring another agent's file. `{files}` narrows the run to what that teammate actually edited, which covers most of this in practice. Scoping to a role's *owned globs* is a different thing and is still not implemented — `TeammateIdle` carries `teammate_name` and `team_name`, and the team config joins a name to its `agentType`, so it is possible, but it would couple this plugin to a particular ownership map.
- **It does not replace CI.** It runs what the project already defines, at moments an agent is likely to stop and declare success.