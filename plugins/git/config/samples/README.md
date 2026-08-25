# Commit Samples

Split configuration samples for the `commit` skill.

## Quick Start

1. Choose a main config based on your project type:
   - `simple-main.yaml` - Small projects with basic structure
   - `monorepo-main.yaml` - Multi-package projects
   - `infrastructure-main.yaml` - CDK/Terraform/IaC projects

2. Copy to your project:
   ```bash
   mkdir -p .claude/config/git/commit
   cp simple-main.yaml .claude/config/git/commit/main.yaml
   cp -r types/ scopes/ .claude/config/git/commit/
   ```

3. Customize scopes for your project structure

4. Commit config files

## Directory Structure

```
samples/
├── simple-main.yaml        # Entry point for small projects
├── monorepo-main.yaml      # Entry point for monorepos
├── infrastructure-main.yaml # Entry point for IaC projects
├── types/                   # Type decision helpers
│   ├── feat.yaml
│   ├── fix.yaml
│   ├── refactor.yaml
│   ├── docs.yaml
│   └── chore.yaml
├── scopes/                  # Scope decision helpers
│   ├── configuration.yaml
│   ├── documentation.yaml
│   ├── infrastructure.yaml
│   └── tooling.yaml
├── examples/                # Commit examples
│   ├── infrastructure.yaml
│   └── documentation.yaml
└── guides/                  # Quality guides
    ├── specificity.yaml
    └── title-patterns.yaml
```

## How Split Config Works

The main config file (`*-main.yaml`) handles 90% of commits with:
- Quick type/scope references
- Decision trees for common cases

Detailed files are loaded only when needed:
- `types/*.yaml` - When type is unclear (feat vs chore)
- `scopes/*.yaml` - When scope is unclear for multiple files
- `examples/*.yaml` - When need similar commit pattern
- `guides/*.yaml` - For quality validation

## Customizing

### Add Project-Specific Scopes

Edit your `main.yaml`:

```yaml
scopes_quick:
  frontend:
    description: "Frontend package"
    patterns:
      - "packages/frontend/**"
  backend:
    description: "Backend package"
    patterns:
      - "packages/backend/**"
  # Add your scopes here
```

### Tune Breaking-Change Detection

Each `*-main.yaml` carries a `breaking_changes` section. The commit skill reads the group's diff and judges semantically whether the change breaks a consumer; this section tells it where to look.

```yaml
breaking_changes:
  detect: true
  marker: both
  hints:
    - "A symbol was removed or renamed in the package's public exports"
  exempt_paths:
    - "**/*.test.*"
```

| Key | Purpose |
|-----|---------|
| `detect` | Whether to run detection at all. `false` suits pre-`1.0.0` projects that break intentionally. |
| `marker` | Which Conventional Commits form to write — see the table below. |
| `hints` | Prose descriptions of what breaks a consumer *in this project*. Attention hints that steer the diff read, not regexes matched against it. |
| `exempt_paths` | Globs with no consumer-facing surface. Detection skips a group when every file in it matches. |

**Choosing `marker`:**

| Value | Writes | When |
|-------|--------|------|
| `both` | `feat(api)!:` **and** the `BREAKING CHANGE:` footer | Default. The only form every conventional-commits version bumper recognizes; the `!` also shows up in `git log --oneline`. |
| `footer` | footer only | A tool in the pipeline mis-parses `!`. |
| `bang` | `!` only | The project genuinely wants no migration text. |

The `BREAKING CHANGE:` token itself stays English at every `language` setting — version bumpers match it literally. Only the description after the colon is translated.

**Write hints as prose, not patterns.** `"A construct's props interface dropped a property"` reads the way the skill reasons; `"removed.*props"` invites matching raw diff text, which fires on comments and fixtures and produces exactly the prompt fatigue the conditional design avoids.

### Add Custom Examples

Create `.claude/config/git/commit/examples/my-project.yaml`:

```yaml
examples:
  - message: "feat(api): Add user authentication endpoint"
    body: "Project-specific example"
```