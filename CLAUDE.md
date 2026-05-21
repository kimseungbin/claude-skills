# Claude Code Skills Repository

This repository contains shared Claude Code skills designed for reuse across multiple projects.

## Default Behaviors

**Committing changes:** Always use the `commit` skill when the user asks to commit, create commits, or generate commit messages. Invoke with `Skill(commit)`.

## Repository Structure

```
claude-skills/
├── .claude/
│   ├── commands/                   # Local commands (copied for testing)
│   ├── config/                     # Project-specific plugin overrides
│   ├── skills/                     # Local skills (symlinked from skills/, plus local-only)
│   └── settings.local.json
├── .claude-plugin/
│   └── marketplace.json            # Marketplace registry
├── commands/                       # Slash commands (source files)
├── skills/                         # Shared skills directory
│   ├── claude-md-refactoring/
│   ├── doc-generator/
│   ├── git-strategy/
│   ├── maintaining-documentation/
│   ├── nestjs-patterns/
│   ├── release-notes/
│   └── skill-creator/
├── plugins/                        # Standalone plugins
│   ├── cdk-expert/
│   ├── codebase-index/
│   ├── git/
│   ├── github-issue-writer/
│   ├── github-pr-management/
│   ├── korean-technical-translator/
│   ├── marketplace-feedback/
│   └── tidy/
├── CLAUDE.md                       # This file
└── README.md                       # Setup instructions for humans
```

**Note:** In this repo, `.claude/commands/` contains **copied files** (not symlinks). Commands do not support symlinks in Claude Code.

Skill, plugin, and command descriptions live in their own frontmatter (`SKILL.md`, `plugin.json`, command `.md` files) and are loaded into every session automatically. Don't duplicate them here.

## Working with This Repository

### If User Asks About Setup

Direct them to README.md for complete setup instructions. Install via the Claude Code marketplace:

```bash
claude install kimseungbin/claude-skills
```

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

- Skills are installed via the marketplace (generic, shared)
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

# Create config directory and file
mkdir -p .claude/config/git/commit
cat > .claude/config/git/commit/main.yaml <<EOF
project: my-project
ticket_format: "PROJ-{number}"
required_ticket: true
EOF

# Commit
git add .claude/config/
git commit -m "chore(config): Add project-specific commit rules"
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

**List available skills:**

```bash
ls -la skills/
```

**View skill structure:**

```bash
tree skills/skill-name
```

## Plugin Versioning

Plugin patch versions are **auto-bumped by the pre-commit hook** (`.githooks/pre-commit`). When any file under `plugins/<name>/` is staged, the hook:

1. Bumps the patch version in `.claude-plugin/plugin.json`
2. Propagates the new version to all files that reference it:
   - `# plugin_version:` comments in hook/bundle `.sh` files
   - `plugin_version:` fields in config sample `.yaml` files
   - Version-check strings in `SKILL.md` files
3. Updates `.claude-plugin/marketplace.json` if it exists
4. Re-stages all modified files

**Do not manually bump versions** — the hook handles it. If you need a major/minor bump, edit `plugin.json` before committing and the hook will detect the manual bump and skip auto-bumping.

## Notes

- Skills in `skills/` are the source of truth
- `.claude/skills/` contains symlinks for local testing
- This repo is distributed via the Claude Code marketplace (`claude install`)
