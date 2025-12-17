# Commit Expert Samples

Split configuration samples for the `commit-expert` subagent.

## Quick Start

1. Choose a main config based on your project type:
   - `simple-main.yaml` - Small projects with basic structure
   - `monorepo-main.yaml` - Multi-package projects
   - `infrastructure-main.yaml` - CDK/Terraform/IaC projects

2. Copy to your project:
   ```bash
   mkdir -p .claude/config/commit-expert
   cp simple-main.yaml .claude/config/commit-expert/main.yaml
   cp -r types/ scopes/ .claude/config/commit-expert/
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

### Add Custom Examples

Create `.claude/config/commit-expert/examples/my-project.yaml`:

```yaml
examples:
  - message: "feat(api): Add user authentication endpoint"
    body: "Project-specific example"
```