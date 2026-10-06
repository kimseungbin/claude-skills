---
name: lint-setup
description: Detect or set up a project's formatter and linter, then wire them into lint-gate's config so the quality gate has commands to run. Use when lint-gate is installed but unconfigured, or when a project has no formatter/linter yet.
argument-hint: "[optional: formatter/linter preference]"
disable-model-invocation: true
allowed-tools: Bash Read Glob Grep Edit Write AskUserQuestion
---

# /lint-setup

lint-gate runs commands; it does not choose them. This wires it up.

**The default is to adopt, not install.** Most projects already have a formatter and a linter, and the job is to find them and record how to run them. Installing a toolchain is the exception, and it is never done silently.

## Step 1: Find out what already exists

Do not skip this. Adding a second linter to a project that has one, or a dependency tree to a project that deliberately has none, is damage rather than setup.

```bash
ls -A | grep -iE '^(package\.json|deno\.jsonc?|biome\.jsonc?|\.prettierrc.*|prettier\.config\..*|eslint\.config\..*|\.eslintrc.*|\.oxlintrc.*|\.editorconfig|ruff\.toml|pyproject\.toml|Cargo\.toml|go\.mod)$'
```

Run it as written. Shell globs like `deno.json*` look equivalent, but under zsh, the macOS default, one pattern that matches nothing aborts the whole command with no output — which reads as "no tooling here" and leads straight to installing a second linter.

Then read `package.json`'s `scripts` and `devDependencies` if it exists. What you are answering:

- **Which ecosystem is this?** Node, Deno, Python, Rust, Go — the answer decides everything downstream.
- **Is there already a linter or formatter?** If yes, your job is Step 3 only.
- **Does the project have dependencies at all?** A repo with no `package.json`, or one with an empty `devDependencies`, may be zero-dependency **on purpose**. Adding `eslint` there is a decision for the user, not for you.
- **Is there an existing script name?** `npm run lint` is worth more than a raw `npx eslint .` — it survives the project changing tools.

## Step 2: Only if nothing exists — propose, do not install

Use `AskUserQuestion`. Offer the options that fit the ecosystem you found, and say what each one adds. For a Node project that means roughly: Biome (one tool, one dependency, fast), or ESLint plus Prettier (ubiquitous, more configuration, more dependencies).

Two things to say out loud in the question, because they are the reasons a user might decline:

- how many dependencies it adds, and
- that a zero-dependency project stops being one.

If the user declines, that is a complete outcome. Wire up nothing and say so — a project can legitimately have no linter.

## Step 3: Wire the commands into lint-gate

Write `.claude/config/lint-gate.json`. Prefer the project's own script names over raw binaries:

```json
{
  "format": "npm run format -- {file}",
  "lint": "npm run lint",
  "typecheck": "npm run typecheck"
}
```

Rules for this file:

- **Omit what does not exist.** An absent key means that check never runs. Never invent a command hoping it works — a command that fails to spawn produces a failure the agent is then told to fix.
- **`format` acts on one file.** `{file}` is replaced by the edited path, shell-quoted for you; without the placeholder the path is appended. If the project's formatter cannot take a single path, omit `format` rather than pointing it at the whole tree on every edit.
- **`lint` and `typecheck` run when an agent believes it is finished**, not per edit.
- **`test` is watched, not run.** See Step 3c.
- **Never point a command at a laxer variant to make the gate quieter** — no `--max-warnings=999`, no `|| true`, no hand-narrowed path chosen to dodge known failures. The whole value of the gate is that its failure means something. Scoping `lint` with `{files}` (below) is not this: it changes *which files are examined*, not how hard they are examined.

### Step 3c: Wire a test watcher, if the project has tests

Tests are the one check the gate does not run. A suite costs minutes, and running it at the end of every turn means the agent waits every time. A watcher is already re-running the affected tests on save, so the gate reads its verdict instead:

```json
"test": { "watch": "npx vitest --watch --reporter=json --outputFile={status}" }
```

The gate starts this in the background on the first edit of a session, and stops it when the session ends. At Stop it reads the report and blocks if the tests failed — or if it cannot tell.

Rules for this key:

- **`{status}` is required.** It is where the runner must write a JSON report; the gate owns the path. A watch command without it is dropped, because there would be nothing to read. Do not try to point the runner at a path of your own choosing.
- **The report needs a boolean `success` field.** `numFailedTests` and `numTotalTests` are used for the message when present. Vitest's `json` reporter provides all three; another runner needs a reporter that produces the same shape.
- **A missing, stale or unreadable report blocks the turn.** "I could not tell whether the tests pass" is not permission to finish — that is the whole reason this is a verdict to read rather than a command to run.
**If the project uses Node's built-in test runner**, it needs the reporter this plugin ships — `node --test` has no built-in reporter that emits a verdict:

```json
"test": { "watch": "LINT_GATE_STATUS={status} node --test --watch --test-reporter=${CLAUDE_PLUGIN_ROOT}/reporters/node-test-json.mjs" }
```

The path goes through the environment, not `--test-reporter-destination`. Under `--watch` the reporter's event stream never ends, so a reporter that emits after its loop never emits — the report file would stay empty forever. Do not "simplify" this to the destination flag.

- **Do not configure a one-shot run here.** `"watch": "npx vitest run ..."` would exit immediately, and the gate would then see a watcher that is not running. If the project genuinely wants a full suite per turn, put it in `lint` instead and accept the cost.

### Step 3b: Decide whether `lint` should be scoped with `{files}`

`{files}` expands to every path edited during the session that lies inside the project — paths outside it are dropped, since no project command could resolve them. It is the answer to a specific problem: on a repo with a pre-existing lint backlog, a project-wide `lint` fails at the end of every task over files the agent never opened, and an agent that has been handed someone else's 31 errors once will discount the gate from then on.

Count the existing failures first — Step 4 makes you run the command anyway. Then:

- **Backlog is zero, or small enough to fix now:** keep `lint` project-wide. It is the stronger gate, and a clean repo pays nothing for it.
- **Backlog is real and not yours to fix in this session:** scope it, and say you did.

```json
{
  "format": "npx prettier --write --ignore-unknown {file}",
  "lint": "npx eslint --no-warn-ignored {files}"
}
```

Two things to check before writing `{files}`:

- **The command must accept paths as trailing arguments.** `npm run lint {files}` does not — npm needs `npm run lint -- {files}`, and the underlying script must not already pin its own path (`eslint .` ignores anything you append). Verify in Step 4, not by assumption.
- **Never put `{files}` in `typecheck`.** `tsc --noEmit` needs the whole program; individual paths break `tsconfig` resolution and silently change what is checked — it will appear to pass. The hook honors whatever you write, so this rule is yours to keep. If the user asks for a scoped typecheck anyway, say plainly that it would report less than it appears to, and leave `typecheck` project-wide.

## Step 4: Verify the commands actually run

A config you have not executed is not done. Run each one exactly as written:

```bash
npm run lint; echo "exit=$?"
```

Confirm that a passing command exits 0 and a failing one exits non-zero. A linter that reports problems but exits 0 — some do by default — will never trigger the gate, which is worse than having no gate, because it looks configured. If you find that, fix the command so failure is a non-zero exit, and say that you did.

Then check the formatter on a single file and confirm it edits only that file.

A command with `{files}` cannot be run as written, so substitute a path by hand and check both directions — that a real path is actually examined, and that the exit code still means something:

```bash
npx eslint --no-warn-ignored path/to/a/real/file.ts; echo "exit=$?"
```

If it exits 0 on a file you know has problems, the placeholder is being ignored — the command is pinned to its own path somewhere, and the gate would silently never fire.

## Step 5: Report

State what was found versus what was added, the exact commands recorded, and anything deliberately omitted and why. If you declined to install something, say that too — a project left without a linter by choice should be visible in the transcript, not silently absent.

If you scoped `lint` with `{files}`, report the pre-existing failure count you measured and say that those files are now outside what the gate examines. That number is the thing a user needs in order to decide whether to fix the backlog later, and scoping is the one choice here that makes the gate check *less* than it looks like it does.

## What this skill does not do

- **It does not set or change lint rules.** Which rules a project enforces is a project decision.
- **It does not fix existing lint failures.** Wiring the gate up may reveal a backlog of them; report the count and let the user decide whether to fix, ratchet, or defer.
- **It does not touch CI.** If CI runs a different command than the one recorded here, say so — that drift is worth knowing about — but changing CI is a separate decision.
