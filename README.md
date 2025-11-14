# Claude Code Skills Repository

A collection of reusable Claude Code skills that can be shared across multiple projects using git submodules and symlinks.

## What are Claude Code Skills?

Claude Code skills are specialized prompt templates that extend Claude's capabilities for specific tasks. They're automatically discovered by Claude Code when placed in the `.claude/skills/` directory of your project.

## Available Skills

- **conventional-commits** - Create commits following Conventional Commits specification with intelligent multi-commit splitting
- **claude-md-refactoring** - Helps refactor CLAUDE.md files to separate AI instructions from human documentation
- **maintaining-documentation** - Maintain documentation system (CLAUDE.md, README.md, docs/) synchronized with code changes. Supports multiple project types (CDK, React, Python) via implementation guides
- **skill-creator** - Create new Claude Code skills following best practices and standardized structure
- **git-strategy** - Manage git workflow for environment-based infrastructure deployments with rollback capabilities
- **test-symlink-skill** - Test skill for verifying symlink functionality

## Available Commands

This repository also includes example slash commands in the `commands/` directory:

- **commit** - Invokes the conventional-commits skill
- **refactor-claude-md** - Invokes the claude-md-refactoring skill

**IMPORTANT: Commands must be copied, not symlinked!** Unlike skills, slash commands do not support symlinks in Claude Code. Commands in `.claude/commands/` must be regular files. This repository uses copied commands in `.claude/commands/` for this reason.

## Why Use This Repository?

### Benefits of Shared Skills

- **Centralized maintenance**: Update skills in one place, apply across all projects
- **Version control**: Track skill versions and update selectively
- **Team collaboration**: Share skills with your entire team
- **Selective inclusion**: Only include the skills you need per project
- **Clean organization**: Keep project structure clear and maintainable

### Why Git Submodules + Symlinks?

This repository uses a combination of git submodules and symlinks to provide:

1. **Git submodules** - Track this repo as a dependency in your project
2. **Symlinks** - Create lightweight references from `.claude/skills/` to the submodule
3. **Flexibility** - Choose which skills to include in each project
4. **Auto-updates** - Pull latest skill improvements with a simple git command

## Setup Instructions

Follow these steps to use this skill repository in your project.

### Step 1: Add as Git Submodule

In your target project, add this repository as a git submodule:

```bash
# Navigate to your project root
cd /path/to/your/project

# Add the submodule
git submodule add <your-repo-url> claude-skills

# Initialize and update the submodule
git submodule update --init --recursive
```

**Note:** The path `claude-skills` is recommended for simplicity, but you can choose any location.

### Step 2: Create Symlinks to Skills

Claude Code discovers skills in `.claude/skills/`, so create symlinks from there to the skills in the submodule:

```bash
# Navigate to your skills directory
cd .claude/skills/

# Create symlinks for each skill you want to use
ln -s ../../claude-skills/skills/claude-md-refactoring claude-md-refactoring
ln -s ../../claude-skills/skills/test-symlink-skill test-symlink-skill

# Or create symlinks for all skills at once
cd .claude/skills && for skill_dir in ../../claude-skills/skills/*/; do
  skill_name=$(basename "$skill_dir")
  ln -s "../../claude-skills/skills/$skill_name" "$skill_name"
done
```

**Important:** Adjust paths based on where you placed your submodule.

### Step 3: Commit the Symlinks

Symlinks are tracked by git and will work for your team members:

```bash
git add .claude/skills/
git add claude-skills/
git add .gitmodules
git commit -m "Add shared Claude Code skills as submodule"
git push
```

### Step 4: Verify Setup

Test that Claude Code can discover your skills:

1. Open Claude Code in your project
2. Check available skills with `/skills` command
3. Test a skill: "Test if 'claude-md-refactoring' works"

### Step 5: Add Commands (Optional)

If you want to use the example commands from this repository:

```bash
# Copy commands to your project (not symlinked)
cp claude-skills/commands/*.md .claude/commands/

# Or copy selectively
cp claude-skills/commands/commit.md .claude/commands/
```

**Why copy instead of symlink?**

- Commands are not officially documented to support symlinks in Claude Code
- Commands are typically small and project-specific
- Copying allows easy customization per project
- Commands can reference project-specific skills or tools

**Customizing commands:**
After copying, edit the commands in `.claude/commands/` to:

- Adjust `allowed-tools` to match your project's needs
- Update skill references if you renamed or customized skills
- Add project-specific instructions or constraints

## Project-Specific Customizations

### Adding Project-Specific Config Files

Skills in this repository are designed to be generic and reusable. When you need project-specific customizations, use external config files instead of modifying the symlinked skills.

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

### Example: Conventional Commits Skill

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

### Creating Config Files

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

### Benefits of This Approach

✅ **Symlinks stay simple** - Full directory symlinks, no file-by-file symlinking
✅ **Clear separation** - Shared skills vs project-specific config
✅ **Git-friendly** - Config files are regular files in your repo
✅ **Updateable** - Pull skill updates without conflicts
✅ **Team sharing** - Config files are committed and shared with team

### Designing Skills for Config Support

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

## Team Collaboration

### For Team Members

When team members clone the repository:

```bash
# Clone with submodules
git clone --recurse-submodules <your-project-url>

# Or if already cloned, initialize submodules
git submodule update --init --recursive
```

The symlinks work automatically, and Claude Code will discover the skills immediately.

### Onboarding New Projects

When starting a new project that should use these skills:

1. Follow Step 1-3 above to add the submodule
2. Create symlinks for the skills you need
3. Commit and push

## Updating Skills

### Update All Skills to Latest

To pull the latest changes from this skill repository:

```bash
# Navigate to the submodule
cd claude-skills

# Pull latest changes
git pull upstream main

# Go back to project root
cd ..

# Commit the submodule update
git add claude-skills
git commit -m "Update shared skills to latest version"
git push
```

### Update to a Specific Version

If you need to pin to a specific version:

```bash
cd claude-skills
git checkout <commit-hash-or-tag>
cd ..
git add claude-skills
git commit -m "Update shared skills to version X.Y.Z"
git push
```

### Check Current Version

```bash
cd claude-skills
git log -1 --oneline
```

## Contributing New Skills

If you maintain this shared skills repository and want to add new skills:

### Adding a New Skill

1. Create the skill directory and files:

    ```bash
    mkdir skills/my-new-skill
    cd skills/my-new-skill

    # Create SKILL.md with proper frontmatter
    cat > SKILL.md <<EOF
    ---
    name: my-new-skill
    description: |
      Clear description of what this skill does and when Claude should use it.
    ---

    # My New Skill

    [Skill content here...]
    EOF
    ```

2. Add supporting files if needed:

    ```bash
    # Examples, templates, reference materials, etc.
    touch examples.md
    touch templates.md
    ```

3. Commit and push:
    ```bash
    git add skills/my-new-skill
    git commit -m "Add my-new-skill"
    git push
    ```

### Using the New Skill in Projects

In projects that use this submodule:

1. Update the submodule:

    ```bash
    cd claude-skills
    git pull upstream main
    cd ..
    ```

2. Create symlink:
    ```bash
    cd .claude/skills
    ln -s ../../claude-skills/skills/my-new-skill my-new-skill
    git add my-new-skill
    git commit -m "Add my-new-skill symlink"
    ```

## Advanced: Automated Symlink Creation

### Post-Checkout Hook (Optional)

To automatically create symlinks after checkout, create `.git/hooks/post-checkout`:

```bash
#!/bin/bash

# Navigate to skills directory
cd .claude/skills/ || exit

# Create symlinks for all skills
for skill in ../../claude-skills/skills/*/; do
    skill_name=$(basename "$skill")
    ln -sf "../../claude-skills/skills/$skill_name" "$skill_name"
done
```

Make it executable:

```bash
chmod +x .git/hooks/post-checkout
```

**Note:** This will create symlinks for ALL skills in the submodule automatically.

## Repository Structure

```
claude-skills/
├── .claude/
│   ├── commands/                   # Copied commands (for testing in this repo)
│   │   ├── commit.md               # Copied from ../../commands/commit.md
│   │   └── refactor-claude-md.md   # Copied from ../../commands/refactor-claude-md.md
│   └── skills/                     # Symlinked skills (for testing in this repo)
│       ├── conventional-commits@   # → ../../skills/conventional-commits
│       └── claude-md-refactoring@  # → ../../skills/claude-md-refactoring
├── commands/                       # Example slash commands (source files)
│   ├── commit.md                   # Command that invokes conventional-commits skill
│   └── refactor-claude-md.md       # Command that invokes claude-md-refactoring skill
├── skills/                         # Shared skills for use as submodule
│   ├── conventional-commits/
│   │   ├── SKILL.md
│   │   ├── README.md
│   │   ├── commit-rules.yaml
│   │   └── commit-rules.template.yaml
│   ├── claude-md-refactoring/
│   │   ├── SKILL.md
│   │   ├── decision-tree.md
│   │   └── examples.md
│   └── test-symlink-skill/
│       └── SKILL.md
├── CLAUDE.md                       # AI instructions for this repository
└── README.md                       # This file (setup instructions for humans)
```

**Note:** This repo uses symlinks for skills but **copied files** for commands in `.claude/` for testing purposes. When using this repo as a submodule in your projects:

- **Skills**: Symlink them (officially supported)
- **Commands**: Copy them (symlinks NOT supported by Claude Code)

## Troubleshooting

### Symlink Not Working

**Check symlink path:**

```bash
ls -la .claude/skills/
readlink .claude/skills/skill-name
```

**Verify submodule initialized:**

```bash
git submodule status
```

### Skill Not Discovered by Claude Code

- Ensure the skill has a `SKILL.md` file with proper frontmatter
- Check that the symlink points to the correct directory
- Verify the symlink target exists: `ls -la .claude/skills/skill-name`
- Restart Claude Code

### Submodule Not Updating

```bash
# Force update
git submodule update --remote --force

# Or reinitialize
git submodule deinit -f claude-skills
git submodule update --init
```

### Submodule Detached HEAD

When you update a submodule, it enters "detached HEAD" state. This is normal:

```bash
cd claude-skills
git checkout main  # Or your default branch
git pull
```

### Team Member Can't See Submodule

They need to initialize submodules after cloning:

```bash
git submodule update --init --recursive
```

## Best Practices

### For Skill Maintainers

- **Keep skills generic**: Make skills project-agnostic when possible
- **Use clear naming**: Use descriptive kebab-case names
- **Document thoroughly**: Include examples and decision trees
- **Version carefully**: Use semantic versioning or clear commit messages
- **Test changes**: Verify skills work before pushing

### For Project Users

- **Pin versions**: Consider pinning to specific commits for stability
- **Selective inclusion**: Only symlink skills you actually use
- **Regular updates**: Periodically pull skill updates
- **Test after updates**: Verify skills still work after updating

## Additional Resources

- [Claude Code Documentation](https://docs.claude.com/en/docs/claude-code)
- [Claude Code Skills Guide](https://docs.claude.com/en/docs/claude-code/skills)
- [Git Submodules Documentation](https://git-scm.com/book/en/v2/Git-Tools-Submodules)
- [Understanding Symlinks](https://en.wikipedia.org/wiki/Symbolic_link)

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]
