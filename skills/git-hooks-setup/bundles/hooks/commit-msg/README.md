# Commit-msg Hooks

Commit-msg hooks validate commit messages before finalizing the commit.

## Available Hooks

### `conventional.sh`

**For:** Projects following Conventional Commits specification

**Validates:**
- Commit message format: `type(scope): subject`
- Valid commit types (feat, fix, docs, etc.)

**Use when:** Team uses Conventional Commits for changelog generation or semantic versioning.

---

### `skill-enforcement.sh`

**For:** Teams using Claude Code's conventional-commits skill

**Validates:**
- Presence of `Skill: conventional-commits` footer in commit message
- Ensures all commits are created via the skill, not manually

**Use when:** You want to ensure consistent commit quality by requiring the skill.

## Installation

```bash
# 1. Ensure base bundle is copied first
cp -r bundles/base/.githooks/ .githooks/

# 2. Copy desired commit-msg hook
cp bundles/hooks/commit-msg/conventional.sh .githooks/commit-msg

# 3. Make executable
chmod +x .githooks/commit-msg

# 4. Configure git
git config core.hooksPath .githooks
```

## Combining Hooks

You can combine multiple commit-msg validations:

```bash
#!/bin/bash
# .githooks/commit-msg

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run conventional commits validation
source "$SCRIPT_DIR/validators/conventional.sh" "$1"
if [ $? -ne 0 ]; then exit 1; fi

# Run skill enforcement
source "$SCRIPT_DIR/validators/skill-enforcement.sh" "$1"
if [ $? -ne 0 ]; then exit 1; fi

exit 0
```

## Customization

### Adding Custom Types

Edit the `pattern` variable in `conventional.sh`:

```bash
# Add 'wip' and 'hotfix' types
pattern="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|wip|hotfix)(\(.+\))?: .+"
```

### Requiring Scope

Modify the pattern to make scope required:

```bash
# Scope is now required
pattern="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)\(.+\): .+"
```

### Custom Footer Tags

For skill-enforcement, you can check for different tags:

```bash
# Check for your custom tag
if ! echo "$COMMIT_MSG" | grep -q "My-Footer-Tag:"; then
    # Block commit
    exit 1
fi
```

## Valid Commit Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting) |
| `refactor` | Code refactoring |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system changes |
| `ci` | CI/CD changes |
| `chore` | Other changes |
| `revert` | Revert previous commit |

## Bypassing (Emergency)

```bash
git commit --no-verify -m "emergency: Critical fix"
```