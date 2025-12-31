# Commit Expert Subagent

Expert at creating Conventional Commits with intelligent multi-commit splitting, pattern learning from project history, and smart commit ordering.

## Setup

### Step 1: Copy the Agent File

Subagents do not support symlinks. Copy the agent file to your project:

```bash
mkdir -p .claude/agents
cp claude-skills/agents/commit-expert/commit-expert.md .claude/agents/
```

### Step 2: Set Up Configuration (Optional)

The agent works without configuration but can be customized for your project.

**Choose a sample based on your project type:**

| Project Type | Sample File |
|--------------|-------------|
| Small projects | `simple-main.yaml` |
| Monorepo | `monorepo-main.yaml` |
| Infrastructure (CDK/Terraform) | `infrastructure-main.yaml` |

**Copy configuration:**

```bash
mkdir -p .claude/config/commit-expert

# Choose one:
cp claude-skills/config/commit-expert/samples/simple-main.yaml \
   .claude/config/commit-expert/main.yaml

# Copy supporting files (optional, for detailed guidance)
cp -r claude-skills/config/commit-expert/samples/types \
      claude-skills/config/commit-expert/samples/scopes \
      .claude/config/commit-expert/
```

### Step 3: Customize Scopes

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
git commit -m "chore(config): Add commit-expert subagent and configuration"
```

## Usage

Invoke the subagent directly:

```bash
# Via Task tool
Task(subagent_type="commit-expert")
```

## Updating

### Updating the Agent

When the source agent is updated in `claude-skills`:

```bash
# Pull latest changes
cd claude-skills && git pull

# Re-copy the agent file
cp claude-skills/agents/commit-expert/commit-expert.md .claude/agents/

# Commit the update
git add .claude/agents/commit-expert.md
git commit -m "chore(agents): Update commit-expert to latest version"
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

This loads domain-specific guidance from `claude-skills/config/commit-expert/guides/`.

## Configuration Priority

The agent loads configuration in this order:

1. **Project-specific** (checked first): `.claude/config/commit-expert/main.yaml`
2. **Default samples** (reference only): `claude-skills/config/commit-expert/samples/`

## Directory Structure After Setup

```
your-project/
├── .claude/
│   ├── agents/
│   │   └── commit-expert.md      # Copied from submodule
│   └── config/
│       └── commit-expert/
│           ├── main.yaml         # Project-specific config
│           ├── types/            # (optional) Type helpers
│           └── scopes/           # (optional) Scope helpers
└── claude-skills/                # Git submodule
    ├── agents/
    │   └── commit-expert/
    │       ├── README.md         # This file
    │       └── commit-expert.md  # Source of truth
    └── config/
        └── commit-expert/
            └── samples/          # Sample configurations
```

## Features

- **Context isolation**: Runs in separate context window
- **Pattern learning**: Analyzes project's existing commit history
- **Smart ordering**: Suggests logical commit order (deps before features)
- **Multi-commit splitting**: Recommends splitting when appropriate
- **Quality checks**: Validates specificity before committing