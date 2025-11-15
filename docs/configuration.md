# Project-Specific Configuration Guide

This guide explains how to customize shared skills for project-specific requirements without modifying the symlinked skills themselves.

## Overview

Skills in this repository are designed to be generic and reusable. When you need project-specific customizations, use external config files instead of modifying the symlinked skills.

## The Config File Pattern

**Pattern: External Config Files**

Skills can optionally read from `.claude/config/<skill-name>.yaml` for project-specific settings. This keeps shared skills unchanged while allowing project customization.

**Example Structure:**

```
.claude/
├── skills/
│   └── conventional-commits@     # Symlink to submodule (generic)
├── config/
│   └── conventional-commits.yaml # Project-specific config (real file)
└── submodules/
    └── claude-skills/
```

### How It Works

1. **Skill symlinks remain unchanged** - Full directory symlinks to submodule
2. **Config files are project-specific** - Real files committed to your project repo
3. **Skills check for config files** - If `.claude/config/<skill-name>.yaml` exists, skill uses it

## Example: Conventional Commits Skill

**Generic skill (in submodule):**

```yaml
# skills/conventional-commits/SKILL.md
---
name: Conventional Commits
description: Create commits following Conventional Commits specification
---

# Conventional Commits

Follow the Conventional Commits specification:
- Use format: type(scope): message
- Keep subject line under 72 characters
- Use imperative mood
- Support multi-commit splitting

## Project-Specific Rules

If `.claude/config/conventional-commits.yaml` exists, also follow those rules.
If the config file doesn't exist, create it when the user specifies project rules.
```

**Project-specific config:**

```yaml
# .claude/config/conventional-commits.yaml
project: my-awesome-project
ticket_format: 'JIRA-{number}'
required_prefix: true
custom_types:
    - feat: New feature
    - fix: Bug fix
    - docs: Documentation only
    - perf: Performance improvement
approvers:
    - '@tech-lead'
branch_rules:
    main:
        - Require ticket number
        - Require approval
    develop:
        - Optional ticket number
```

## Creating Config Files

**When Claude encounters project-specific requirements:**

1. **User specifies project rules**: "For this project, all commits must include a ticket number in format PROJ-XXX"

2. **Claude should**:
    - Check if `.claude/config/<skill-name>.yaml` exists
    - If not, create the config file with project-specific settings
    - If exists, update with new rules

3. **Example workflow**:

    ```bash
    # Claude creates the config directory if needed
    mkdir -p .claude/config

    # Claude creates/updates the config file
    cat > .claude/config/conventional-commits.yaml <<EOF
    project: my-project
    ticket_format: "PROJ-{number}"
    required_ticket: true
    EOF
    ```

4. **Commit the config file**:
    ```bash
    git add .claude/config/
    git commit -m "Add project-specific commit rules"
    ```

## Benefits of This Approach

✅ **Symlinks stay simple** - Full directory symlinks, no file-by-file symlinking
✅ **Clear separation** - Shared skills vs project-specific config
✅ **Git-friendly** - Config files are regular files in your repo
✅ **Updateable** - Pull skill updates without conflicts
✅ **Team sharing** - Config files are committed and shared with team

## Designing Skills for Config Support

When creating skills in this repository, follow this pattern:

1. **Keep skill generic** - No project-specific details in SKILL.md
2. **Document config option** - Mention where to put project config
3. **Provide config example** - Show sample config structure
4. **Auto-create config** - Instruct Claude to create config file when user provides project rules

**Template for skill documentation:**

```markdown
## Project-Specific Configuration

This skill can be customized per-project using `.claude/config/<skill-name>.yaml`.

**Config file location:** `.claude/config/<skill-name>.yaml`

**When to create:** If the user specifies project-specific requirements, create this file.

**Example config:**
\`\`\`yaml

# Your example config structure

\`\`\`
```

## Common Configuration Patterns

### Ticket/Issue Tracking

```yaml
# .claude/config/conventional-commits.yaml
ticket_format: 'JIRA-{number}'
required_ticket: true
ticket_regex: '^[A-Z]+-\d+$'
```

### Branch-Specific Rules

```yaml
# .claude/config/git-strategy.yaml
branch_rules:
  main:
    - require_approval
    - require_tests
  develop:
    - require_tests
  feature/*:
    - optional_tests
```

### Project-Type Configuration

```yaml
# .claude/config/maintaining-documentation.yaml
project_type: cdk-infrastructure
documentation_scope:
  - CLAUDE.md
  - README.md
  - docs/architecture.md
update_triggers:
  - construct_changes
  - resource_additions
```

## Config File Location

**Config file location:** `.claude/config/<skill-name>.yaml`

All project-specific configuration files should be placed in the `.claude/config/` directory with the naming convention `<skill-name>.yaml`.

## Version Control

Config files should be:
- ✅ Committed to your project repository
- ✅ Shared with your team via git
- ✅ Included in pull requests when configuration changes
- ❌ NOT added to `.gitignore`

This ensures all team members use the same project-specific rules.