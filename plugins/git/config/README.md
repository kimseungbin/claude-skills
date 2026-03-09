# Commit Configuration

Sample configuration for the `commit` skill in the `git` plugin.

## Quick Start

1. **Copy a sample configuration:**
   ```bash
   mkdir -p .claude/config/git/commit

   # Choose based on your project type:
   # Small projects:
   cp claude-skills/config/git/commit/samples/simple-main.yaml \
      .claude/config/git/commit/main.yaml

   # Monorepo:
   cp claude-skills/config/git/commit/samples/monorepo-main.yaml \
      .claude/config/git/commit/main.yaml

   # Infrastructure (CDK/Terraform):
   cp claude-skills/config/git/commit/samples/infrastructure-main.yaml \
      .claude/config/git/commit/main.yaml
   ```

2. **Copy supporting files:**
   ```bash
   cp -r claude-skills/config/git/commit/samples/types \
         claude-skills/config/git/commit/samples/scopes \
         .claude/config/git/commit/
   ```

3. **Customize scopes for your project** in `main.yaml`

4. **Commit config files:**
   ```bash
   git add .claude/config/git/commit/
   git commit -m "chore(config): Add commit configuration"
   ```

## Directory Structure

```
config/git/commit/
├── README.md                # This file
├── samples/                 # Sample configurations
│   ├── README.md           # Sample usage guide
│   ├── simple-main.yaml    # Small project config
│   ├── monorepo-main.yaml  # Multi-package config
│   ├── infrastructure-main.yaml # IaC config
│   ├── types/              # Type decision helpers
│   ├── scopes/             # Scope decision helpers
│   ├── examples/           # Commit examples
│   └── guides/             # Quality guides
└── guides/                  # Implementation guides
    ├── infrastructure.md   # CDK/Terraform patterns
    ├── frontend.md         # React/Vue patterns (skeleton)
    ├── backend.md          # Express/NestJS patterns (skeleton)
    └── fullstack.md        # Next.js patterns (skeleton)
```

## Configuration Priority

The commit skill loads configuration in this order:

1. **Project-specific** (checked first):
   `.claude/config/git/commit/main.yaml`

2. **Default samples** (reference only):
   `claude-skills/config/git/commit/samples/`

## Customization

### Adding Project-Specific Scopes

Edit `.claude/config/git/commit/main.yaml`:

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
```

### Using Implementation Guides

Set `implementation` in your main.yaml:

```yaml
implementation: infrastructure  # Loads guides/infrastructure.md
```

Available: `infrastructure`, `frontend`, `backend`, `fullstack`

### Adding Custom Examples

Create `.claude/config/git/commit/examples/my-project.yaml`:

```yaml
examples:
  - message: "feat(api): Add user authentication"
    body: "Project-specific example"
```

## How Split Config Works

Main config handles 90% of commits with quick references and decision trees.

Detailed files are loaded only when needed:
- `types/*.yaml` - When type is unclear
- `scopes/*.yaml` - When scope is unclear
- `examples/*.yaml` - When need similar pattern
- `guides/*.yaml` - For quality validation

This minimizes context usage while providing detailed guidance when needed.