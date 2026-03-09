# Git Plugin

Git workflow tools: Conventional Commits with smart splitting, and custom git hooks generation.

## Installation

Install via the Claude Code marketplace:

```bash
claude install kimseungbin/claude-skills/plugins/git
```

## Skills

### commit

Expert at creating Conventional Commits with intelligent multi-commit splitting, pattern learning from project history, and smart commit ordering.

- **Context isolation**: Runs in separate context window (`context: fork`)
- **Pattern learning**: Analyzes project's existing commit history
- **Smart ordering**: Suggests logical commit order (deps before features)
- **Multi-commit splitting**: Recommends splitting when appropriate

**Invoke:** `Skill(commit)`

### config-updater

Reviews and updates commit configuration when the plugin version changes. Also migrates deprecated config paths from `commit-expert` to `git/commit`.

**Invoke:** `Skill(git:config-updater)`

### git-hooks-setup

Generates custom git hooks tailored to your project's needs. Includes pre-built bundles for common project types (TypeScript, monorepo, AWS CDK) with shared library functions.

**Invoke:** `Skill(git-hooks-setup)`

## Configuration

### Commit Config (Optional)

The commit skill works without configuration but can be customized.

**Choose a sample based on your project type:**

| Project Type | Sample File |
|--------------|-------------|
| Small projects | `simple-main.yaml` |
| Monorepo | `monorepo-main.yaml` |
| Infrastructure (CDK/Terraform) | `infrastructure-main.yaml` |

**Setup:**

```bash
mkdir -p .claude/config/git/commit

# Copy a sample config and customize it
# See plugins/git/config/samples/ for available templates
```

**Config priority:**

1. **Project-specific** (checked first): `.claude/config/git/commit/main.yaml`
2. **Default samples** (reference only): Bundled in the plugin under `config/samples/`

### Git Hooks Setup

For project-specific hook requirements, create `.claude/config/git-hooks.yaml`:

```yaml
pre_commit:
    blocking:
        - format
        - type-check
    non_blocking:
        - lint

commit_msg:
    require_conventional: true

pre_push:
    - test:e2e
    - docker:build
```

## Migration from commit-expert

If you previously used the `commit-expert` plugin:

1. Run `Skill(git:config-updater)` — it will automatically migrate your config from `.claude/config/commit-expert/` to `.claude/config/git/commit/`
2. Update your `CLAUDE.md` references from `Skill(commit-expert:config-updater)` to `Skill(git:config-updater)`

## Directory Structure

```
plugins/git/
├── .claude-plugin/plugin.json
├── README.md
├── config/                     # Commit config samples & guides
│   ├── guides/                 # Implementation guides (backend, frontend, etc.)
│   └── samples/                # Sample configs by project type
├── bundles/                    # Pre-built git hook bundles
│   ├── base/.githooks/         # Shared library (colors, output, utils)
│   └── hooks/                  # Hook templates (pre-commit, pre-push, commit-msg)
├── guides/                     # Git hooks guides
│   ├── decision-tree.md
│   ├── project-detection.md
│   ├── setup-guide.md
│   ├── testing-hooks.md
│   └── troubleshooting.md
└── skills/
    ├── commit/SKILL.md
    ├── config-updater/SKILL.md
    └── git-hooks-setup/SKILL.md
```
