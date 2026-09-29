# Project-Specific Configuration Guide

This guide explains how to customize shared skills for project-specific requirements without modifying the installed skills themselves.

## Overview

Skills in this repository are designed to be generic and reusable. When you need project-specific customizations, use external config files instead of modifying the installed skills.

## The Config File Pattern

**Pattern: External Config Files**

Skills read optional project config from `.claude/config/`. A single-skill plugin uses `.claude/config/<skill-name>.yaml`; a plugin with several skills nests by plugin and skill, as the git plugin does with `.claude/config/git/commit/main.yaml`. Each skill's `SKILL.md` names its exact path.

**Example Structure:**

```
.claude/
└── config/
    ├── git/
    │   └── commit/
    │       └── main.yaml                    # commit skill
    ├── codebase-index.yaml                  # codebase-index plugin
    └── korean-technical-translator.yaml     # korean-technical-translator plugin
```

The skills themselves are installed via the marketplace and live outside the project; only the config files are committed to it.

### How It Works

1. **Installed skills remain unchanged** - Managed by the marketplace
2. **Config files are project-specific** - Real files committed to your project repo
3. **Skills check for config files** - When a skill's config file exists, the skill follows it; otherwise it uses its built-in defaults

## Example: The Commit Skill

The git plugin's `commit` skill writes Conventional Commits. Without config it uses the standard types; with `.claude/config/git/commit/main.yaml` it follows the project's own types, scopes and language:

```yaml
# .claude/config/git/commit/main.yaml
project: my-awesome-project
language: en              # en | mixed | ko

types_quick:
  feat: "New feature or capability"
  fix: "Bug fix"
  docs: "Documentation only"
  chore: "Maintenance, tooling, dependencies"

scopes_quick:
  app: "Application code"
  deployment:
    description: "CI/CD pipelines"
    default_type: "chore"   # skip type deliberation for this scope
```

`Skill(git:commit-config)` generates this file from the samples in `plugins/git/config/samples/`, and the `commit-msg/conventional.sh` git hook validates commit messages against the same `types_quick` and `scopes_quick`.

## Creating Config Files

**When Claude encounters project-specific requirements:**

1. **User specifies project rules**: "For this project, write commit subjects in Korean and add an `infra` scope"

2. **Claude should**:
    - Check whether the skill's config file exists
    - If not, create it with the project-specific settings (for the commit skill, run `Skill(git:commit-config)`)
    - If it exists, update it with the new rules

3. **Example result**:

    ```yaml
    # .claude/config/git/commit/main.yaml (excerpt)
    language: mixed           # type/scope in English, subject in Korean

    scopes_quick:
      infra: "Infrastructure code"
    ```

4. **Commit the config file**:
    ```bash
    git add .claude/config/
    git commit -m "chore(config): Add project-specific commit rules"
    ```

## Benefits of This Approach

✅ **Clean separation** - Shared skills vs project-specific config
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

### Skipping Diffs of Generated Files

The commit skill never loads diffs matching `never_read`, and flags a derived file that changed without its source:

```yaml
# .claude/config/git/commit/main.yaml
diff_policy:
  never_read:
    - "package-lock.json"
    - "**/__snapshots__/**"
  commit_with:
    "package-lock.json": "package.json"
```

### Breaking-Change Detection

Tell the commit skill what counts as breaking in this project, and which paths have no consumer-facing surface:

```yaml
# .claude/config/git/commit/main.yaml
breaking_changes:
  detect: true
  marker: both            # both | footer | bang
  hints:
    - "A config key was removed, renamed, or became required"
  exempt_paths:
    - "**/*.test.*"
    - "docs/**"
```

### Tool Preferences

```yaml
# .claude/config/doc-generator.yaml
document_pdf_tool: md-to-pdf
slides_tool: marp-cli
```

## Config File Location

**Config file location:** `.claude/config/`, at the path each skill documents.

| Skill | Config file |
|-------|-------------|
| git: `commit`, `commit-config` | `.claude/config/git/commit/main.yaml` |
| git: `git-hooks-setup` | `.claude/config/git-hooks.yaml` |
| codebase-index | `.claude/config/codebase-index.yaml` |
| korean-technical-translator | `.claude/config/korean-technical-translator.yaml` |
| cdk-expert | `.claude/config/cdk-expert.yaml` |
| lint-gate | `.claude/config/lint-gate.json` |
| github-pr-management | `.claude/config/pull-request-management.yaml` |
| doc-generator | `.claude/config/doc-generator.yaml` |
| git-strategy | `.claude/config/git-strategy.md` |

## Version Control

Config files should be:
- ✅ Committed to your project repository
- ✅ Shared with your team via git
- ✅ Included in pull requests when configuration changes
- ❌ NOT added to `.gitignore`

This ensures all team members use the same project-specific rules.
