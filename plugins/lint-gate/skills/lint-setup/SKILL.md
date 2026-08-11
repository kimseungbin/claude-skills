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
ls package.json deno.json* biome.json* .prettierrc* prettier.config.* \
   eslint.config.* .eslintrc* .editorconfig ruff.toml pyproject.toml Cargo.toml go.mod 2>/dev/null
```

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
- **`lint` and `typecheck` act on the project.** They run when an agent believes it is finished, not per edit.
- **Never point a command at a laxer variant to make the gate quieter** — no `--max-warnings=999`, no narrowed path, no `|| true`. The whole value of the gate is that its failure means something.

## Step 4: Verify the commands actually run

A config you have not executed is not done. Run each one exactly as written:

```bash
npm run lint; echo "exit=$?"
```

Confirm that a passing command exits 0 and a failing one exits non-zero. A linter that reports problems but exits 0 — some do by default — will never trigger the gate, which is worse than having no gate, because it looks configured. If you find that, fix the command so failure is a non-zero exit, and say that you did.

Then check the formatter on a single file and confirm it edits only that file.

## Step 5: Report

State what was found versus what was added, the exact commands recorded, and anything deliberately omitted and why. If you declined to install something, say that too — a project left without a linter by choice should be visible in the transcript, not silently absent.

## What this skill does not do

- **It does not set or change lint rules.** Which rules a project enforces is a project decision.
- **It does not fix existing lint failures.** Wiring the gate up may reveal a backlog of them; report the count and let the user decide whether to fix, ratchet, or defer.
- **It does not touch CI.** If CI runs a different command than the one recorded here, say so — that drift is worth knowing about — but changing CI is a separate decision.
