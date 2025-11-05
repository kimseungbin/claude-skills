---
name: Conventional Commits
description: Create commits following Conventional Commits specification with intelligent multi-commit splitting and interactive selection. Use when user requests to commit changes or generate commit messages.
---

# Conventional Commits

This skill generates commit messages following the [Conventional Commits](https://www.conventionalcommits.org/) specification, with rules defined in `.claude/skills/conventional-commits/commit-rules.yaml`.

## Instructions

When the user requests to create a commit or generate a commit message:

1. **Read the commit rules configuration**:
    - **First**, check if `.claude/config/conventional-commits.yaml` exists (project-specific rules)
    - **If not found**, fall back to `.claude/skills/conventional-commits/commit-rules.yaml` (default rules)
    - Parse the rules including: types, scopes, format patterns, and conventions
    - Project-specific rules take precedence and override default rules

2. **Analyze the current changes**:
    - Run `git status` to see modified/added files
    - Run `git diff --staged` to see staged changes (if any)
    - Run `git diff` to see unstaged changes
    - Identify ALL the changes (which packages, modules, or areas are affected)

3. **Determine if changes should be split into multiple commits**:
    - Analyze if changes span multiple scopes (e.g., frontend + backend + tools)
    - Check if there are different types of changes (e.g., feat + fix, or feat + test)
    - Consider logical separation (e.g., dependency updates separate from feature work)
    - Look for clearly separable concerns (e.g., refactoring separate from new features)

    **Criteria for suggesting split:**
    - Changes affect 2+ different scopes (frontend, backend, tools, etc.)
    - Changes include multiple distinct features or fixes
    - Changes mix different types (feat + refactor, fix + chore, etc.)
    - Test-only changes can be separated from implementation
    - Configuration/tooling changes can be separated from feature work

    **When NOT to split:**
    - Single feature with its tests (keep together)
    - Related changes that should be atomic (e.g., API change + frontend update)
    - Changes are too small to meaningfully separate
    - User explicitly wants a single commit

4. **Prompt user to select commits** (if splitting is recommended):
    - Group changes by scope and/or type
    - For each potential commit, describe:
        - The type and scope: e.g., "feat(frontend)"
        - What files/changes it includes
        - A suggested subject line
    - Use AskUserQuestion tool with multiSelect: true
    - Present 2-4 logical commit groupings
    - Include option "Combine all into one commit" as a choice
    - Let user select which commits to create

    **Example groupings:**

    ```
    Option 1: "feat(backend): Add trip calculation API"
      - packages/backend/src/trips/trips.service.ts
      - packages/backend/src/trips/trips.controller.ts

    Option 2: "feat(frontend): Add trip calculation UI"
      - packages/frontend/src/components/TripCalculator.svelte
      - packages/frontend/src/stores/trips.ts

    Option 3: "test(frontend): Add E2E tests for trip calculation"
      - packages/frontend/tests/e2e/trip-calculation.spec.ts

    Option 4: "ci(tools): Update workflow for new tests"
      - .github/workflows/test.yml
    ```

5. **Determine commit type and scope for each selected commit** (IMPORTANT: type ≠ scope):
    - **TYPE** (what kind of change): Choose from the `types` section in commit-rules.yaml
        - Examples: feat, fix, refactor, test, docs, style, build, ci, chore
        - Type describes the NATURE of the change (feature? bugfix? documentation?)
    - **SCOPE** (where the change is): Choose from the `scopes` section in commit-rules.yaml
        - Examples: frontend, backend, infra, config, monorepo, tools
        - Scope describes the LOCATION/AREA of the change (which package? which subsystem?)
        - Match file paths against the `patterns` in each scope definition
    - Format: `{type}({scope}): {subject}` — e.g., `ci(tools): Fix workflow syntax`
    - Consider the monorepo structure: packages/frontend, packages/backend, packages/infra

6. **Generate the commit message(s)**:
    - Follow the format pattern specified in the YAML rules
    - Use the type and scope identified
    - Write a clear, concise description (present tense, imperative mood)
    - Add body and footer if needed (breaking changes, references, etc.)
    - Respect line length limits from the rules

7. **Generate and execute the commit(s)**:
    - For each selected commit:
        - Show the generated commit message with explanation of type and scope
        - Stage only the files relevant to that commit using `git add <specific-files>`
        - Execute the commit immediately (commits are easily undoable with git reset)
        - Show the commit hash and confirmation
    - Process commits in a logical order (dependencies first, tests last)

8. **Evaluate rule coverage** (optional):
    - If the commit doesn't fit well into existing types or scopes
    - If you notice patterns that aren't covered by current rules
    - Provide feedback to the user suggesting updates to `commit-rules.yaml`
    - Explain what new type, scope, or convention should be added
    - Suggest the specific YAML changes needed

## Example Workflows

### Single Scope - One Commit

```
User: "Commit the changes"

1. Read commit-rules.yaml
2. Analyze: Modified packages/backend/src/trips/trips.service.ts
3. Determine: Only backend scope affected, no split needed
4. Determine: type=feat, scope=backend
5. Generate: "feat(backend): Add trip expense calculation logic"
6. Show message with explanation
7. Execute commit immediately
8. Show result (commit hash + status)
```

### Multiple Scopes - Split Workflow

```
User: "Commit the changes"

1. Read commit-rules.yaml
2. Analyze changes:
   - Modified packages/frontend/src/components/TripForm.svelte
   - Modified packages/backend/src/trips/trips.service.ts
   - Modified .github/workflows/test.yml
3. Determine: Changes span 3 scopes (frontend, backend, tools) → recommend split
4. Present options to user via AskUserQuestion:
   □ "feat(backend): Add trip calculation API" (trips.service.ts)
   □ "feat(frontend): Add trip form UI" (TripForm.svelte)
   □ "ci(tools): Add test workflow" (test.yml)
   □ "Combine all into one commit"
5. User selects: backend + frontend commits (not the CI change)
6. Create first commit:
   - Stage: packages/backend/src/trips/trips.service.ts
   - Commit: "feat(backend): Add trip expense calculation logic"
   - Show: commit hash abc123
7. Create second commit:
   - Stage: packages/frontend/src/components/TripForm.svelte
   - Commit: "feat(frontend): Add trip form with expense tracking"
   - Show: commit hash def456
8. Remind user about uncommitted changes (.github/workflows/test.yml)
```

## Rules File Location

⚠️ **CRITICAL: DO NOT MODIFY FILES IN THE SKILL DIRECTORY** ⚠️

This skill is a **git submodule** shared across multiple projects. Files in `.claude/skills/conventional-commits/` must NEVER be modified directly.

**Priority order:**

1. **Project-specific rules** (ALWAYS CREATE THIS): `.claude/config/conventional-commits.yaml` (checked first)
2. **Default rules** (READ-ONLY): `.claude/skills/conventional-commits/commit-rules.yaml` (fallback, generic defaults)

**Configuration Pattern:**

- `.claude/skills/conventional-commits/` → Symlink to submodule (READ-ONLY, shared across projects)
- `.claude/config/conventional-commits.yaml` → Real file in project repo (WRITABLE, project-specific)

**When user requests project-specific commit rules:**

1. Check if `.claude/config/conventional-commits.yaml` exists
2. If NOT exists, create it with project-specific scopes, types, and conventions
3. If EXISTS, update it with new rules
4. NEVER modify `commit-rules.yaml` in the skill directory (it's a submodule!)

**Template for project-specific config:**
Copy structure from `.claude/skills/conventional-commits/commit-rules.yaml` or `commit-rules.template.yaml` and customize for the project.

**Example projects:**

- See `commit-rules.example.yaml` for a Trip Settle monorepo example
- Use `commit-rules.template.yaml` as a starting template

## Interactive Commit Selection

When changes span multiple scopes or types, this skill uses **interactive selection** via the AskUserQuestion tool:

- Presents checkboxes in the terminal for each potential commit
- Allows multiple selections (multiSelect: true)
- Each option shows:
    - Proposed commit message (type + scope + subject)
    - List of files included
    - Brief description of changes
- User can select any combination of commits to create
- Unselected changes remain uncommitted for later

This provides fine-grained control over commit granularity while maintaining standardized commit messages.

## Notes

- Always respect the project's existing commit history style
- For multi-package changes, use broader scopes like "monorepo" or list multiple scopes
- Breaking changes must be clearly indicated per the rules
- Reference issue numbers when mentioned by the user
- When in doubt about splitting, present options to the user
- Keep related changes together (e.g., feature + its tests)
- Process commits in logical dependency order
