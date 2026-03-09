# Commit Expert

Expert at creating Conventional Commits with intelligent multi-commit splitting, pattern learning from project history, and smart commit ordering.

## Installation

Install via the Claude Code marketplace:

```bash
claude install kimseungbin/claude-skills/plugins/commit-expert
```

## Setup

### Step 1: Set Up Configuration (Optional)

The plugin works without configuration but can be customized for your project.

**Choose a sample based on your project type:**

| Project Type | Sample File |
|--------------|-------------|
| Small projects | `simple-main.yaml` |
| Monorepo | `monorepo-main.yaml` |
| Infrastructure (CDK/Terraform) | `infrastructure-main.yaml` |

**Copy configuration from the plugin's sample files:**

```bash
mkdir -p .claude/config/commit-expert

# Copy a sample config and customize it
# See plugins/commit-expert/config/samples/ for available templates
```

### Step 2: Customize Scopes

Edit `.claude/config/commit-expert/main.yaml` to match your project structure:

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

### Step 4: Commit Setup Files

```bash
git add .claude/agents/commit-expert.md .claude/config/commit-expert/
git commit -m "chore(config): Add commit-expert configuration"
```

## Usage

Invoke the skill:

```
Skill(commit)
```

## Updating

### Updating the Plugin

Update via the Claude Code marketplace:

```bash
claude install kimseungbin/claude-skills/plugins/commit-expert
```

### Updating Configuration

Configuration is project-specific and generally doesn't need to be updated from samples.

**To add new scopes:**

Edit `.claude/config/commit-expert/main.yaml`:

```yaml
scopes_quick:
  # Add new scope
  api:
    description: "API package"
    patterns:
      - "packages/api/**"
```

**To use implementation guides:**

Add to your `main.yaml`:

```yaml
implementation: infrastructure  # Options: infrastructure, frontend, backend, fullstack
```

This loads domain-specific guidance from the plugin's bundled guides.

## Configuration Priority

The agent loads configuration in this order:

1. **Project-specific** (checked first): `.claude/config/commit-expert/main.yaml`
2. **Default samples** (reference only): Bundled in the plugin under `config/samples/`

## Directory Structure After Setup

```
your-project/
├── .claude/
│   └── config/
│       └── commit-expert/
│           ├── main.yaml         # Project-specific config
│           ├── types/            # (optional) Type helpers
│           └── scopes/           # (optional) Scope helpers
```

The plugin itself is installed and managed by Claude Code via the marketplace.

## Features

- **Context isolation**: Runs in separate context window
- **Pattern learning**: Analyzes project's existing commit history
- **Smart ordering**: Suggests logical commit order (deps before features)
- **Multi-commit splitting**: Recommends splitting when appropriate
- **Quality checks**: Validates specificity before committing