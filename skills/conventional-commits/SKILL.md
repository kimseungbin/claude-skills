---
name: Conventional Commits
description: Create commits following Conventional Commits specification with intelligent multi-commit splitting and interactive selection. Use when user requests to commit changes or generate commit messages.
---

# Conventional Commits

This skill generates commit messages following the [Conventional Commits](https://www.conventionalcommits.org/) specification, with rules defined in `.claude/skills/conventional-commits/commit-rules.yaml`.

## Instructions

When the user requests to create a commit or generate a commit message:

1. **Read the commit rules configuration** (minimal-context loading):
    - **Always load main config first**:
        - **First**, check if `.claude/config/conventional-commits/main.yaml` exists (split config pattern)
        - **If not found**, check if `.claude/config/conventional-commits.yaml` exists (single file pattern)
        - **If neither found**, fall back to `.claude/skills/conventional-commits/commit-rules.yaml` (default)
        - Main config contains: quick reference, complete type decision tree, scope patterns
    - **IMPORTANT**: Always check for split config directory pattern first, as it takes priority
    - **Load detailed files only when needed** (5-10% of commits):
        - **types/*.yaml** - Load when type unclear after decision tree (feat vs chore edge cases)
        - **scopes/*.yaml** - Load when scope unclear for multiple file changes
        - **examples/*.yaml** - Load when need similar commit pattern
        - **guides/*.yaml** - Load for quality check or title validation
    - **Context optimization:**
        - 90% of commits: Read main config only (~168 lines)
        - 10% of commits: Read main config + 1-2 detailed files (~240 lines)
        - Average: 67% context reduction vs monolithic config

2. **Load implementation guide** (if specified):
    - Check if config has `implementation` field (e.g., `implementation: infrastructure`)
    - If present, read `.claude/skills/conventional-commits/{implementation}.md`
    - Available implementations:
        - `infrastructure.md` - CDK, Terraform, Pulumi, IaC projects
        - `frontend.md` - React, Vue, Angular, Svelte projects (TODO: not yet implemented)
        - `backend.md` - Express, NestJS, FastAPI, Django projects (TODO: not yet implemented)
        - `fullstack.md` - Next.js, Nuxt, SvelteKit projects (TODO: not yet implemented)
    - Use the guide's decision trees, anti-patterns, and examples throughout the workflow
    - If no implementation specified or file doesn't exist, use generic workflow from this file

3. **Analyze the current changes**:
    - Run `git status` to see modified/added files
    - Run `git diff --staged` to see staged changes (if any)
    - Run `git diff` to see unstaged changes
    - Identify ALL the changes (which packages, modules, or areas are affected)

4. **Determine if changes should be split into multiple commits**:
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

5. **Prompt user to select commits** (if splitting is recommended):
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

6. **Determine commit type and scope for each selected commit** (IMPORTANT: type ≠ scope):
    - **TYPE** (what kind of change): Choose from the `types` section in commit-rules.yaml
        - Examples: feat, fix, refactor, test, docs, style, build, ci, chore
        - Type describes the NATURE of the change (feature? bugfix? documentation?)
    - **SCOPE** (where the change is): Choose from the `scopes` section in commit-rules.yaml
        - Examples: frontend, backend, infra, config, monorepo, tools
        - Scope describes the LOCATION/AREA of the change (which package? which subsystem?)
        - Match file paths against the `patterns` in each scope definition
        - **IMPORTANT**: Scope is determined by FILE PATH patterns, NOT semantic interpretation
    - Format: `{type}({scope}): {subject}` — e.g., `ci(tools): Fix workflow syntax`
    - Consider the monorepo structure: packages/frontend, packages/backend, packages/infra

    **When no scope pattern matches:**
    - If file paths don't match any defined scope patterns, **ASK the user** what scope to use
    - Suggest adding a new scope to the config if appropriate
    - Do NOT silently pick a scope based on semantic interpretation
    - Example: If `packages/tokens/` doesn't match any pattern, ask: "어떤 스코프를 사용할까요?"

7. **Generate the commit message(s)**:
    - Follow the format pattern specified in the YAML rules
    - Use the type and scope identified
    - Write a clear, concise description (present tense, imperative mood)
    - Add body and footer if needed (breaking changes, references, etc.)
    - Respect line length limits from the rules

8. **Generate and execute the commit(s)**:
    - For each selected commit:
        - Show the generated commit message with explanation of type and scope
        - Stage only the files relevant to that commit using `git add <specific-files>`
        - Execute the commit immediately (commits are easily undoable with git reset)
        - Show the commit hash and confirmation
    - Process commits in a logical order (dependencies first, tests last)

9. **Evaluate rule coverage** (optional):
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

**Split Configuration Pattern** (recommended for large projects):

Projects with extensive rules (500+ lines) can use the split configuration pattern to reduce context loading:

1. **Copy template structure**:
   ```bash
   # Copy main config
   cp .claude/skills/conventional-commits/templates/main.yaml \
      .claude/config/conventional-commits.yaml

   # Copy detailed files (optional, load on-demand)
   cp -r .claude/skills/conventional-commits/templates/types \
         .claude/config/conventional-commits/
   cp -r .claude/skills/conventional-commits/templates/scopes \
         .claude/config/conventional-commits/
   cp -r .claude/skills/conventional-commits/templates/examples \
         .claude/config/conventional-commits/
   cp -r .claude/skills/conventional-commits/templates/guides \
         .claude/config/conventional-commits/
   ```

2. **Customize for your project**:
   - Update `scopes_quick` in main config with your file patterns
   - Modify `scopes/*.yaml` with project-specific scope patterns
   - Add project-specific examples to `examples/*.yaml`

3. **Benefits**:
   - 67% context reduction (load ~168 lines instead of 515 lines)
   - Main config contains complete type decision tree
   - Detailed files loaded only when needed (5-10% of commits)

**Monolithic Configuration** (simple, all-in-one):

For smaller projects or simpler workflows, use a single configuration file:
- Copy from `commit-rules.yaml` or `commit-rules.template.yaml`
- Customize types, scopes, and conventions
- All rules in one file (easier to manage for small projects)

**Example projects:**

- See `commit-rules.example.yaml` for a Trip Settle monorepo example
- See `templates/` directory for split configuration examples

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

## Git Hooks Integration

This skill integrates with two types of git hooks for quality and safety:

### Commit Message Validation (commit-msg hook)

Projects can enforce that all commits are created using this skill by validating the `Skill: conventional-commits` footer tag.

**What it validates:**
- Conventional commit format compliance
- Required footer tags (e.g., `Skill: conventional-commits`)
- Subject line length and format

**Quick setup:**
Add footer validation to `.claude/config/conventional-commits.yaml` and create commit-msg hook in `.git/hooks/commit-msg`.

**For complete details:** See [hooks/commit-msg.md](hooks/commit-msg.md)

**When to read:** Commit-msg hook rejected your commit and you need to understand validation rules.

### Deployment Safety (pre-push hook)

Infrastructure projects use pre-push hooks to detect dangerous CloudFormation changes before deployment. When resource replacements are detected, additional approval footers are required.

**Footer format:**
```
Safe-To-Deploy: manual-deletion-planned
Analyzed-By: <your-name>
Services: <service-list>
```

**Quick workflow when push is blocked:**
1. Run `./scripts/analyze-and-approve-deployment.sh`
2. Script analyzes changes and generates footer
3. Amend commit with footer
4. Push again

**For complete details:** See [hooks/pre-push.md](hooks/pre-push.md)

**When to read:** Pre-push hook blocked your deployment due to resource replacement.

### Footer Integration

Both hooks work together via commit footers:

```
refactor(service): Extract ServiceInfraConstruct

Separate build and runtime concerns.

Safe-To-Deploy: manual-deletion-planned
Analyzed-By: John Doe
Services: auth

Skill: conventional-commits
```

**Footer order:**
1. Deployment safety footers (if required by pre-push hook)
2. Skill footer (if required by commit-msg hook)

## Notes

- Always respect the project's existing commit history style
- For multi-package changes, use broader scopes like "monorepo" or list multiple scopes
- Breaking changes must be clearly indicated per the rules
- Reference issue numbers when mentioned by the user
- When in doubt about splitting, present options to the user
- Keep related changes together (e.g., feature + its tests)
- Process commits in logical dependency order

## Commit Scope Discipline

When changes span multiple unrelated concerns, split them into separate commits with distinct purposes.

**Why this matters:**
- Each commit tells a story; mixed changes obscure that story
- Easier to review, revert, and cherry-pick individual changes
- Git history becomes a useful documentation tool

**When to split:**
- Feature work mixed with unrelated cleanup → Separate commits
- Documentation updates unrelated to code changes → Separate commits
- Configuration changes alongside feature changes → Separate commits

**When NOT to split:**
- Feature + its tests → Same commit (atomic change)
- Bug fix + documentation of the fix → Same commit
- Refactoring that enables a feature → Same commit (if tightly coupled)

**Example:**
```
# Bad: Mixed concerns in one commit
git commit -m "feat(auth): Add login and update backlog docs"

# Good: Separate commits with clear purposes
git commit -m "feat(auth): Add OAuth login flow"
git commit -m "docs(project): Update backlog with completed tasks"
```

**Process:**
1. Before committing, identify distinct concerns in staged changes
2. Present split options to user via AskUserQuestion if multiple concerns detected
3. Let user choose which groupings to commit
4. Create commits in logical order (dependencies first)
