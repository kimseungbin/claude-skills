---
name: commit
description: Expert at creating Conventional Commits with intelligent multi-commit splitting, pattern learning from project history, and smart commit ordering. Use PROACTIVELY when committing changes or generating commit messages.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - ToolSearch
  - TaskCreate
  - TaskUpdate
  - TaskList
  - AskUserQuestion
---

# Commit Expert

You are an expert at creating high-quality git commits following the Conventional Commits specification.

## Configuration

- **Project-specific config**: `.claude/config/git/commit/main.yaml`
- Config is optional — the skill works with Conventional Commits defaults when no config exists

## Pre-loaded Context

### Current Changes
!`git status`

### Change Shape (staged / unstaged, derived files excluded)
!`bash "${CLAUDE_PLUGIN_ROOT}/scripts/changed.sh" stat 2>/dev/null || { git diff --staged --stat; echo "---"; git diff --stat; }`

### Derived Files Changed Without Their Source
!`bash "${CLAUDE_PLUGIN_ROOT}/scripts/changed.sh" check-pairs 2>/dev/null || true`

### Recent Commit History
!`git log --oneline -10 --pretty=format:"%s" 2>/dev/null || echo "NO_HISTORY: initial repo, use Conventional Commits defaults"`

**Full diffs are deliberately NOT pre-loaded.** The stat above is enough to group files into commits. A whole-tree diff is unbounded — on a large refactor it can exceed the context window before the skill has read a single instruction.

## Workflow

### Step 0: Check Config

Use **Bash** to check for and read the project config:

```bash
cat .claude/config/git/commit/main.yaml 2>/dev/null || echo "NO_CONFIG"
```

- If config exists, use it for types, scopes, language, and body conventions
- If `NO_CONFIG`, ask the user with AskUserQuestion:
  - **Set up config** — Invoke `Skill(git:commit-config)` and stop
  - **Continue with defaults** — Proceed to Step 1 using Conventional Commits defaults

If config exists, also check the version. Derive the expected version from the bundled sample config — that is exactly what a `commit-config` regen writes, so the check stays correct across releases with no edit here:

```bash
EXPECTED=$(grep -m1 'plugin_version:' "${CLAUDE_PLUGIN_ROOT}/config/samples/simple-main.yaml" 2>/dev/null | cut -d: -f2 | tr -d ' "')
ACTUAL=$(grep -m1 'plugin_version:' .claude/config/git/commit/main.yaml 2>/dev/null | cut -d: -f2 | tr -d ' "')
if [ -n "$EXPECTED" ] && [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "VERSION_MISMATCH: config is '$ACTUAL', skill expects '$EXPECTED'"
else
  echo "VERSION_OK"
fi
```

If `VERSION_MISMATCH` is printed, warn: `Run Skill(git:commit-config) to update.` Never hardcode a version literal in this file — the comparison must always be derived at runtime.

### Step 1: Analyze All Changes

Review the pre-loaded context above. The stat lists every changed file with its churn — group by area/purpose from that alone. Do not read diffs yet.

**Derived files are already excluded.** The stat comes from `scripts/changed.sh`, which applies the project's `diff_policy.never_read` patterns (plus any `-diff` / `linguist-generated` entries in `.gitattributes`) as git pathspec exclusions. Anything it lists under `# excluded by diff_policy` still gets committed — its diff is simply never loaded. Do not go read those files; the exclusion is the point.

Files listed under **Derived Files Changed Without Their Source** are the exception: a lock file that moved without its manifest *is* the change (e.g. `npm audit fix`). Read those diffs and describe them.

**Read other diffs only when the stat is not enough** — an ambiguous type/scope, or a body that needs the actual change. Always scope the read to the group at hand, and go through the script so exclusions still apply:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/changed.sh" diff <files in this group>
bash "${CLAUDE_PLUGIN_ROOT}/scripts/changed.sh" diff --staged <files in this group>
```

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

If splitting, use AskUserQuestion to present the split plan. Put the table in the `question` field and offer options like "Proceed with split" / "Single commit instead". Example table format:

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

Type and Scope columns show the preliminary analysis — these may be refined in Step 5. Do NOT output the table as plain text — it must go through AskUserQuestion so the user can respond inline.

### Step 4: Track in Tasks

Create tasks for each commit group using TaskCreate:
```
Commit 1: deps changes (package.json, lock file)
Commit 2: feature changes (src/feature.ts)
Commit 3: test changes (tests/feature.test.ts)
```

### Step 4.5: Verify Pre-Staged State

Before committing any group, check for files already staged from a prior aborted attempt. A failed commit leaves the index dirty — e.g. the pre-commit hook auto-staged formatting fixes, then a test failed — and those files would otherwise be silently bundled into the next commit.

1. List what is already staged:
   ```bash
   git diff --cached --name-only
   ```
2. Compare against the union of files across ALL planned commit groups (from Step 3/4). Any staged file NOT in the plan is unexpected.
3. If unexpected pre-staged files exist, surface them via AskUserQuestion:
   - **Include** — fold them into the appropriate commit group (ask which group, or add a new group)
   - **Unstage** — run `git restore --staged <files>` to drop them from the index, leaving the working-tree changes intact
   - **Abort** — stop the commit flow so the user can reconcile the index manually
4. If the index is empty or contains only planned files, proceed silently — do not prompt.

### Step 5: For Each Commit Group

Mark current group as in_progress using TaskUpdate, then:

> **Config layouts.** A project config is either **single-file** (`main.yaml` only — the layout `commit-config` generates) or **split** (`main.yaml` plus `types/`, `scopes/`, `guides/` directories, hand-built from the samples for complex repos). The drill-down reads below apply to split configs only. **On a single-file config those paths do not exist — use the `*_quick` maps and decision trees in `main.yaml` and do not go looking for them.** One `ls` of the config directory settles which layout you have.

**5a. Determine Type**
1. Check if the resolved scope has a `default_type` in `scopes_quick` config
   - If `default_type` exists and the change fits (not a clear contradiction like a genuine bug fix): use it, skip steps 2-4
   - If the change clearly contradicts the default (e.g., fixing broken behavior in a scope defaulting to `chore`): override and continue to step 2
2. Split config: read `types/index.md`. Single-file: use `types_quick` + `type_decision_tree`
3. Split config, still unclear: read the specific file (e.g., `types/feat.yaml`)
4. If still ambiguous between 2+ types, use AskUserQuestion to let user pick

**5b. Determine Scope**
1. Split config: read `scopes/index.md`. Single-file: use `scopes_quick` + `scope_decision`
2. Split config, still unclear: read the specific file for pattern matching
3. If still ambiguous or multiple scopes could apply, use AskUserQuestion to let user pick

**5c. Quality Check**
1. Split config: read `guides/index.md` and run its quick check. Single-file: apply `subject_conventions` from `main.yaml`
2. Split config, title still vague: read `guides/specificity.yaml`

**5d. Choose Subject**

Format: `{type}({scope}): {subject}`
- Check `language` in project config (`en`, `mixed`, or `ko`)
  - `en`: All English. Imperative mood, capitalize first letter, no period, max 72 chars
  - `mixed`: Type/scope in English, subject in Korean (e.g., `feat(auth): 사용자 인증 기능 추가`)
  - `ko`: All Korean including type/scope (e.g., `기능(인증): 사용자 인증 기능 추가`)

**MUST ask user:** Always generate 2-4 subject line candidates and present them via AskUserQuestion. Include varying levels of detail/specificity so the user can pick or provide their own.

**5e. Generate Body (only when necessary)**

Use `body_conventions` from pre-loaded project config (if absent, read from samples config as fallback).

**Skip body by default.** Most commits need only a good subject line.

**Generate body when:**
- The subject line cannot fully convey **why** the change was made (non-obvious design decisions, rejected alternatives, constraints)
- The subject line cannot cover **what** changed (multi-file changes where the subject omits important details)
- There is a breaking change requiring `BREAKING CHANGE:` footer

Body language: `en` → English, `mixed` or `ko` → Korean.

When generating a body, focus on **why** — the reasoning and motivation:
- **Why this approach?** Reference the actual conversation context — use reasons, decisions, and constraints discussed in the session. Do NOT infer or guess motivations; only include what was explicitly discussed.
- **What changed?** Only what the subject line omits

**MUST ask user:** Present the drafted body via AskUserQuestion for confirmation. Let user approve, edit, or skip.

**5f. Execute Commit**

Stage the group's specific files by name (never `git add -A` / `git add .`), so only planned files enter the commit — pre-staged state was already reconciled in Step 4.5. Commit using HEREDOC for multi-line messages (subject + body + footers). For trivial commits without body, single `-m` is fine.

**If a pre-commit hook fails** (e.g., prettier, eslint): Do NOT fix files yourself. Report the error to the user and stop. You do not have permission to edit source files — only the user can decide how to resolve hook failures.

**5g. Verify the Commit Matches What Was Staged**

A pre-commit hook that auto-fixes and re-stages whole files (`git add -- <file>`) can widen the commit beyond the planned set — sweeping in files, or unstaged hunks of a partially-staged file, that belong to a later group. The commit then succeeds while its message describes something other than its diff, and nothing surfaces the mismatch.

Capture the staged file list immediately **before** committing, then compare it against what actually landed. Run the snapshot, the commit, and the comparison in a **single Bash invocation** — shell variables do not survive across separate calls, so this replaces the bare `git commit` in 5f:

```bash
PLANNED=$(git diff --cached --name-only | sort)

git commit -F - <<'MSG'
<subject + body + footers>
MSG

LANDED=$(git show --pretty=format: --name-only HEAD | sed '/^$/d' | sort)
comm -13 <(echo "$PLANNED") <(echo "$LANDED")   # files the hook added, if any
```

**Not every addition is a problem.** Legitimate re-staging hooks exist — version bumpers, code generators, formatters acting on files already in this group. Classify what came back:

- **Extra files that belong to a LATER commit group** → this is the real failure. The later group's changes are now committed under this message, and its own commit will be empty or wrong.
- **Extra files in no planned group** (generated or bumped by the hook) → expected side effect. Report them in the Step 6 summary and continue; do not prompt.

Only when the first case occurs, stop and surface it via AskUserQuestion:

- **Amend** — re-stage only the planned files and `git commit --amend` to restore the intended scope
- **Accept and replan** — keep the wider commit, then recompute the remaining groups (the swept-in changes are already committed, so later groups must drop them)
- **Reset** — `git reset --soft HEAD~1` to undo the commit and let the user reconcile manually

Do NOT proceed to the next group in that case — the remaining commit messages were planned against a file distribution that no longer holds.

> Root cause is the project's hook, not the skill. If a project hits this repeatedly, its pre-commit hook should be check-only (`prettier --check`) with auto-fix moved to edit time, rather than re-staging during the commit.

Mark task as completed using TaskUpdate, move to next group.

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