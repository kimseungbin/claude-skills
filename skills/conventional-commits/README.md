# Conventional Commits Skill

This skill automatically generates commit messages following the [Conventional Commits](https://www.conventionalcommits.org/) specification, with intelligent multi-commit support and interactive selection.

## Features

- **Smart commit splitting**: Automatically detects when changes span multiple scopes or types
- **Interactive selection**: Choose which commits to create via terminal checkboxes
- **Conventional Commits spec**: Follows the industry-standard commit format
- **Auto scope detection**: Matches file paths to scopes automatically

## Usage

Simply ask Claude to commit your changes:

```
"Commit the changes"
"Create a commit for these changes"
"Generate a commit message"
```

### Single Scope Changes

Claude will:
1. Analyze your staged/unstaged changes
2. Determine the appropriate type and scope
3. Generate a commit message following project conventions
4. Execute the commit and show the result

### Multi-Scope Changes (New!)

When changes span multiple areas (e.g., frontend + backend + CI), Claude will:
1. Analyze all changes across different scopes
2. Group them into logical commits
3. **Present interactive checkboxes** to select which commits to create
4. Execute selected commits in dependency order
5. Leave unselected changes staged for later

#### Example Interactive Selection

```
Which commits would you like to create?

☑ feat(backend): Add trip calculation API
  Files: packages/backend/src/trips/trips.service.ts, trips.controller.ts

☑ feat(frontend): Add trip form UI
  Files: packages/frontend/src/components/TripForm.svelte

☐ ci(tools): Update test workflow
  Files: .github/workflows/test.yml

☐ Combine all into one commit
```

Select multiple options or choose to combine everything into a single commit.

## Commit Message Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Examples

```
feat(backend): Add trip settlement calculation logic
fix(frontend): Resolve date picker validation error
refactor(config): Consolidate TypeScript configurations
```

## Customization

Edit `commit-rules.yaml` to customize:
- Commit types
- Scopes (areas of the codebase)
- Message format patterns
- Subject line length limits
- Conventions and special rules

## File Structure

```
.claude/skills/conventional-commits/
├── SKILL.md                      # Skill instructions for Claude
├── commit-rules.yaml             # Active rules configuration
├── commit-rules.template.yaml    # Template with examples
└── README.md                     # This file
```

## When Changes Are Split

Changes are candidates for splitting when:
- ✅ Multiple scopes affected (frontend + backend + tools)
- ✅ Different change types mixed (feat + fix, feat + refactor)
- ✅ Separable concerns (dependency updates + feature work)
- ✅ Independent features that can be committed separately

Changes stay together when:
- ❌ Single feature with its tests (atomic unit)
- ❌ Changes must be atomic (API change + frontend update)
- ❌ Changes are too small to meaningfully separate
- ❌ User explicitly requests a single commit

## Benefits

- **Logical commit history**: Related changes grouped into focused commits
- **Fine-grained control**: Choose commit granularity per situation
- **Consistent formatting**: All commits follow project conventions
- **Automatic scope detection**: File paths matched to scopes
- **Enforced standards**: Imperative mood, length limits, type/scope validation
- **Context-aware**: Understands monorepo structure
- **Easy customization**: Fully configurable via YAML