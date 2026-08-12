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

## AskUserQuestion conventions

Each ask point in this skill has an explicit call shape, labeled `C1`–`C9`. Fire the exact shape specified at its trigger — do not improvise a prompt.

- **Header chips** are ≤12 chars. **Labels** are 1–5 words.
- **`(Recommended)`** goes on the first option, and only when a sensible default exists. C4, C5 and C8 carry no marker — they exist precisely because the skill could not decide.
- **`preview`** is a field on an *individual option* (`options[].preview`), not on the question. Use it only where options differ visually: **C2** and **C6** only. Never attach one to an approve/skip prompt, where every option would render the same panel.
- **No call uses `multiSelect`.** Every decision here is mutually exclusive — one action, one type, one scope, one subject.
- Free-text "Other" is always available to the user; never add an explicit "Other" or "Something else" option.

Platform limits: 1–4 questions per call, **2–4 options each**. Every shape below stays within them. If a runtime condition would collapse a call to fewer than 2 options (e.g. only one subject candidate survives), do not fire it — just proceed with the single outcome.

> **Not available in subagents.** `AskUserQuestion` does not work in subagents spawned via the Agent tool. This skill must run in the main session; invoked from a subagent, every ask point below fails rather than degrading. See `docs/askuserquestion-reference.md`.

## Workflow

### Step 0: Check Config

Use **Bash** to check for and read the project config:

```bash
cat .claude/config/git/commit/main.yaml 2>/dev/null || echo "NO_CONFIG"
```

- If config exists, use it for types, scopes, language, and body conventions
- If `NO_CONFIG`, fire **C1**

#### C1 — Missing config

**When:** the Step 0 check prints `NO_CONFIG`.

```yaml
question: "No commit config found for this project. How should I proceed?"
header: "Config"
multiSelect: false
options:
  - label: "Continue with defaults (Recommended)"
    description: "Use Conventional Commits defaults for this run. Nothing is written to the repo."
  - label: "Set up config first"
    description: "Invoke Skill(git:commit-config) to generate .claude/config/git/commit/main.yaml, then stop."
```

On "Set up config first", invoke `Skill(git:commit-config)` and stop — do not continue to Step 1. On "Continue with defaults", proceed to Step 1.

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

If splitting, fire **C2**.

#### C2 — Split plan

**When:** Step 3 produced 2+ commit groups.

The plan table goes in the `question` field. Do NOT output it as plain text — it must go through AskUserQuestion so the user can respond inline.

````yaml
question: |
  Planned {N} commits:

  ┌─────┬──────────┬──────────┬────────────────────────────────────────┬──────────────────────────┐
  │  #  │   Type   │  Scope   │                 Files                  │       Description        │
  ├─────┼──────────┼──────────┼────────────────────────────────────────┼──────────────────────────┤
  │ 1   │ chore    │ deps     │ package.json, package-lock.json        │ Add new dependencies     │
  ├─────┼──────────┼──────────┼────────────────────────────────────────┼──────────────────────────┤
  │ 2   │ feat     │ crawler  │ packages/crawler/**                    │ New crawler package      │
  ├─────┼──────────┼──────────┼────────────────────────────────────────┼──────────────────────────┤
  │ 3   │ docs     │ project  │ docs/backlogs/*.md                     │ Backlog docs for crawler │
  └─────┴──────────┴──────────┴────────────────────────────────────────┴──────────────────────────┘

  Commit as planned?
header: "Split plan"
multiSelect: false
options:
  - label: "Proceed with split (Recommended)"
    description: "Commit each group separately, in the dependency order shown."
    preview: |
      chore(deps): Add new dependencies
      feat(crawler): New crawler package
      docs(project): Backlog docs for crawler
  - label: "Single commit instead"
    description: "Fold every group into one commit covering all changed files."
    preview: |
      chore: Update dependencies, crawler package, and backlog docs
````

Type and Scope columns show the preliminary analysis — these may be refined in Step 5, so the previews are indicative, not final.

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
3. If unexpected pre-staged files exist, fire **C3**
4. If the index is empty or contains only planned files, proceed silently — do not prompt.

#### C3 — Unexpected pre-staged files

**When:** the index holds files that appear in no planned commit group.

```yaml
question: |
  These files are staged but belong to no planned commit group:
    {file 1}
    {file 2}
    ...

  They were likely left by an aborted commit. What should I do with them?
header: "Staged files"
multiSelect: false
options:
  - label: "Unstage them (Recommended)"
    description: "git restore --staged — drops them from the index, working-tree changes untouched."
  - label: "Include in a group"
    description: "Fold them into a planned commit group, or add a new group for them."
  - label: "Abort the commit"
    description: "Stop so the index can be reconciled manually."
```

One action applies to all listed files. On "Include in a group", ask which group as a follow-up call rather than expanding this one.

### Step 5: For Each Commit Group

Mark current group as in_progress using TaskUpdate, then:

> **Config layouts.** A project config is either **single-file** (`main.yaml` only — the layout `commit-config` generates) or **split** (`main.yaml` plus `types/`, `scopes/`, `guides/` directories, hand-built from the samples for complex repos). The drill-down reads below apply to split configs only. **On a single-file config those paths do not exist — use the `*_quick` maps and decision trees in `main.yaml` and do not go looking for them.** One `ls` of the config directory settles which layout you have.

**5a. Determine Type**
1. Check if the resolved scope has a `default_type` in `scopes_quick` config
   - If `default_type` exists and the change fits (not a clear contradiction like a genuine bug fix): use it, skip steps 2-4
   - If the change clearly contradicts the default (e.g., fixing broken behavior in a scope defaulting to `chore`): override and continue to step 2
2. Split config: read `types/index.md`. Single-file: use `types_quick` + `type_decision_tree`
3. Split config, still unclear: read the specific file (e.g., `types/feat.yaml`)
4. If still ambiguous between 2+ types, fire **C4**

#### C4 — Ambiguous commit type

**When:** 2+ types remain plausible after the config drill-down.

```yaml
question: "Which commit type fits {group description} best?"
header: "Commit type"
multiSelect: false
options:
  - label: "{type 1}"
    description: "{what this type asserts about the change, per the project's type definitions}"
  - label: "{type 2}"
    description: "{same, for the competing type}"
```

List only the types that genuinely compete — 2 minimum, 4 maximum. No `(Recommended)` marker: if one type were defensibly the default, the drill-down would have resolved it and this call would not fire.

**5b. Determine Scope**
1. Split config: read `scopes/index.md`. Single-file: use `scopes_quick` + `scope_decision`
2. Split config, still unclear: read the specific file for pattern matching
3. If still ambiguous or multiple scopes could apply, fire **C5**

#### C5 — Ambiguous scope

**When:** no scope resolves cleanly, or 2+ scopes could apply.

```yaml
question: "Which scope should {group description} commit under?"
header: "Scope"
multiSelect: false
options:
  - label: "{scope 1}"
    description: "{which files in this group fall under it}"
  - label: "{scope 2}"
    description: "{same, for the competing scope}"
```

Same rules as C4: 2–4 real candidates, no `(Recommended)` marker. If the project's convention allows a scopeless subject, offer "No scope" as one of the options rather than suppressing the call.

Fire C4 and C5 independently — either, both, or neither may be needed for a given group. Do not merge them into one two-question call: a scope with a `default_type` often resolves the type outright, and bundling would force an answer to a question that no longer needs asking.

**5c. Quality Check**
1. Split config: read `guides/index.md` and run its quick check. Single-file: apply `subject_conventions` from `main.yaml`
2. Split config, title still vague: read `guides/specificity.yaml`

**5d. Choose Subject**

Format: `{type}({scope}): {subject}`
- Check `language` in project config (`en`, `mixed`, or `ko`)
  - `en`: All English. Imperative mood, capitalize first letter, no period, max 72 chars
  - `mixed`: Type/scope in English, subject in Korean (e.g., `feat(auth): 사용자 인증 기능 추가`)
  - `ko`: All Korean including type/scope (e.g., `기능(인증): 사용자 인증 기능 추가`)

**MUST ask user:** Always generate 2-4 subject line candidates and fire **C6**. Include varying levels of detail/specificity so the user can pick or provide their own.

#### C6 — Subject line candidates

**When:** every commit group, without exception.

Order candidates best-first — the first option carries the `(Recommended)` marker. Each `preview` shows the subject in full `{type}({scope}): {subject}` form so the user compares finished lines, not fragments. Labels stay short; the preview carries the length.

````yaml
question: "Which subject line for commit {n} of {N}?"
header: "Subject"
multiSelect: false
options:
  - label: "{short gist} (Recommended)"
    description: "Balanced — names what changed without restating the diff."
    preview: |
      feat(crawler): Add retry backoff to fetch loop
  - label: "{more specific gist}"
    description: "Names the mechanism explicitly. Longer, closer to 72 chars."
    preview: |
      feat(crawler): Add exponential retry backoff to page fetch loop
  - label: "{broader gist}"
    description: "Terser — leans on the body or the diff for detail."
    preview: |
      feat(crawler): Improve fetch reliability
````

Free-text "Other" lets the user write their own subject; use it verbatim rather than re-running the candidates. If only one candidate is defensible, skip the call and use it — a one-option call is invalid.

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

**MUST ask user:** Fire **C7** to confirm the drafted body.

#### C7 — Body confirmation

**When:** a body was drafted. If the body was skipped by default, do not fire.

The drafted body goes in `question` so the user reads it in full before choosing. No `preview` — the panel would be identical across all three options, which is exactly the case the conventions rule out.

```yaml
question: |
  Drafted body for {subject}:

  {body text as it would appear in the commit}

  Use it?
header: "Body"
multiSelect: false
options:
  - label: "Approve (Recommended)"
    description: "Commit with this body as written."
  - label: "Edit it"
    description: "Revise the body from the user's notes, then re-confirm."
  - label: "Skip the body"
    description: "Commit with the subject line only."
```

Free-text "Other" is the fastest edit path — treat typed text as the replacement body and re-fire C7 with it.

**5f. Footers**

Footers follow the body, one per line, ordered: `BREAKING CHANGE:`, issue references, `Co-authored-by:`, `Skill: commit`.

**The issue reference decides whether the issue closes.** GitHub acts only on closing keywords — `Closes`, `Fixes`, `Resolves`, and their `-d`/`-s` forms. `Refs` is inert: it cross-links the commit onto the issue's timeline and does nothing else. Choosing it for finished work leaves that issue open indefinitely, with no signal that anything is wrong.

- Commit **fully implements** the issue's scope → `Closes #N`. On a `fix:` commit write `Fixes #N` instead; GitHub treats all closing keywords identically, so this is convention, not behavior.
- Commit **advances but does not finish** the issue → `Refs #N`.
- Commit merely touches code an issue mentions, claiming none of its scope → no issue footer.

An issue whose written scope has **drifted** from the code still closes when the commit satisfies its intent. Record the deviation in the body — a stale catalog, a renumbering, extra cases found — rather than downgrading to `Refs`. Deviations that look partial are the most common reason completed work stays open.

**One keyword per issue.** `Closes #12, #13` closes only #12 — the bare `#13` is parsed as a mention. Give each its own line, or repeat the keyword: `Closes #12, closes #13`.

Footer only issue numbers established in this session — the user named them, or the work was scoped from them. Never infer a number from a branch name and never guess one.

Auto-close fires when the commit reaches the **default branch**. On a feature branch the keyword lies dormant until merge; that is the intended behavior, so keep it rather than weakening it to `Refs`.

If the commit clearly relates to an issue but its coverage of that issue's scope is genuinely unclear, fire **C8**.

#### C8 — Issue reference

**When:** the commit references an issue and it is genuinely unclear whether it completes that issue's scope. When the answer is obvious either way, write the footer and move on — do not fire.

```yaml
question: |
  Commit: {subject}
  Issue #{n}: {issue title}

  Does this commit finish #{n}?
header: "Issue ref"
multiSelect: false
options:
  - label: "Closes it"
    description: "Footer `Closes #{n}` — the issue auto-closes once this reaches the default branch."
  - label: "Partial progress"
    description: "Footer `Refs #{n}` — cross-links the commit, leaves the issue open."
  - label: "No issue footer"
    description: "The commit stands alone; #{n} is left untouched."
```

**5g. Execute Commit**

Stage the group's specific files by name (never `git add -A` / `git add .`), so only planned files enter the commit — pre-staged state was already reconciled in Step 4.5. Commit using HEREDOC for multi-line messages (subject + body + footers). For trivial commits without body, single `-m` is fine.

**If a pre-commit hook fails** (e.g., prettier, eslint): Do NOT fix files yourself. Report the error to the user and stop. You do not have permission to edit source files — only the user can decide how to resolve hook failures.

**5h. Verify the Commit Matches What Was Staged**

A pre-commit hook that auto-fixes and re-stages whole files (`git add -- <file>`) can widen the commit beyond the planned set — sweeping in files, or unstaged hunks of a partially-staged file, that belong to a later group. The commit then succeeds while its message describes something other than its diff, and nothing surfaces the mismatch.

Capture the staged file list immediately **before** committing, then compare it against what actually landed. Run the snapshot, the commit, and the comparison in a **single Bash invocation** — shell variables do not survive across separate calls, so this replaces the bare `git commit` in 5g:

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

Only when the first case occurs, stop and fire **C9**.

#### C9 — Hook widened the commit

**When:** a pre-commit hook re-staged files that belong to a LATER commit group. Not fired for generated or bumped files that belong to no group — those are reported in Step 6 and the flow continues.

```yaml
question: |
  The pre-commit hook added files that belong to later commit groups:
    {file} (planned for commit {n})
    ...

  Commit {n} of {N} landed wider than planned. How should I recover?
header: "Scope drift"
multiSelect: false
options:
  - label: "Amend to planned scope (Recommended)"
    description: "Re-stage only the planned files and git commit --amend to restore the intended commit."
  - label: "Accept and replan"
    description: "Keep the wider commit, then recompute remaining groups to drop what already landed."
  - label: "Reset the commit"
    description: "git reset --soft HEAD~1 and stop, so the index can be reconciled manually."
```

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
- Issue footers are specified in **5f** — `Closes #N` when the commit finishes the issue, `Refs #N` only when it does not. Do not default to `Refs`.