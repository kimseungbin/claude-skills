# Getting Started Guide

This guide walks you through setting up this skills repository as a git submodule in your project.

## Prerequisites

- Git installed on your system
- A project where you want to use Claude Code skills
- Basic familiarity with git submodules and symlinks

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

**Important Notes:**
- Adjust paths based on where you placed your submodule
- **⚠️ Do NOT symlink the entire `skills/` directory** (e.g., `ln -s ../../claude-skills/skills skills`). This prevents you from adding project-specific skills to `.claude/skills/` alongside the shared ones.
- Instead, create **individual symlinks for each skill** as shown above. This allows you to:
  - Mix shared skills (symlinked) with project-specific skills (real directories)
  - Selectively choose which shared skills to include
  - Easily distinguish between shared and custom skills

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

## Next Steps

- **Configure skills for your project**: See [Configuration Guide](configuration.md)
- **Update skills regularly**: See [Updating Skills](#updating-skills) in the main README
- **Contribute new skills**: See [Contributing](#contributing-new-skills) in the main README

## Questions?

If you encounter issues not covered here, check:
- The main [README.md](../README.md)
- [Troubleshooting](#troubleshooting) section above
- Claude Code documentation
