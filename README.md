# Claude Code Skills Repository

A collection of reusable Claude Code skills that can be shared across multiple projects via the Claude Code marketplace.

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

Commands are included automatically when installed via the marketplace.

## Why Use This Repository?

### Benefits of Shared Skills

- **Centralized maintenance**: Update skills in one place, apply across all projects
- **Easy installation**: Install with a single `claude install` command
- **Team collaboration**: Share skills with your entire team
- **Clean organization**: Keep project structure clear and maintainable

## Quick Start

Install from the Claude Code marketplace:

```bash
claude install kimseungbin/claude-skills
```

This makes all skills and plugins available in your project automatically.

## Project-Specific Customizations

Skills in this repository are designed to be generic and reusable. When you need project-specific customizations, use external config files instead of modifying the installed skills.

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

To update to the latest version:

```bash
claude install kimseungbin/claude-skills
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

After the skill is pushed, users can update their installation:

```bash
claude install kimseungbin/claude-skills
```

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
├── skills/                         # Shared skills
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

**Note:** This repo uses symlinks for skills and copied files for commands in `.claude/` for local testing purposes.

## Troubleshooting

**📖 See [Getting Started Guide](docs/getting-started.md#troubleshooting) for common setup issues and solutions.**

Quick troubleshooting:
- **Skills not discovered?** Re-run `claude install kimseungbin/claude-skills`
- **Check installation:** Verify skills are present in `.claude/skills/`

## Best Practices

### For Skill Maintainers

- **Keep skills generic**: Make skills project-agnostic when possible
- **Use clear naming**: Use descriptive kebab-case names
- **Document thoroughly**: Include examples and decision trees
- **Version carefully**: Use semantic versioning or clear commit messages
- **Test changes**: Verify skills work before pushing

### For Project Users

- **Regular updates**: Periodically re-run `claude install` to get latest improvements
- **Test after updates**: Verify skills still work after updating

## Additional Resources

- [Claude Code Documentation](https://docs.claude.com/en/docs/claude-code)
- [Claude Code Skills Guide](https://docs.claude.com/en/docs/claude-code/skills)
- [Claude Code Marketplace](https://docs.claude.com/en/docs/claude-code/marketplace)

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]
