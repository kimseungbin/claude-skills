# Getting Started Guide

This guide walks you through installing skills from the Claude Code marketplace into your project.

## Prerequisites

- Claude Code installed on your system
- A project where you want to use Claude Code skills

## Setup Instructions

### Step 1: Install from Marketplace

Install this skills package using the Claude Code CLI:

```bash
claude install @kimseungbin/claude-skills
```

This installs all available skills and plugins into your project.

### Step 2: Verify Setup

Test that Claude Code can discover your skills:

1. Open Claude Code in your project
2. Check available skills with `/skills` command
3. Test a skill: "Test if 'claude-md-refactoring' works"

### Step 3: Add Commands (Optional)

If you want to use the example commands from this repository:

```bash
# Copy commands to your project
cp node_modules/@kimseungbin/claude-skills/commands/*.md .claude/commands/
```

**Why copy instead of reference?**

- Commands are typically small and project-specific
- Copying allows easy customization per project
- Commands can reference project-specific skills or tools

**Customizing commands:**
After copying, edit the commands in `.claude/commands/` to:

- Adjust `allowed-tools` to match your project's needs
- Update skill references if you renamed or customized skills
- Add project-specific instructions or constraints

## Team Collaboration

### For Team Members

Once skills are installed in the project, team members simply need Claude Code installed. The skills are available automatically after cloning the repository.

### Onboarding New Projects

When starting a new project that should use these skills:

1. Run `claude install @kimseungbin/claude-skills`
2. Verify skills are available
3. Commit any configuration changes

## Troubleshooting

### Skill Not Discovered by Claude Code

- Ensure the skill has a `SKILL.md` file with proper frontmatter
- Restart Claude Code

### Skills Not Installing

```bash
# Retry installation
claude install @kimseungbin/claude-skills

# Check installed packages
claude list
```

## Next Steps

- **Configure skills for your project**: See [Configuration Guide](configuration.md)
- **Contribute new skills**: See [Contributing](#contributing-new-skills) in the main README

## Questions?

If you encounter issues not covered here, check:
- The main [README.md](../README.md)
- [Troubleshooting](#troubleshooting) section above
- Claude Code documentation