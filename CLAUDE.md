# Claude Code Skills Repository

This repository contains shared Claude Code skills designed for reuse across multiple projects.

## Repository Structure

```
claude-skills/
├── .claude/
│   ├── commands/                   # Local commands (copied for testing in this repo)
│   │   ├── commit.md               # Copied from ../../commands/commit.md
│   │   ├── create-pr.md            # Copied from ../../commands/create-pr.md
│   │   └── refactor-claude-md.md   # Copied from ../../commands/refactor-claude-md.md
│   └── skills/                     # Local skills (symlinked from skills/)
│       ├── conventional-commits@
│       └── claude-md-refactoring@
├── commands/                       # Example slash commands (source files)
│   ├── commit.md
│   ├── create-pr.md
│   └── refactor-claude-md.md
├── skills/                         # Shared skills directory (10 skills total)
│   ├── cdk-expert/
│   ├── claude-md-refactoring/
│   ├── conventional-commits/
│   ├── git-hooks-setup/
│   ├── git-strategy/
│   ├── maintaining-documentation/
│   ├── nestjs-patterns/
│   ├── pull-request-management/
│   ├── skill-creator/
│   └── test-symlink-skill/
├── CLAUDE.md                       # This file
└── README.md                       # Setup instructions for humans
```

**Note:** In this repo, `.claude/commands/` contains **copied files** (not symlinks). When using this repo as a submodule in other projects, users should **copy** commands, not symlink them. Commands do not support symlinks in Claude Code.

## Available Skills

### conventional-commits
**When to use:** User requests to commit changes or generate commit messages

Automatically creates properly formatted Conventional Commits with intelligent multi-commit splitting. Uses implementation guides (infrastructure, frontend, backend, fullstack) for domain-specific decision trees.

**Invoke:** `Skill(conventional-commits)` or `/commit` command

---

### maintaining-documentation
**When to use:** After making code changes that affect project structure, architecture, or behavior

Keeps documentation (CLAUDE.md, README.md, docs/) synchronized with code changes. Supports multiple project types via implementation guides (cdk-infrastructure, react-frontend, python-backend).

**Invoke:** `Skill(maintaining-documentation)`

---

### skill-creator
**When to use:** Creating a new Claude Code skill or adding implementation guides to existing skills

Guides through skill creation process following best practices and standardized structure. Supports hybrid pattern with project-type specific implementation guides.

**Invoke:** `Skill(skill-creator)`

---

### git-strategy
**When to use:** Managing git workflow for environment-based infrastructure deployments (DEV → STAGING → PROD)

Provides guidance on rollback procedures, emergency hotfixes, and branch management for infrastructure projects with multiple deployment environments.

**Invoke:** `Skill(git-strategy)`

---

### claude-md-refactoring
**When to use:** One-time task to refactor existing CLAUDE.md files

Separates AI instructions from human documentation, moving user-facing content to README.md while keeping technical details for Claude in CLAUDE.md.

**Invoke:** `Skill(claude-md-refactoring)` or `/refactor-claude-md` command

---

### test-symlink-skill
**When to use:** Debugging symlink functionality in Claude Code

Test skill for verifying symlinks work correctly in your environment.

**Invoke:** `Skill(test-symlink-skill)`

---

### cdk-expert
**When to use:** AWS CDK infrastructure refactoring, CloudFormation resource replacement safety, CDK Nag warnings, construct patterns

AWS CDK expert skill providing guidance on infrastructure patterns, CloudFormation safety, and best practices. Includes extensive documentation and MCP server integration. Supports project-specific configuration via `.claude/config/cdk-expert.yaml`.

**Invoke:** `Skill(cdk-expert)`

---

### git-hooks-setup
**When to use:** Setting up project-specific git hooks, pre-commit validation, quality gates

Generates custom git hooks tailored to your project's needs. Automatically detects project type and provides appropriate hooks with templates, examples, and comprehensive guides.

**Invoke:** `Skill(git-hooks-setup)`

---

### nestjs-patterns
**When to use:** NestJS repository pattern implementation, dependency injection setup, testing strategies, ESM configuration

Provides NestJS-specific patterns and best practices including abstract class patterns, DI configuration, testing strategies, and ESM module configuration.

**Invoke:** `Skill(nestjs-patterns)`

---

### pull-request-management
**When to use:** Creating pull requests, filling PR templates, analyzing deployment impacts, managing environment promotions

Comprehensive PR creation and management with template compliance, confidence-based decision making, deployment impact analysis, and checkbox alternatives. Supports project-specific configuration for PR rules and templates.

**Invoke:** `Skill(pull-request-management)` or `/create-pr` command

## Available Commands

- **commit**: Invokes the conventional-commits skill
- **create-pr**: Invokes the pull-request-management skill
- **refactor-claude-md**: Invokes the claude-md-refactoring skill

**Note:** Commands should be copied to `.claude/commands/` in target projects, not symlinked. Commands are typically project-specific and small enough to copy.

## Working with This Repository

### If User Asks About Setup

Direct them to README.md for complete setup instructions. Key steps:

1. Add this repo as git submodule in target project
2. Create symlinks from `.claude/skills/` to `skills/` directory
3. Copy desired commands from `commands/` to `.claude/commands/` (don't symlink)
4. Commit symlinks and commands

### Adding New Skills

**Use the skill-creator skill** to create new skills with proper structure and best practices.

```bash
# Invoke the skill-creator skill
Skill(skill-creator)
```

The skill-creator skill will:
- Guide you through skill creation process
- Generate proper directory structure and files
- Ensure frontmatter and documentation follow standards
- Create implementation guides if needed (for skills like conventional-commits)
- Test the skill in this repository

**When to create a new skill:**
- User requests a new automated workflow
- You identify a reusable pattern across projects
- An existing skill needs project-type variations (create implementation guide)

For complete skill creation guidelines, see `skills/skill-creator/SKILL.md`.

## Project-Specific Customizations

### Config File Pattern

Skills should be generic and reusable. For project-specific customizations, use external config files.

**Pattern:**

- Skills are symlinked from submodule (generic, shared)
- Config files are real files in `.claude/config/` (project-specific)
- Skills check for config files and use them if present

**Config file location:** `.claude/config/<skill-name>.yaml`

### When to Create Config Files

**If user specifies project-specific requirements:**

1. Check if `.claude/config/<skill-name>.yaml` exists
2. If not, create it:
    ```bash
    mkdir -p .claude/config
    cat > .claude/config/<skill-name>.yaml <<EOF
    # Project-specific config
    EOF
    ```
3. If exists, update it with new rules
4. Commit the config file

**Example:**

```bash
# User says: "For this project, all commits must include PROJ-XXX ticket numbers"

# Create config file
mkdir -p .claude/config
cat > .claude/config/conventional-commits.yaml <<EOF
project: my-project
ticket_format: "PROJ-{number}"
required_ticket: true
EOF

# Commit
git add .claude/config/
git commit -m "Add project-specific commit rules"
```

### Designing Skills with Config Support

When creating new skills, include this section in SKILL.md:

```markdown
## Project-Specific Configuration

This skill can be customized using `.claude/config/<skill-name>.yaml`.

**When to create:** If user specifies project-specific requirements, create this file.

**Example config:**
\`\`\`yaml

# Example structure

\`\`\`
```

## Key Commands

**Create symlinks for all skills:**

```bash
cd .claude/skills && for skill_dir in ../../skills/*/; do
  skill_name=$(basename "$skill_dir")
  ln -s "../../skills/$skill_name" "$skill_name"
done
```

**List available skills:**

```bash
ls -la skills/
```

**View skill structure:**

```bash
tree skills/skill-name
```

## Notes

- Skills in `skills/` are the source of truth
- `.claude/skills/` contains symlinks for testing
- README.md contains setup instructions for using this repo as a submodule in other projects
