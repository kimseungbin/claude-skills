# Commit Expert Configuration

Sample configuration for the `commit-expert` subagent.

## Quick Start

1. **Copy a sample configuration:**
   ```bash
   mkdir -p .claude/config/commit-expert

   # Choose based on your project type:
   # Small projects:
   cp claude-skills/config/commit-expert/samples/simple-main.yaml \
      .claude/config/commit-expert/main.yaml

   # Monorepo:
   cp claude-skills/config/commit-expert/samples/monorepo-main.yaml \
      .claude/config/commit-expert/main.yaml

   # Infrastructure (CDK/Terraform):
   cp claude-skills/config/commit-expert/samples/infrastructure-main.yaml \
      .claude/config/commit-expert/main.yaml
   ```

2. **Copy supporting files:**
   ```bash
   cp -r claude-skills/config/commit-expert/samples/types \
         claude-skills/config/commit-expert/samples/scopes \
         .claude/config/commit-expert/
   ```

3. **Customize scopes for your project** in `main.yaml`

4. **Commit config files:**
   ```bash
   git add .claude/config/commit-expert/
   git commit -m "chore(config): Add commit-expert configuration"
   ```

## Directory Structure

```
config/commit-expert/
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

The commit-expert agent loads configuration in this order:

1. **Project-specific** (checked first):
   `.claude/config/commit-expert/main.yaml`

2. **Default samples** (reference only):
   `claude-skills/config/commit-expert/samples/`

## Customization

### Adding Project-Specific Scopes

Edit `.claude/config/commit-expert/main.yaml`:

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

Create `.claude/config/commit-expert/examples/my-project.yaml`:

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