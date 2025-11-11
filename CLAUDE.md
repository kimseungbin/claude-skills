# Claude Code Skills Repository

This repository contains shared Claude Code skills designed for reuse across multiple projects.

## Repository Structure

```
claude-skills/
├── .claude/
│   ├── commands/                   # Local commands (copied for testing in this repo)
│   │   ├── commit.md               # Copied from ../../commands/commit.md
│   │   └── refactor-claude-md.md   # Copied from ../../commands/refactor-claude-md.md
│   └── skills/                     # Local skills (symlinked from skills/)
│       ├── conventional-commits@
│       └── claude-md-refactoring@
├── commands/                       # Example slash commands (source files)
│   ├── commit.md
│   └── refactor-claude-md.md
├── skills/                         # Shared skills directory
│   ├── conventional-commits/
│   ├── claude-md-refactoring/
│   ├── maintaining-documentation/
│   ├── skill-creator/
│   ├── git-strategy/
│   └── test-symlink-skill/
├── CLAUDE.md                       # This file
└── README.md                       # Setup instructions for humans
```

**Note:** In this repo, `.claude/commands/` contains **copied files** (not symlinks). When using this repo as a submodule in other projects, users should **copy** commands, not symlink them. Commands do not support symlinks in Claude Code.

## Available Skills

- **conventional-commits**: Create commits following Conventional Commits specification with intelligent multi-commit splitting
- **claude-md-refactoring**: Refactor CLAUDE.md files to separate AI instructions from human documentation
- **maintaining-documentation**: Maintain documentation system (CLAUDE.md, README.md, docs/) synchronized with code changes. Supports multiple project types (CDK, React, Python) via implementation guides
- **skill-creator**: Create new Claude Code skills following best practices and standardized structure. Supports hybrid pattern with implementation guides
- **git-strategy**: Manage git workflow for environment-based infrastructure deployments with rollback capabilities
- **test-symlink-skill**: Test skill for verifying symlink functionality

## Available Commands

- **commit**: Invokes the conventional-commits skill
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

Create skills in `skills/` directory:

```bash
mkdir skills/new-skill-name
# Create SKILL.md with proper frontmatter
# Add supporting files as needed
```

Each skill must have `SKILL.md` with frontmatter:

```yaml
---
name: skill-name
description: |
    Clear description of what this skill does and when to use it.
---
```

### Testing Skills

Test skills by creating symlinks to `.claude/skills/`:

```bash
cd .claude/skills
ln -s ../../skills/skill-name skill-name
```

### Best Practices for Skills

- **Keep generic**: Make skills project-agnostic where possible
- **Clear naming**: Use descriptive kebab-case names
- **Include examples**: Add supporting documentation (examples.md, decision-tree.md, etc.)
- **Test thoroughly**: Verify skills work before committing
- **Support config files**: Design skills to optionally read from `.claude/config/<skill-name>.yaml`

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
