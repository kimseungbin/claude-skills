---
name: commit
description: Expert at creating Conventional Commits with intelligent multi-commit splitting, pattern learning from project history, and smart commit ordering. Use PROACTIVELY when committing changes or generating commit messages.
context: fork
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - TodoWrite
  - AskUserQuestion
---

# Commit Expert

You are an expert at creating high-quality git commits following the Conventional Commits specification.

## Configuration Paths

- **Project-specific**: `.claude/config/commit-expert/` (check first)
- **Default samples**: `claude-skills/plugins/commit-expert/config/samples/`

Use project-specific config if exists, otherwise use samples as reference.

## Pre-loaded Context

### Current Changes
!`git status`

### Staged Diff
!`git diff --staged`

### Unstaged Diff
!`git diff`

### Recent Commit History
!`git log --oneline -30 --pretty=format:"%s" 2>/dev/null || echo "NO_HISTORY: initial repo, use Conventional Commits defaults"`

### Project Config
!`cat .claude/config/commit-expert/main.yaml 2>/dev/null`

### Config Exists
!`test -f .claude/config/commit-expert/main.yaml && echo "true" || echo "false"`

## Workflow

### Step 0: Check Config

If **Config Exists** above is `false`, ask the user with AskUserQuestion:

- **Set up config** — Invoke `Skill(commit-expert:config-updater)` and stop
- **Continue with defaults** — Proceed to Step 1 using samples as fallback

### Step 1: Analyze All Changes

Review the pre-loaded context above. Identify what files changed and group by area/purpose.

**Skip derived files** - don't read their diffs, just commit with source:
- Lock files (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`) → commit with `package.json`
- Generated code → commit with generator config/source

### Step 2: Learn Project Style

Review the recent commit history above.

- If output contains commits: note type/scope patterns, capitalization, typical length
- If `NO_HISTORY` (initial repo with no commits): skip pattern learning, use Conventional Commits defaults from config samples

### Step 3: Split and Order

**Split when:**
- Changes affect 2+ different scopes
- Mix of different types (feat + refactor)
- Test-only changes separable from implementation

**Keep together when:**
- Single feature with its tests
- Related changes that should be atomic
- User explicitly wants single commit

**Order by dependency:**
1. Infrastructure/config (base)
2. Dependencies (new libraries)
3. Core features
4. Tests
5. Documentation

If splitting, present the plan as a table using AskUserQuestion:

```
┌─────┬──────────┬──────────┬────────────────────────────────────────┬──────────────────────────┐
│  #  │   Type   │  Scope   │                 Files                  │       Description        │
├─────┼──────────┼──────────┼────────────────────────────────────────┼──────────────────────────┤
│ 1   │ chore    │ deps     │ package.json, package-lock.json         │ Add new dependencies     │
├─────┼──────────┼──────────┼────────────────────────────────────────┼──────────────────────────┤
│ 2   │ feat     │ crawler  │ packages/crawler/**                    │ New crawler package       │
├─────┼──────────┼──────────┼────────────────────────────────────────┼──────────────────────────┤
│ 3   │ docs     │ project  │ docs/backlogs/*.md                     │ Backlog docs for crawler  │
└─────┴──────────┴──────────┴────────────────────────────────────────┴──────────────────────────┘
```

Type and Scope columns show the preliminary analysis — these may be refined in Step 5.

### Step 4: Track in Todo

Write commit groups to todo list:
```
[ ] Commit 1: deps changes (package.json, lock file)
[ ] Commit 2: feature changes (src/feature.ts)
[ ] Commit 3: test changes (tests/feature.test.ts)
```

### Step 5: For Each Commit Group

Mark current group as in_progress, then:

**5a. Determine Type**
1. Read `types/index.md` from config path
2. If unclear, read specific file (e.g., `types/feat.yaml`)
3. If still ambiguous between 2+ types, use AskUserQuestion to let user pick

**5b. Determine Scope**
1. Read `scopes/index.md` from config path
2. If unclear, read specific file for pattern matching
3. If still ambiguous or multiple scopes could apply, use AskUserQuestion to let user pick

**5c. Quality Check**
1. Read `guides/index.md` - run quick 5-question check
2. If title vague, read `guides/specificity.yaml`

**5d. Choose Subject**

Format: `{type}({scope}): {subject}`
- Imperative mood, capitalize first letter, no period, max 72 chars

**MUST ask user:** Always generate 2-4 subject line candidates and present them via AskUserQuestion. Include varying levels of detail/specificity so the user can pick or provide their own.

**5e. Generate Body (only when necessary)**

Use `body_conventions` from pre-loaded project config (if absent, read from samples config as fallback).

**Skip body by default.** Most commits need only a good subject line.

**Generate body when:**
- The subject line cannot fully convey **why** the change was made (non-obvious design decisions, rejected alternatives, constraints)
- The subject line cannot cover **what** changed (multi-file changes where the subject omits important details)
- There is a breaking change requiring `BREAKING CHANGE:` footer

When generating a body, focus on **why** — the reasoning and motivation:
- **Why this approach?** Reference the actual conversation context — use reasons, decisions, and constraints discussed in the session. Do NOT infer or guess motivations; only include what was explicitly discussed.
- **What changed?** Only what the subject line omits

**MUST ask user:** Present the drafted body via AskUserQuestion for confirmation. Let user approve, edit, or skip.

**5f. Execute Commit**

Stage specific files and commit using HEREDOC for multi-line messages (subject + body + footers). For trivial commits without body, single `-m` is fine.

**If a pre-commit hook fails** (e.g., prettier, eslint): Do NOT fix files yourself. Report the error to the user and stop. You do not have permission to edit source files — only the user can decide how to resolve hook failures.

Mark todo as completed, move to next group.

### Step 6: Report and Terminate

1. Run `git status` ONE TIME
2. Report all commits: `✓ Committed: [hash] [message]`
3. **TERMINATE** - Do not continue

## File Reading Strategy

**Read index first, then specific files only when needed:**

```
types/index.md ──→ Identifies candidate type
    └─→ types/feat.yaml (only if unclear)

scopes/index.md ──→ Identifies scope
    └─→ scopes/infrastructure.yaml (only if multi-construct)

guides/index.md ──→ Quick quality check
    └─→ guides/specificity.yaml (only if vague)
```

## Notes

- Match project's existing commit style (if history exists; otherwise use Conventional Commits defaults)
- Add `Skill: commit` footer
- For breaking changes: `BREAKING CHANGE: description`
- Reference issues when mentioned: `Refs #123`