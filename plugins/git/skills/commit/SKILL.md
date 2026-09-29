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

Each ask point in this skill has an explicit call shape, labeled `C1`–`C10`. Fire the exact shape specified at its trigger — do not improvise a prompt.

- **Header chips** are ≤12 chars. **Labels** are 1–5 words.
- **`(Recommended)`** goes on the first option, and only when a sensible default exists. C4, C5 and C9 carry no marker — they exist precisely because the skill could not decide. C7 carries one only when the affected surface is unambiguously public.
- **`preview`** is a field on an *individual option* (`options[].preview`), not on the question. Use it only where options differ visually: **C2**, **C6** and **C7**. Never attach one to an approve/skip prompt, where every option would render the same panel.
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

Write the plan as a markdown table in your response text, immediately before the call. The chat renders markdown tables with aligned columns; the `question` field renders in a proportional font and wraps, so a table drawn inside it breaks apart.

```markdown
| # | Type  | Scope   | Files                           | Description              |
|---|-------|---------|---------------------------------|--------------------------|
| 1 | chore | deps    | package.json, package-lock.json | Add new dependencies     |
| 2 | feat  | crawler | packages/crawler/**             | New crawler package      |
| 3 | docs  | project | docs/backlogs/*.md              | Backlog docs for crawler |
```

The decision itself still goes through AskUserQuestion, with the table referenced rather than repeated:

````yaml
question: "Commit the {N} groups in the plan above?"
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

**5e. Detect Breaking Changes**

A missing `BREAKING CHANGE:` trailer is invisible at commit time and expensive later: CI that derives versions from conventional commits emits a minor or patch bump where a major was due, and consumers take the upgrade without warning. So the skill looks for breaking changes itself rather than waiting to be told.

**Detect semantically, from the diff.** Read the group's diff (through `changed.sh`, as in Step 1) and judge whether the change removes or alters something a consumer outside this repo depends on. `breaking_changes.hints` in the project config lists what counts as breaking *in this project* — treat those as attention hints that tell you where to look, never as the trigger itself. Matching hint text against the raw diff fires on comments, fixtures and unrelated prose, and the resulting prompt fatigue is exactly what the conditional design exists to avoid.

**Surfaces worth checking**, when the group touches them:

| Surface | What breaks a consumer |
|---------|------------------------|
| Library / package API | Exported symbol removed or renamed; required parameter added; return or generic type narrowed; default changed |
| HTTP / RPC API | Route removed or renamed; response field dropped; request field made required; status-code semantics changed |
| Data & schema | Column or field dropped or renamed; non-nullable column added without default; a migration that is not reversible |
| Configuration | Config key removed or renamed; a new key made required; a default flipped |
| CLI | Flag or subcommand removed or renamed; positional arguments reordered; output format consumed by scripts changed |
| Infrastructure | Resource replacement or deletion; a rename that forces re-create; a step the operator must perform before deploy lands |

**Do not run detection when** any of these hold — each would produce noise, not signal:

- `breaking_changes.detect` is `false` — the project has opted out, which is how a pre-`1.0.0` project that breaks without ceremony says so
- The config has no `breaking_changes` section **and** the group touches no surface in the table above
- Every file in the group matches `breaking_changes.exempt_paths` (tests, fixtures, internal-only modules, docs)
- The removed or renamed symbol is not reachable from a public entry point — check the package's exports before treating a deletion as breaking

**Fire C7 only on concrete evidence** — a specific symbol, key, route, column or resource you can name and quote. If detection turns up nothing nameable, say nothing and continue to 5f. A prompt the user answers "no" to every time trains them to answer "no" without reading.

#### C7 — Breaking change confirmation

**When:** detection found a named, quotable change to a consumer-facing surface. Never fired speculatively.

Order the options so the skill's own assessment comes first. Carry `(Recommended)` on it only when the surface is unambiguously public — an export in the package entry point, a documented route, a released schema. When you could not establish that the surface is public, drop the marker: the user is settling what you could not.

The previews show the **finished shape** of each outcome, not text that exists yet — the body itself is drafted in 5f. Sketch a one-line migration note in the "Yes" preview so the user sees what they are agreeing to; the real wording is confirmed at C8.

````yaml
question: |
  Commit {n} of {N}: {subject}

  This looks like a breaking change:
    {named evidence — e.g. `parseConfig()` dropped its `legacy` overload (src/index.ts:88)}

  Mark it breaking?
header: "Breaking"
multiSelect: false
options:
  - label: "Yes, mark breaking (Recommended)"
    description: "Adds the ! marker and the BREAKING CHANGE footer — CI will bump the major version."
    preview: |
      feat(config)!: Replace parseConfig overloads with an options object

      BREAKING CHANGE: parseConfig() no longer accepts a legacy positional
      argument. Pass { legacy: true } instead.
  - label: "Not breaking"
    description: "The affected surface is internal or unreleased. Commits with no marker; CI bumps minor."
    preview: |
      feat(config): Replace parseConfig overloads with an options object
````

Free-text "Other" is how the user supplies their own wording for the trailer — take the typed text as the `BREAKING CHANGE:` description verbatim.

On "Yes", write the marker per `breaking_changes.marker` (`both` unless the config says otherwise; see 5g), and treat a body as required in 5f — a breaking change the reader cannot act on is barely better than an unmarked one. The `!` goes into the subject already chosen at 5d, immediately before the colon; that is a mechanical edit, so do not re-fire C6 for it.

**5f. Generate Body (only when necessary)**

Use `body_conventions` from pre-loaded project config (if absent, read from samples config as fallback).

**Skip body by default.** Most commits need only a good subject line.

**Generate body when:**
- The subject line cannot fully convey **why** the change was made (non-obvious design decisions, rejected alternatives, constraints)
- The subject line cannot cover **what** changed (multi-file changes where the subject omits important details)
- 5e confirmed a breaking change — say what broke and what the consumer does instead

Body language: `en` → English, `mixed` or `ko` → Korean.

When generating a body, focus on **why** — the reasoning and motivation:
- **Why this approach?** Reference the actual conversation context — use reasons, decisions, and constraints discussed in the session. Do NOT infer or guess motivations; only include what was explicitly discussed.
- **What changed?** Only what the subject line omits

**MUST ask user:** Fire **C8** to confirm the drafted body.

#### C8 — Body confirmation

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

Free-text "Other" is the fastest edit path — treat typed text as the replacement body and re-fire C8 with it.

**5g. Footers**

Footers follow the body, one per line, ordered: `BREAKING CHANGE:`, issue references, `Co-authored-by:`.

**The breaking-change marker, when 5e confirmed one.** Conventional Commits accepts two forms — a `!` before the colon (`feat(api)!:`) and a `BREAKING CHANGE:` footer — and tooling support for each varies by generator. `breaking_changes.marker` selects which to write; `both` is the default because it is the only setting every conventional-commits version bumper recognizes:

- `both` → `!` in the subject **and** the footer. The `!` makes it visible in `git log --oneline`; the footer carries the migration text.
- `footer` → footer only. Correct when a tool in the pipeline mis-parses `!`.
- `bang` → `!` only. Leaves the reader nowhere to learn what to do instead; choose it only when a project genuinely wants that.

Write the footer token as literal `BREAKING CHANGE:` whatever `language` is set to. It is a specification keyword that generators match on, so a translated token silently disables the major bump this whole step exists to produce; the *description* after the colon follows `language` like any other prose. The `BREAKING-CHANGE:` hyphenated spelling is equally valid per the spec — prefer the spaced form for consistency with the samples.

**The issue reference decides whether the issue closes.** GitHub acts only on closing keywords — `Closes`, `Fixes`, `Resolves`, and their `-d`/`-s` forms. `Refs` is inert: it cross-links the commit onto the issue's timeline and does nothing else. Choosing it for finished work leaves that issue open indefinitely, with no signal that anything is wrong.

- Commit **fully implements** the issue's scope → `Closes #N`. On a `fix:` commit write `Fixes #N` instead; GitHub treats all closing keywords identically, so this is convention, not behavior.
- Commit **advances but does not finish** the issue → `Refs #N`.
- Commit merely touches code an issue mentions, claiming none of its scope → no issue footer.

An issue whose written scope has **drifted** from the code still closes when the commit satisfies its intent. Record the deviation in the body — a stale catalog, a renumbering, extra cases found — rather than downgrading to `Refs`. Deviations that look partial are the most common reason completed work stays open.

**One keyword per issue.** `Closes #12, #13` closes only #12 — the bare `#13` is parsed as a mention. Give each its own line, or repeat the keyword: `Closes #12, closes #13`.

Footer only issue numbers established in this session — the user named them, or the work was scoped from them. Never infer a number from a branch name and never guess one.

Auto-close fires when the commit reaches the **default branch**. On a feature branch the keyword lies dormant until merge; that is the intended behavior, so keep it rather than weakening it to `Refs`.

If the commit clearly relates to an issue but its coverage of that issue's scope is genuinely unclear, fire **C9**.

#### C9 — Issue reference

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

**5h. Execute Commit**

Stage the group's specific files by name (never `git add -A` / `git add .`), so only planned files enter the commit — pre-staged state was already reconciled in Step 4.5. Commit using HEREDOC for multi-line messages (subject + body + footers). For trivial commits without body, single `-m` is fine.

**If a pre-commit hook fails** (e.g., prettier, eslint): Do NOT fix files yourself. Report the error to the user and stop. You do not have permission to edit source files — only the user can decide how to resolve hook failures.

**5i. Verify the Commit Matches What Was Staged**

A pre-commit hook that auto-fixes and re-stages whole files (`git add -- <file>`) can widen the commit beyond the planned set — sweeping in files, or unstaged hunks of a partially-staged file, that belong to a later group. The commit then succeeds while its message describes something other than its diff, and nothing surfaces the mismatch.

Capture the staged file list immediately **before** committing, then compare it against what actually landed. Run the snapshot, the commit, and the comparison in a **single Bash invocation** — shell variables do not survive across separate calls, so this replaces the bare `git commit` in 5h:

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

Only when the first case occurs, stop and fire **C10**.

#### C10 — Hook widened the commit

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
- Breaking changes are detected in **5e** and marked in **5g** — detect semantically from the diff, fire C7 only on named evidence, and keep the `BREAKING CHANGE:` token in English so version bumpers still parse it.
- Issue footers are specified in **5g** — `Closes #N` when the commit finishes the issue, `Refs #N` only when it does not. Do not default to `Refs`.