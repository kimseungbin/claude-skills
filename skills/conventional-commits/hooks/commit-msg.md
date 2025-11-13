# Commit Message Validation (commit-msg hook)

This document explains how to enforce conventional-commits skill usage using a git commit-msg hook. Read this file when:
- Setting up commit validation for a new project
- Commit-msg hook is rejecting commits and you need to understand validation rules
- Troubleshooting commit format issues

## Overview

Projects can enforce that all commits are created using the conventional-commits skill (instead of direct `git commit` commands) by adding a footer tag and validating it with a git hook.

## Footer Tag Pattern

Add to your project's `.claude/config/conventional-commits.yaml`:

```yaml
conventions:
  footer:
    - "REQUIRED: Always add 'Skill: conventional-commits' to mark skill usage"
    - "This footer tag is validated by commit-msg hook"
```

Update all examples to include the footer:

```yaml
examples:
  example_commit:
    message: "feat(scope): Add feature"
    body: |
      Feature description.

      - Change 1
      - Change 2

      Skill: conventional-commits  # Footer tag
```

## Git Hook Implementation

Create `.git/hooks/commit-msg` to validate the footer tag:

```bash
#!/bin/bash

# Commit-msg hook - Enforce conventional-commits skill usage
COMMIT_MSG_FILE="$1"
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

if ! echo "$COMMIT_MSG" | grep -q "Skill: conventional-commits"; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ COMMIT BLOCKED"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "This commit was not created using the conventional-commits skill."
    echo ""
    echo "Required footer tag missing: 'Skill: conventional-commits'"
    echo ""
    echo "┌─────────────────────────────────────────────────────┐"
    echo "│  HOW TO FIX:                                        │"
    echo "├─────────────────────────────────────────────────────┤"
    echo "│  ✅ Use: Skill(conventional-commits)                │"
    echo "│  ✅ Use: SlashCommand(/commit)                      │"
    echo "│  ❌ DO NOT use: git commit directly                 │"
    echo "└─────────────────────────────────────────────────────┘"
    echo ""
    exit 1
fi

exit 0
```

Make it executable:

```bash
chmod +x .git/hooks/commit-msg
```

## Validation Rules

The commit-msg hook validates:

1. **Footer tag presence**: Checks if commit message contains `Skill: conventional-commits`
2. **Format enforcement**: Ensures the footer is in the commit message body

### Valid Commit Example

```
feat(auth): Add OAuth2 integration

Implement OAuth2 authentication flow with Google provider.
Support refresh tokens and token expiration handling.

Skill: conventional-commits
```

### Invalid Commit (Missing Footer)

```
feat(auth): Add OAuth2 integration

Implement OAuth2 authentication flow with Google provider.
```

**Result**: Commit is BLOCKED with error message

## Benefits

- **Consistency**: All commits follow the skill's workflow and format
- **Quality**: Prevents accidental direct commits bypassing skill validation
- **Team Alignment**: Everyone uses the same commit creation process
- **Automation**: CI/CD can rely on consistent commit format
- **Audit Trail**: Footer provides proof that skill was used

## Bypassing (Emergency Only)

```bash
# Emergency hotfix - skip hook validation
git commit --no-verify -m "emergency: Critical fix"
```

**When to bypass:**
- Production incident requiring immediate hotfix
- Git hook system is broken and needs to be fixed
- You are 100% confident in your commit message format

**Important**: Document why bypass was necessary in the commit message.

## Troubleshooting

### Hook doesn't run

**Problem**: Commits succeed without validation

**Cause**: Hook not installed or not executable

**Solution**:
```bash
# Verify hook exists
ls -la .git/hooks/commit-msg

# Make executable if needed
chmod +x .git/hooks/commit-msg

# Test hook manually
.git/hooks/commit-msg .git/COMMIT_EDITMSG
```

### Hook rejects valid commits

**Problem**: Hook blocks commits created by the skill

**Cause**: Footer format mismatch or whitespace issues

**Solution**:
```bash
# Check exact commit message format
git log -1 --pretty=%B

# Ensure footer matches exactly: "Skill: conventional-commits"
# No extra spaces, correct capitalization
```

### Hook location in managed git hooks directory

Some projects use `.githooks/` directory instead of `.git/hooks/`.

**Configure git to use custom hooks directory**:
```bash
git config core.hooksPath .githooks
```

Then place the commit-msg script in `.githooks/commit-msg`.

## Integration with Pre-Push Hook

This commit-msg hook works alongside pre-push hooks for deployment safety:

- **commit-msg hook**: Validates commit format and skill usage (this file)
- **pre-push hook**: Validates deployment safety (see [pre-push.md](pre-push.md))

Both hooks can coexist and serve different purposes:
- commit-msg: Ensures quality at commit time
- pre-push: Ensures safety at deployment time

## Project-Specific Customization

### Custom Footer Tags

Projects can require additional footer tags:

```bash
# Check for multiple footers
if ! echo "$COMMIT_MSG" | grep -q "Skill: conventional-commits"; then
    echo "Missing: Skill: conventional-commits"
    exit 1
fi

if ! echo "$COMMIT_MSG" | grep -q "Reviewed-By:"; then
    echo "Missing: Reviewed-By: <name>"
    exit 1
fi
```

### Conventional Commit Format Validation

Extend the hook to validate conventional commit format:

```bash
# Validate conventional commit format
FIRST_LINE=$(echo "$COMMIT_MSG" | head -n 1)

if ! echo "$FIRST_LINE" | grep -qE "^(feat|fix|docs|style|refactor|test|chore|ci|build)(\(.+\))?: .+"; then
    echo "❌ Commit message doesn't follow conventional commits format"
    echo "Expected: type(scope): subject"
    exit 1
fi
```

### Subject Line Length

Validate subject line length (≤72 characters):

```bash
FIRST_LINE=$(echo "$COMMIT_MSG" | head -n 1)
LENGTH=${#FIRST_LINE}

if [ $LENGTH -gt 72 ]; then
    echo "❌ Subject line too long: $LENGTH characters (max 72)"
    exit 1
fi
```

## Related Documentation

- **SKILL.md**: Main skill instructions for commit generation
- **pre-push.md**: Deployment safety validation hook
- **infrastructure.md**: Infrastructure-specific commit conventions
- Project-specific: `.claude/config/conventional-commits.yaml`
- Project documentation: `docs/GIT_HOOKS_SETUP.md` (if exists)

## Summary

The commit-msg hook ensures:
1. All commits created via conventional-commits skill
2. Consistent commit format across the team
3. Audit trail via footer tags
4. Quality gate before commits enter git history

Use this hook to enforce team conventions and maintain high commit quality standards.