---
name: lint-setup
description: Detect or set up a project's formatter, linter, typechecker and tests, then wire them into lint-gate's config as scoped checks so the quality gate has commands to run. Use when lint-gate is installed but unconfigured, when a project has no formatter/linter yet, or to migrate a lint-gate config that still uses `lint`/`typecheck`/`test` keys.
argument-hint: "[optional: formatter/linter preference]"
disable-model-invocation: true
allowed-tools: Bash Read Glob Grep Edit Write AskUserQuestion
---

# /lint-setup

lint-gate runs checks; it does not choose them. This wires it up.

**The default is to adopt, not install.** Most projects already have a formatter and a linter, and the job is to find them and record how to run them. Installing a toolchain is the exception, and it is never done silently.

## Step 1: Find out what already exists

Do not skip this. Adding a second linter to a project that has one, or a dependency tree to a project that deliberately has none, is damage rather than setup.

```bash
ls -A | grep -iE '^(package\.json|deno\.jsonc?|biome\.jsonc?|\.prettierrc.*|prettier\.config\..*|eslint\.config\..*|\.eslintrc.*|\.oxlintrc.*|\.editorconfig|ruff\.toml|pyproject\.toml|Cargo\.toml|go\.mod|pnpm-workspace\.yaml|tsconfig.*\.json|cdk\.json)$'
```

Run it as written. Shell globs like `deno.json*` look equivalent, but under zsh, the macOS default, one pattern that matches nothing aborts the whole command with no output — which reads as "no tooling here" and leads straight to installing a second linter.

Then read `package.json`'s `scripts` and `devDependencies` if it exists, and `.claude/config/lint-gate.json` if the project already has one. What you are answering:

- **Which ecosystem is this?** Node, Deno, Python, Rust, Go — the answer decides everything downstream.
- **Is there already a linter, formatter, typechecker or test runner?** If yes, your job starts at Step 3.
- **Does the project have dependencies at all?** A repo with no `package.json`, or one with an empty `devDependencies`, may be zero-dependency **on purpose**. Adding `eslint` there is a decision for the user, not for you.
- **Is it a workspaces monorepo?** Then each package is its own build unit — Step 3d.
- **Is there an existing lint-gate config with `lint`, `typecheck` or `test` keys?** Those keys are no longer read. Migrate it — Step 3e.

## Step 2: Only if nothing exists — propose, do not install

Use `AskUserQuestion`. Offer the options that fit the ecosystem you found, and say what each one adds. For a Node project that means roughly: Biome (one tool, one dependency, fast), oxlint (one tool, very fast, type-aware with a tsconfig), or ESLint plus Prettier (ubiquitous, more configuration, more dependencies).

Two things to say out loud in the question, because they are the reasons a user might decline:

- how many dependencies it adds, and
- that a zero-dependency project stops being one.

If the user declines, that is a complete outcome. Wire up nothing and say so — a project can legitimately have no linter.

## Step 3: Write the checks

Write `.claude/config/lint-gate.json`:

```json
{
  "format": "npx prettier --write --ignore-unknown {file}",
  "checks": [
    { "name": "lint", "scope": "files", "command": "npx eslint --no-warn-ignored {files}" },
    { "name": "typecheck", "scope": "program", "command": "npm run typecheck" }
  ]
}
```

Rules for this file:

- **Omit what does not exist.** A check is only ever run because the project named it. Never invent a command hoping it works — a command that cannot start is a failure the agent is then told to fix.
- **`format` acts on one file**, after every edit. `{file}` is replaced by the edited path, shell-quoted; without it the path is appended. If the project's formatter cannot take a single path, omit `format` rather than pointing it at the whole tree.
- **Every check is owed only by an edit** that matches its `when` (any edit, if it has none). A session that edited nothing runs nothing.
- **Never point a check at a laxer variant to make the gate quieter** — no `--max-warnings=999`, no `|| true`, no hand-narrowed path chosen to dodge known failures. The whole value of the gate is that its failure means something. `{files}` and `report: "edited"` are not this: they change *which* errors are the session's, not how hard anything is checked.

### Step 3a: Give each tool the scope that fits how it checks

| The tool… | Scope | Command |
| --- | --- | --- |
| checks each file on its own — eslint, oxlint, stylelint, ruff, biome lint | `files` | must contain `{files}` |
| needs the whole program to resolve types — tsc, svelte-check, mypy, pyright | `program` | runs whole; never `{files}` |
| produces a verdict with no file locations — tests, builds, `cdk synth` | `unit` | a one-shot `command`, or a `watch` (Step 3c) |

The gate rejects a `files` check without `{files}` and a `program` or `unit` check with it, and tells the user. That is deliberate: `tsc` handed a list of paths ignores `tsconfig.json` and silently checks something else, which looks like a pass.

A `files` command must accept paths as trailing arguments. `npm run lint {files}` does not — npm needs `npm run lint -- {files}`, and a script that pins its own path (`eslint .`) ignores anything appended. Prefer the binary (`npx eslint {files}`) when the script pins a path. Verify in Step 4, not by assumption.

### Step 3b: Measure each unit's backlog, and decide how its errors are counted

Run each `program` check once and count the errors it reports today. Then, per unit:

- **Zero, or small enough to fix now:** keep the default, `report: "all"`. The exit code decides, and it catches an edit that breaks a file the session never opened. That is the stronger gate; a clean unit pays nothing for it.
- **A real backlog that is not this session's to fix:** set `report: "edited"` with the matching `parse`, so only errors located in files the session edited block. Call the tool directly, in its machine-readable form, because any line the parser does not recognise fails the check unfiltered:

| Tool | Command form | `parse` |
| --- | --- | --- |
| tsc | `npx tsc --noEmit --pretty false -p .` | `tsc` |
| mypy | `mypy -O json …` (or plain text) | `mypy-json` (or `mypy`) |
| pyright | `npx pyright --outputjson` | `pyright-json` |
| svelte-check | `npx svelte-check --output machine` | `svelte-check-machine` |

Not `npm run typecheck`: npm's banner and error envelope are not the tool's output. A tool without a parser here, or one that gates on warnings, keeps `report: "all"`.

For a `files` linter with a backlog, `{files}` already scopes it — nothing more to decide. If the project already uses a tool's own baseline (ESLint's `eslint-suppressions.json`, basedpyright's baseline), keep it; the gate sees the tool's exit code. Add `--pass-on-unpruned-suppressions` to an ESLint command that uses suppressions, so fixing a suppressed error does not fail the check. There is no lint-gate baseline, so do not offer one.

### Step 3c: Tests and other unit checks

A suite that costs minutes should not run at every Stop. If the runner has a watch mode with a JSON reporter, watch it instead — the gate starts the watcher on the first matching edit and reads its verdict at Stop:

```json
{ "name": "test", "scope": "unit", "watch": "npx vitest --watch --reporter=json --outputFile={status}" }
```

- **`{status}` is required.** It is where the runner must write a JSON report; the gate owns the path. Do not point the runner at a path of your own choosing.
- **The report needs a boolean `success` field.** `numFailedTests` and `numTotalTests` are used for the message when present. Vitest's `json` reporter provides all three; another runner needs a reporter that produces the same shape.
- **A missing, stale or unreadable report blocks the turn.** "I could not tell whether the tests pass" is not permission to finish.
- **Never put a one-shot run in `watch`.** `"watch": "npx vitest run …"` exits immediately, and the gate then sees a watcher that is not running.

**If the project uses Node's built-in test runner**, it needs the reporter this plugin ships — `node --test` has no built-in reporter that emits a verdict:

```json
{ "name": "test", "scope": "unit", "watch": "LINT_GATE_STATUS={status} node --test --watch --test-reporter=${CLAUDE_PLUGIN_ROOT}/reporters/node-test-json.mjs" }
```

The path goes through the environment, not `--test-reporter-destination`. Under `--watch` the reporter's event stream never ends, so a reporter that emits after its loop never emits — the report file would stay empty forever. Do not "simplify" this to the destination flag.

A check that should run whole at Stop — a CDK project's `npm test`, `cdk synth`, a build — is a `unit` check with a `command`. Measure how long it takes and set `timeoutSec` above that; the default is 180, and a check that runs longer fails.

### Step 3d: In a monorepo, write one check per build unit

If `package.json` has `workspaces` (or there is a `pnpm-workspace.yaml`), each package is a build unit. Check each one's own scripts before writing a single command. When packages genuinely differ — one typechecks with `tsc`, another with `svelte-check`; `stylelint` is configured for one package and errors outside it — write a check per package, each with its `cwd` and `when`:

```json
{
  "checks": [
    { "name": "lint", "scope": "files", "command": "npx eslint --no-warn-ignored {files}" },
    { "name": "stylelint:admin", "scope": "files", "command": "npx stylelint {files}", "cwd": "workspaces/admin",
      "when": "workspaces/admin/**/*.{css,svelte}" },
    { "name": "typecheck:api", "scope": "program", "command": "npm run typecheck", "cwd": "workspaces/api",
      "when": ["workspaces/{api,shared}/**", "tsconfig.base.json", "package-lock.json"] },
    { "name": "check:admin", "scope": "program", "command": "npm run check", "cwd": "workspaces/admin",
      "when": ["workspaces/{admin,shared}/**", "package-lock.json"] }
  ]
}
```

- **Write `when` from the dependency graph, not the folder name.** A unit's check is owed by an edit to the unit itself, to every workspace package it depends on, and to the global inputs it reads — the lockfile, a shared `tsconfig.base.json`. Read each package's `dependencies` for workspace packages. A `typecheck:api` watching only `workspaces/api/**` never runs when an edit to `shared` breaks `api`, which is the most common type error an agent introduces.
- **`cwd` is where the command runs, and `{files}` paths are relative to it.** `when` is always relative to the checkout root.
- **Every check runs and every failure is reported.** Never chain with `&&` — the first failure hides the rest.
- **A package with no checker gets no check.** Say which packages are ungated in Step 5.
- **Names are unique.** Suffix them with the package: `typecheck:api`.

### Step 3e: Migrating a config that uses `lint`, `typecheck` or `test`

Those keys are ignored now, and the gate tells the user so once per session. Rewrite them into `checks`, keeping their order — `lint` entries first, then `typecheck`, then `test`:

| Before | After |
| --- | --- |
| `"lint": "npx eslint {files}"` | `{ "name": "lint", "scope": "files", "command": "npx eslint {files}" }` |
| `"lint": "npm run lint"` (no `{files}`) | `{ "name": "lint", "scope": "program", "command": "npm run lint" }` |
| `"typecheck": "npm run typecheck"` | `{ "name": "typecheck", "scope": "program", "command": "npm run typecheck" }` |
| a list entry `{ "command": …, "when": … }` | the same, with a unique `name` and the scope chosen as above |
| `"test": { "watch": "…{status}" }` | `{ "name": "test", "scope": "unit", "watch": "…{status}" }` |

Two things behave differently after migrating, so go through Step 3b and Step 4 again for every check:

- **A check without `{files}` no longer runs in a session that edited nothing.** It runs once anything matching its `when` was edited.
- **A `when` glob that matched an edit in a worktree now matches it relative to the worktree.** Globs are relative to whichever checkout the edit is in.

A whole-repo `npm run lint` migrated as a `program` check is correct but strong; if the backlog is real, switch it to a `files` check with `{files}` (Step 3a).

## Step 4: Verify every check in both directions

A config you have not executed is not done. Every check has to be seen failing on a problem and passing on clean code. A linter that reports problems but exits 0 — some do by default — will never trigger the gate, which is worse than having no gate, because it looks configured. If you find that, fix the command so failure is a non-zero exit, and say that you did.

Run each command from its `cwd`, exactly as written:

```bash
(cd workspaces/api && npm run typecheck); echo "exit=$?"
```

That run shows one direction only — exit 0 on a clean unit, non-zero on one with a backlog. Observe the other direction as follows.

**Pass path on a unit with a backlog.** Run the same linter, with the same flags, on a file you know is clean:

```bash
npx eslint path/to/a/clean/file.ts; echo "exit=$?"   # expect 0
```

**Failure path on a clean unit.** Add a probe file with a deliberate error, run the command, then delete the probe and confirm it is gone:

```bash
printf 'const n: number = "boom"\nexport default n\n' > src/__lint_gate_probe.ts
npm run typecheck; echo "exit=$?"                      # expect non-zero
rm -f src/__lint_gate_probe.ts
git status --porcelain -- src/__lint_gate_probe.ts     # expect no output
```

Place the probe where the command actually looks — inside a path the `tsconfig` includes, or the linter's target directory. If the command still exits 0, check the probe's location before concluding the command is broken. Confirm the deletion every time: a deliberate error left in the tree is worse than the unverified gate it was meant to test, and it is easy to lose in a dirty working tree. Use a lint violation the project's rules actually flag (an unused variable, say) to probe a linter.

A `report: "all"` program check that already fails on its backlog has no observable pass path. Record that direction as unverified and report it in Step 5 — or, if the backlog is not the session's to fix, that unit wants `report: "edited"`.

**`files` checks** cannot be run as written. Substitute paths by hand and run both directions — a file you know has problems (expect non-zero) and a clean one (expect 0):

```bash
npx eslint --no-warn-ignored path/to/a/real/file.ts; echo "exit=$?"
```

If it exits 0 on a file you know has problems, the placeholder is being ignored — the command is pinned to its own path somewhere, and the gate would silently never fire.

**`report: "edited"` checks** need three observations, because their job is attribution:

1. A probe error in a file the session would have edited must be reported — run the command and confirm the probe's line appears in the output, in the format the `parse` reads.
2. An existing backlog error elsewhere must be in the same output too, so the gate has something to filter. Confirm the output contains nothing but diagnostics, continuation lines and the tool's summary — any other line fails the check unfiltered.
3. A deliberately broken config — an unknown option in `tsconfig.json`, a syntax error in `mypy.ini` — must make the command fail in a way the parser treats as fatal. Restore the config and confirm `git status` shows it unchanged.

**`format`** is verified by what it touches, not by its exit code: a formatter pointed at the whole tree also exits 0. On a working tree with no other uncommitted changes, run the recorded command with `{file}` replaced by a real path and compare the tree before and after:

```bash
before=$(git status --porcelain)
npx prettier --write --ignore-unknown path/to/file.ts
diff <(echo "$before") <(git status --porcelain)       # expect only path/to/file.ts, or nothing
```

Any other path in the diff means the command reaches beyond `{file}`. Restore those files and fix the command, or omit `format`.

## Step 5: Report

State what was found versus what was added, the exact checks recorded with their scope and `when`, and anything deliberately omitted and why. If you declined to install something, say that too — a project left without a linter by choice should be visible in the transcript, not silently absent.

Report each check's verification result in both directions, and name any direction you could not observe — an unverified pass path is exactly how a gate that never fires ends up looking configured.

**Name every `report: "edited"` unit and its backlog count.** In those units the gate does not see an edit that breaks a file the session did not edit; that is the one setting here that makes the gate check less than it looks like it does, and the count is what the user needs to decide whether to clear the backlog and switch the unit back to `"all"`.

If the project's work happens in parallel sessions or agent teams, say that attribution is by file location, not cause: in a shared working tree one session's change can surface as an error in another session's file. Recommend worktree sessions (`claude --worktree`, or `isolation: worktree` for subagents) for parallel work — the gate checks each worktree from itself.

## What this skill does not do

- **It does not set or change lint rules.** Which rules a project enforces is a project decision.
- **It does not fix existing failures.** Wiring the gate up may reveal a backlog; report the count and let the user decide whether to fix it, scope it (Step 3b), or defer.
- **It does not touch CI.** If CI runs a different command than the one recorded here, say so — that drift is worth knowing about — but changing CI is a separate decision.
