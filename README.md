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

## Quick Start

**📖 See [Getting Started Guide](docs/getting-started.md) for detailed setup instructions.**

Quick setup:

```bash
# 1. Add as submodule
git submodule add <your-repo-url> claude-skills
git submodule update --init --recursive

# 2. Create individual symlinks for each skill
cd .claude/skills && for skill_dir in ../../claude-skills/skills/*/; do
  skill_name=$(basename "$skill_dir")
  ln -s "../../claude-skills/skills/$skill_name" "$skill_name"
done

# 3. Commit
git add .claude/skills/ claude-skills/ .gitmodules
git commit -m "Add shared Claude Code skills as submodule"
git push
```

**⚠️ Important:** Create individual symlinks for each skill (as shown above), not a single symlink to the entire `skills/` directory. This allows you to mix shared skills with project-specific ones.

**Team members cloning the project:**
```bash
git clone --recurse-submodules <your-project-url>
```

## Project-Specific Customizations

Skills in this repository are designed to be generic and reusable. When you need project-specific customizations, use external config files instead of modifying the symlinked skills.

Skills can optionally read from `.claude/config/<skill-name>.yaml` for project-specific settings. This keeps shared skills unchanged while allowing project customization.

**📖 See [Configuration Guide](docs/configuration.md) for detailed examples and patterns.**

Quick example:

```yaml
# .claude/config/conventional-commits.yaml
project: my-awesome-project
ticket_format: 'JIRA-{number}'
required_prefix: true
```


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
│   │   └── refactor-claude-md.md   # Copied from ../../commands/refactor-claude-md.md
│   └── skills/                     # Symlinked skills (for testing in this repo)
│       └── claude-md-refactoring@  # → ../../skills/claude-md-refactoring
├── commands/                       # Example slash commands (source files)
│   └── refactor-claude-md.md       # Command that invokes claude-md-refactoring skill
├── docs/                           # Documentation
│   ├── configuration.md            # Project-specific configuration guide
│   └── getting-started.md          # Detailed setup instructions
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
└── README.md                       # This file (overview and quick reference)
```

**Note:** This repo uses symlinks for skills but **copied files** for commands in `.claude/` for testing purposes. When using this repo as a submodule in your projects:

- **Skills**: Symlink them (officially supported)
- **Commands**: Copy them (symlinks NOT supported by Claude Code)

## Troubleshooting

**📖 See [Getting Started Guide](docs/getting-started.md#troubleshooting) for common setup issues and solutions.**

Quick troubleshooting:
- **Skills not discovered?** Check symlinks with `ls -la .claude/skills/`
- **Submodule issues?** Run `git submodule update --init --recursive`
- **Team member setup?** Ensure they clone with `--recurse-submodules`

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
