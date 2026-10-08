# lint-gate

Run a project's formatter on every edit, and its checks only when an agent believes it has finished — and hold the agent to the checks its own edits made owed.

## Why the split

The obvious design — lint after every edit, on `PostToolUse` — is wrong, and wrong in a way that actively damages the work.

Claude routinely edits a file across several tool calls: add the import, then use it; write the signature, then the body; add the type, then the field that needs it. **Every intermediate state is legitimately invalid.** A linter run between edit one and edit two reports the import as unused — which is true, and useless. The agent is then told its last action was a defect, and the plausible correction is to undo it. Then the next edit needs it back.

So the rule is: **run what is valid on a partial file, when the file is partial.**

| | Trigger | Why |
| --- | --- | --- |
| **format** | `PostToolUse`, on the edited file | Pure syntactic transform. Valid on anything that parses; indifferent to whether an import is used. |
| **checks** | `Stop`, `TeammateIdle` | Semantic. Only meaningful once the agent claims to be done. |

`Stop` and `TeammateIdle` both **block with a reason**, which is what makes this a gate rather than a report: the failing output goes back to the agent as its next instruction, at the moment it was about to declare the work finished. `Stop` covers the main session; `TeammateIdle` covers each teammate in an agent team, and fires whenever one settles.

## Configure

**`/lint-setup`** does this for you: it detects what the project already uses, proposes a toolchain only if there genuinely is none, records the checks, and verifies each one in both directions. That last step matters more than it sounds — a linter that reports problems but exits 0, which some do by default, will never trigger the gate, and a gate that cannot fail is worse than no gate because it looks configured.

To do it by hand, copy `config/samples/lint-gate.json` to `.claude/config/lint-gate.json` in your project:

```json
{
  "format": "npx prettier --write --ignore-unknown {file}",
  "checks": [
    { "name": "lint", "scope": "files", "command": "npx eslint --no-warn-ignored {files}" },
    { "name": "typecheck", "scope": "program", "command": "npm run typecheck" },
    { "name": "test", "scope": "unit", "watch": "npx vitest --watch --reporter=json --outputFile={status}" }
  ]
}
```

Both keys are optional and there are **no defaults** — a command is only ever run because the project named it. In `format`, `{file}` is replaced by the edited path; without the placeholder the path is appended. Either way it is shell-quoted, since it arrives from a tool payload.

`checks` run in list order, every one of them, and every failure is reported together.

| Field | | Meaning |
| --- | --- | --- |
| `name` | required, unique | How the check is named in a block. |
| `scope` | required | `files`, `program` or `unit` — see below. |
| `command` | one of these two | Run at Stop. |
| `watch` | | A long-running watcher, `unit` only — see [Tests are watched](#tests-are-watched-not-run). |
| `when` | default: any edit | Glob, or list of globs, relative to the checkout root. The check is owed only if an edited path matches one. |
| `cwd` | default: checkout root | Directory the command runs in, relative to the checkout root. |
| `report` | `program` only, default `"all"` | `"edited"` judges the check by where its errors are — see [Whole-program checks on a backlog](#whole-program-checks-on-a-backlog). |
| `parse` | with `report: "edited"` | Which tool's output to read: `tsc`, `mypy`, `mypy-json`, `pyright-json`, `svelte-check-machine`. |
| `timeoutSec` | default 180 | A check that runs longer fails. |

A malformed check is dropped whole and never run some broader way than the project wrote. What was dropped, and why, is shown to you once per session, as are unknown keys.

## The three scopes

A check's scope says how its result can be attributed to the session — which is what decides how it is run, and what a failure means.

| Scope | For | Runs | Fails when |
| --- | --- | --- | --- |
| **`files`** | linters, formatters in check mode | on exactly the edited files, through `{files}` | it exits non-zero |
| **`program`** | typecheckers — `tsc`, `svelte-check`, `mypy` | whole, once per build unit | it exits non-zero, or with `report: "edited"`, it reports an error located in an edited file |
| **`unit`** | tests, builds, `cdk synth` | whole, once per build unit | it exits non-zero, or its watcher's verdict is not a fresh pass |

The scope is enforced, so a wrong combination never runs: a `files` check must contain `{files}`, and a `program` or `unit` check must not. `tsc --noEmit` handed a list of paths ignores `tsconfig.json` and silently checks something else — it appears to pass — so a typechecker is a `program` check and runs whole.

### Every check is owed by an edit

**A check runs only if the session edited a path that matches its `when`.** With no `when`, any edit inside the project makes it owed. A session that edited nothing owes nothing, whatever the scope: a Stop gate is about the session's own work, and a read-only session blocked by someone else's uncommitted error has been handed a failure it cannot own.

That makes `when` the way to keep a monorepo gate fast and fair. Write each check's `when` to cover what it actually depends on — not only its own package:

```json
{ "name": "typecheck:api", "scope": "program", "command": "npm run typecheck", "cwd": "workspaces/api",
  "when": ["workspaces/{api,shared}/**", "tsconfig.base.json", "package-lock.json"] }
```

A `typecheck:api` that only watches `workspaces/api/**` never runs when an edit to `shared` breaks `api` — the most common type error an agent introduces. `when` uses standard glob semantics: `**` does not reach a dotfile unless the glob names the dot.

### What counts as an edit

Every path a file tool wrote (`Write`, `Edit`, `MultiEdit`, `NotebookEdit`) and every path Claude Code reports a Bash command changed (`bashEditDiff`, Claude Code v2.1.269+) is recorded on `PostToolUse`. Bash-reported changes are best effort, so a session that only changed files through a path Claude Code did not see is not gated.

The record is an append-only log per session and per teammate, so concurrent PostToolUse hooks — parallel tool calls — never lose an edit, and one teammate is never held to another's files. Recorded paths are then:

- **dropped if outside the project.** Claude Code writes outside it as a matter of course — plan mode under `~/.claude/plans`, memory under `~/.claude/projects` — and a tool that discovers its config per file fails the *entire* invocation on one such path, which would take the in-project files down with it.
- **dropped if they no longer exist.** Handing a linter a path that was deleted exits non-zero on "no files matching", a failure the agent cannot act on.
- **grouped by checkout.** An edit inside a git worktree of the same repository — `.claude/worktrees/x/…`, say — is checked from that worktree, with its own `node_modules`, `cwd` and `when` resolved there. The session's config applies to every checkout. A file in a different repository is outside the project.

## Whole-program checks on a backlog

A typechecker cannot be narrowed to the session's files, so on a build unit with existing errors, a `program` check fails at the end of every task over files the agent never opened. An agent handed someone else's 202 errors once discounts the gate from then on.

`report: "edited"` asks the narrower question. The check still runs whole — correct `tsconfig`, full program — and its output is parsed. It fails only on errors located in files the session edited:

```json
{ "name": "typecheck:lambda", "scope": "program", "command": "npx tsc --noEmit --pretty false -p .",
  "cwd": "workspaces/lambda", "when": ["workspaces/{lambda,shared}/**"],
  "report": "edited", "parse": "tsc" }
```

**Use it only for units that have a backlog.** A clean unit keeps `report: "all"`: its exit code catches an edit that breaks a file the session never opened, which `"edited"` by construction cannot. Most monorepos need it on one or two units, not all of them.

Filtering output adds a way to fake a pass that a plain exit code does not have — a crash, a config error or an unfamiliar format can all look like "no errors in your files". So an `edited` check passes only after its output is fully accounted for. In order, the first rule that applies decides:

1. A check that did not run — could not start, was killed, timed out, or was never started because the hook's time was spent — fails.
2. Exit 0 passes.
3. A line the parser does not recognise fails the check, with the full output shown unfiltered.
4. Output the parser knows means the run did not complete — a `tsconfig` error, mypy or pyright's fatal exit codes, a svelte-check `FAILURE` — fails unfiltered.
5. A non-zero exit with no error to explain it fails unfiltered.
6. An error count that disagrees with the tool's own summary fails unfiltered.
7. Errors with no file, in a file that does not exist, outside the checkout, or under `node_modules` are always kept. Errors in edited files are kept. The rest are not counted. Any kept error fails the check, and the block shows only those.

When nothing is kept, the check passes and you are told — once — how many errors it did not count. Only errors are attributed; a project that gates on warnings keeps `report: "all"`.

Rule 3 has a practical consequence: **call the tool directly** (`npx tsc …`), not through `npm run`, whose banner and error envelope are not the tool's output. And write the tool's machine-readable form where it has one: `mypy -O json`, `pyright --outputjson`, `svelte-check --output machine`.

There is no gate-owned baseline. A baseline snapshot assumes nothing else writes to the tree between snapshot and check; in a shared checkout it would count a sibling session's breakage anywhere as this session's. A tool's own baseline — ESLint's `eslint-suppressions.json`, basedpyright's baseline — works as-is, because the tool applies it and the gate sees an ordinary exit code. ESLint commands using one should add `--pass-on-unpruned-suppressions`, so that fixing a suppressed error does not read as a failure.

## Tests are watched, not run

A `unit` check can name a watcher instead of a command:

```json
{ "name": "test", "scope": "unit", "watch": "npx vitest --watch --reporter=json --outputFile={status}" }
```

The watcher starts in the background on the first edit matching its `when`, one per watch check per checkout, and stops on `SessionEnd`. At Stop the gate reads the report it produced rather than running a suite of its own, so a test gate costs no turn time. `{status}` is required: it is where the runner must write a JSON report with a boolean `success` (and optionally `numFailedTests` and `numTotalTests`).

The report is only believed when it is **newer than the last edit its `when` matches**. Freshness comes from the file's mtime, deliberately not from any timestamp inside the report — vitest's JSON reporter rewrites `success` on every re-run but leaves `startTime` frozen at the first one, so a gate trusting that field would call every verdict stale forever.

A report that is missing, stale or unparseable blocks the turn and says which. A watcher that has *died* does not, on its own: if its last report still postdates the last edit, that verdict is true.

Projects on Node's built-in test runner use the reporter shipped in `reporters/`, since `node --test` has none that emits a verdict:

```json
{ "name": "test", "scope": "unit", "watch": "LINT_GATE_STATUS={status} node --test --watch --test-reporter=${CLAUDE_PLUGIN_ROOT}/reporters/node-test-json.mjs" }
```

A suite that should run whole at Stop instead — a CDK project's `npm test`, or `cdk synth` — is a `unit` check with a `command`, with a `timeoutSec` that fits it.

## Repeating itself

A blocking hook that fires repeatedly will bounce an agent forever if it reports something the agent cannot fix. Two guards prevent that, and neither hides a failure:

- **`stop_hook_active`** — a `Stop` hook that already blocked this turn does not block again.
- **Failure memory** — a failure set is identified by each failing check's name, command, checkout and output (for an `edited` check, its attributed errors, so a line shift is not a new failure). A set the agent was already told about is not sent again; fix one failure and the set changes, so the rest still surface.

What a guard keeps from the agent is shown to you instead, once. Claude Code also ends a turn after eight consecutive Stop-hook continuations, so the gate can promise to ask and then tell you — never that an agent cannot stop while a check is red.

State lives under `~/.claude/lint-gate/`, per session and per teammate.

## Attribution has limits

A block says where a failure is, not who caused it, and the reason it gives the agent says so: a failure that is not the agent's to fix must be called out rather than left unmentioned.

| Scope | A block claims | Can wrongly blame the session when | Misses by design |
| --- | --- | --- | --- |
| `files` | files you edited fail this tool | a sibling session also edited that file | cross-file lint effects |
| `program`, `all` | the unit you touched is failing | anyone else broke that unit | units your edits' `when` does not reach |
| `program`, `edited` | errors located in files you edited | a sibling's change to a shared type surfaces in your file | your edit breaking a file you did not edit |
| `unit` | this unit's tests or build fail | anyone else broke that unit | — |

Every "wrongly blame" column empties when each session works in its own worktree (`claude --worktree`, or `isolation: worktree` for subagents). Teammates, plain parallel sessions and non-isolated subagents all share one working tree. A fresh worktree has no `node_modules` until someone installs them; a failing check there says so rather than presenting it as a type error.

## Requirements

**Node ≥ 23.6.** The hooks are TypeScript executed by Node's built-in type stripping — no build step, no dependencies, no install. `git` is used, when present, to tell checkouts of the project apart.

The gate's own machinery **fails open**: no config, an unparseable one, an unreadable state file or an unexpected exception lets the work through, because a missed lint is recoverable and a session that cannot finish a turn is not. A *check* fails closed: one that cannot start, is killed, runs out of time or whose output cannot be attributed is a check that did not pass.

## What this does not do

- **It does not attribute failures by ownership.** Scoping to a role's *owned globs* is not implemented — `TeammateIdle` carries `teammate_name`, and the team config joins a name to its `agentType`, so it is possible, but it would couple this plugin to a particular ownership map.
- **It does not discover build units.** Each `program` and `unit` check is written once per unit by `/lint-setup`, which is what lets every one be verified before it is trusted. A new workspace is ungated until `/lint-setup` runs again.
- **It does not replace CI.** It runs what the project already defines, at moments an agent is likely to stop and declare success.
