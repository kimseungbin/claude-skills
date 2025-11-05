# Git Strategy Skill

A Claude Code skill for managing environment-based git workflows for infrastructure-as-code projects.

## Overview

This skill provides intelligent guidance for git operations in projects that use environment-based branching (e.g., `master` → `staging` → `prod`), with focus on:

- **Daily development workflow** (committing, testing, promoting)
- **Production promotions** (selective vs. full merges, release tagging)
- **Rollback procedures** (safe reversion, emergency recovery)
- **Emergency procedures** (hotfixes, critical issues)
- **Branch management** (understanding divergence, comparing branches)

## When to Use This Skill

Use this skill when:

- User asks about branching strategy or git workflow
- User needs to promote changes between environments
- Production is broken and requires immediate rollback
- User needs emergency hotfix guidance
- User wants to understand what's pending promotion
- User asks about release management or tagging

## Project Configuration

This skill reads project-specific workflow from `.claude/config/git-strategy.md`.

### Configuration Structure

The configuration file should include:

- **Branch Structure**: Which branches map to which environments
- **Promotion Rules**: PR-based vs. local merge, frequency recommendations
- **Auto-Deployment**: Which branches trigger automatic deployments
- **Emergency Procedures**: Rollback commands, hotfix workflows
- **Commit Conventions**: Link to commit message format
- **Project Constraints**: Why certain patterns are used (e.g., no feature branches)

See template configuration structure in project-specific `.claude/config/git-strategy.md` files.

## Usage Examples

### Check Promotion Status

```
User: "What changes are pending promotion to staging?"
Skill: Runs `git log staging..master --oneline` and explains the commits
```

### Execute Rollback

```
User: "Production is broken, I need to rollback the last deployment"
Skill:
1. Checks recent prod commits
2. Identifies bad merge
3. Guides through `git revert -m 1 <commit>`
4. Monitors deployment
5. Suggests investigation steps
```

### Selective Production Promotion

```
User: "I want to promote only the first 2 releases from staging to prod"
Skill:
1. Shows available staging releases
2. Guides through selective merge of specific commits
3. Explains benefits of one-at-a-time approach
4. Helps tag the release
```

## Key Features

### Environment-Aware
- Understands branch → environment mapping
- Respects auto-deployment triggers
- Warns about production operations

### Safety-First
- Warns before destructive operations
- Recommends safe alternatives (`revert` over `reset`)
- Guides through verification steps

### Project-Specific
- Reads configuration from `.claude/config/git-strategy.md`
- Adapts advice to project's workflow
- Respects promotion cadence rules

### Emergency-Ready
- Provides rapid rollback guidance
- Supports hotfix workflow
- Includes emergency checklists

## Integration

Works well with:
- `conventional-commits`: Ensures commits follow conventions before promotion
- `pull-request-management`: Automates PR creation for promotions
- `cdk-expert`: Understands infrastructure deployment implications

## Installation

### As Git Submodule (Recommended)

```bash
# Add submodule to your project (if not already added)
git submodule add https://github.com/kimseungbin/claude-skills.git claude-skills

# Create symlink to git-strategy skill
ln -s ../../claude-skills/skills/git-strategy .claude/skills/git-strategy

# Create project-specific configuration
mkdir -p .claude/config
# Create .claude/config/git-strategy.md with project-specific workflow
```

### Standalone Installation

```bash
# Copy the skill directory to your project
mkdir -p .claude/skills
cp -r /path/to/git-strategy .claude/skills/

# Create project-specific configuration
mkdir -p .claude/config
# Create .claude/config/git-strategy.md with project-specific workflow
```

## Configuration Template

Create `.claude/config/git-strategy.md` in your project:

```markdown
# Git Strategy Configuration - {Project Name}

> **Project-specific git workflow configuration for Claude Code**
> **Full Documentation:** [GIT_STRATEGY.md](../../GIT_STRATEGY.md)

## Branch Structure

```
master (DEV) → staging (STAGING) → prod (PRODUCTION)
   ↓                 ↓                    ↓
AWS DEV        AWS STAGING        AWS PRODUCTION
```

## Promotion Rules

- **master → staging**: Via Pull Request (frequency: every 2-3 commits)
- **staging → prod**: Local merge (selective, one release at a time)

## Auto-Deployment

- **master**: Auto-deploys to DEV on push
- **staging**: Auto-deploys to STAGING on push
- **prod**: Auto-deploys to PRODUCTION on push

## Emergency Procedures

[Include rollback commands, hotfix workflow]
```

## Contributing

When improving this skill:

1. Test with real git scenarios
2. Ensure safety warnings for destructive operations
3. Keep instructions clear and step-by-step
4. Update examples with real-world use cases
5. Document project constraints (infrastructure-specific patterns)

## License

Part of the claude-skills collection. Shared across multiple projects via git submodule.