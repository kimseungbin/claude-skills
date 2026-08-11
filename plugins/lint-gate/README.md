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

Copy `config/samples/lint-gate.json` to `.claude/config/lint-gate.json` in your project:

```json
{
  "format": "npx prettier --write {file}",
  "lint": "npm run lint",
  "typecheck": "npm run typecheck"
}
```

All three keys are optional and there are **no defaults** — an absent key means that check never runs. A command is only ever run because the project named it. In `format`, `{file}` is replaced by the edited path; without the placeholder the path is appended. Either way it is shell-quoted, since it arrives from a tool payload.

## The two loop guards

A blocking hook that fires repeatedly will bounce an agent forever if it reports something the agent cannot fix. Two guards prevent that:

- **`stop_hook_active`** — a `Stop` hook that already blocked this turn does not block again.
- **Blocked-signature memory** — failures are hashed by command name and output, and a signature already reported is not reported twice. Fix one failure and the signature changes, so the remaining ones still surface; fail to fix anything and the gate goes quiet rather than looping. State lives at `~/.claude/lint-gate/<session_id>.json`, scoped per teammate so two agents settling at different times cannot silence each other.

`TeammateIdle` needs the second guard particularly, because it fires on *every* idle transition rather than once.

## Requirements

**Node ≥ 23.6.** The hooks are TypeScript executed by Node's built-in type stripping — no build step, no dependencies, no install.

The gate **fails open everywhere**: no config, an unparseable config, a command that cannot spawn, or an unexpected exception all let the work through. A missed lint is recoverable; a session that cannot finish a turn is not. The cost is that enforcement can be absent with no signal, so verify it runs before relying on it.

## What this does not do

- **It does not attribute failures to an agent.** On `TeammateIdle` it runs the project's lint, which may fail on files that teammate never touched. The block reason tells the agent to say so explicitly rather than silently fixing or ignoring another agent's file. Scoping the run to a role's owned globs is possible — `TeammateIdle` carries `teammate_name` and `team_name`, and the team config joins a name to its `agentType` — but it is not implemented here, and it would couple this plugin to a particular ownership map.
- **It does not replace CI.** It runs what the project already defines, at moments an agent is likely to stop and declare success.