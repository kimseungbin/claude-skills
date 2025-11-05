# Git Hooks Setup Guide

Complete guide for setting up custom git hooks in your project.

## Prerequisites

- Git 2.9+ (for `core.hooksPath` support)
- Unix-based system (macOS, Linux) or Git Bash on Windows
- Project with `.githooks/` directory containing hook scripts

## Initial Configuration (One-Time Setup)

After cloning a repository with custom hooks, enable them:

### Step 1: Configure Git

Tell Git to use the custom hooks directory instead of `.git/hooks/`:

```bash
git config core.hooksPath .githooks
```

**What this does**: Git will now execute hooks from `.githooks/` which is version-controlled and shared across the team.

### Step 2: Make Hooks Executable

On Unix-based systems, hook scripts must have execute permissions:

```bash
chmod +x .githooks/*
```

**Windows users**: Git Bash automatically handles permissions, but if you encounter issues, ensure your git config has `core.fileMode` set correctly.

### Step 3: Verify Configuration

Check that hooks are properly configured:

```bash
# Should output: .githooks
git config core.hooksPath
```

If the output is empty or incorrect, repeat Step 1.

## Testing Your Hooks

### Test Pre-commit Hook

Make a small change and attempt to commit:

```bash
# Make a trivial change
echo "# Test" >> README.md

# Stage the change
git add README.md

# Attempt commit (hook will run)
git commit -m "test: Verify hooks are working"
```

**What to expect**:

- You should see hook output (e.g., "Running pre-commit checks...")
- Hook may auto-fix formatting (Prettier, ESLint)
- Hook may block commit if validation fails
- If successful, you'll see the commit hash

**Cleanup**:

```bash
# Undo the test commit
git reset HEAD~1

# Restore README.md
git restore README.md
```

### Test Commit-msg Hook

If your project has a `commit-msg` hook:

```bash
# Try an invalid commit message
git commit --allow-empty -m "bad message"

# Should be rejected if validation is enabled
```

### Test Pre-push Hook

If your project has a `pre-push` hook:

```bash
# Create a test branch
git checkout -b test-hooks

# Make and commit a change
echo "test" > test.txt
git add test.txt
git commit -m "test: Hook test"

# Try to push (hook will run)
git push origin test-hooks

# Cleanup
git checkout main
git branch -D test-hooks
```

## Per-Project vs Global Configuration

### Per-Project (Recommended)

The setup above is **per-project**. Each repository can have its own hooks.

```bash
# Check current project's hooks path
git config core.hooksPath
```

### Global (Not Recommended)

You can set hooks globally, but this is generally not recommended:

```bash
# DON'T DO THIS (affects all repos)
git config --global core.hooksPath ~/.githooks

# Each project should manage its own hooks
```

## Team Onboarding

### For New Team Members

When a new team member clones the repository, they should:

1. Read the project's README or CONTRIBUTING guide
2. Run the setup commands (Steps 1-2 above)
3. Test hooks before making their first commit
4. Ask for help if hooks don't work as expected

### Documentation in Your Project

Add this to your project's README.md or CONTRIBUTING.md:

```markdown
## Git Hooks Setup

This project uses custom git hooks to ensure code quality. After cloning:

1. Configure git to use custom hooks:
   \`\`\`bash
   git config core.hooksPath .githooks
   chmod +x .githooks/\*
   \`\`\`

2. Verify setup:
   \`\`\`bash
   git config core.hooksPath # Should output: .githooks
   \`\`\`

3. Test with a commit:
   \`\`\`bash
   git commit --allow-empty -m "test: Verify hooks work"
   git reset HEAD~1 # Undo test commit
   \`\`\`

See `.githooks/` directory for hook scripts and [HOOKS.md](docs/HOOKS.md) for details.
```

## Troubleshooting

See [troubleshooting.md](troubleshooting.md) for common issues and solutions.

## Advanced Configuration

### Hook-Specific Configuration

Some projects may support hook configuration via files:

- `.githooks/config` - Shell script sourced by hooks
- `.claude/config/git-hooks.yaml` - YAML configuration for Claude Code-generated hooks

### Skipping Hooks Temporarily

To bypass hooks for a single commit:

```bash
git commit --no-verify -m "WIP: Skip hooks for now"
```

**Use sparingly!** Only skip hooks when:

- Committing work-in-progress that you'll fix later
- Emergency hotfix (fix quality issues immediately after)
- You understand what you're doing

### Disabling Hooks Permanently

To disable hooks for your local repository:

```bash
# Unset hooks path (reverts to no custom hooks)
git config --unset core.hooksPath
```

**Warning**: This opts you out of quality checks. Your commits may be rejected by CI/CD.

## Updating Hooks

When hook scripts are updated in the repository:

1. Pull the latest changes: `git pull`
2. No additional setup needed (hooks path already configured)
3. Permissions should be preserved (if committed correctly)

If hooks stop working after an update:

```bash
# Re-run permission fix
chmod +x .githooks/*
```

## Next Steps

- Read [decision-tree.md](../decision-tree.md) to understand how hooks were chosen
- See [testing-hooks.md](testing-hooks.md) for testing strategies
- Check [../examples/templates/](../examples/templates/) for hook templates
- View [../examples/implementations/](../examples/implementations/) for real-world examples
