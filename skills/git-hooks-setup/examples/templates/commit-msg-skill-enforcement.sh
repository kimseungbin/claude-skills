#!/bin/bash

# commit-msg hook - Enforce conventional-commits skill usage
#
# PURPOSE: Validate that commits are created via the conventional-commits skill
# TRIGGER: After commit message is written, before commit is finalized
# USE CASE: Ensure all commits follow project's conventional commit standards
#
# INTEGRATION:
# 1. Add footer requirement to .claude/config/conventional-commits.yaml:
#
#    conventions:
#      footer:
#        - "REQUIRED: Always add 'Skill: conventional-commits' to mark skill usage"
#
# 2. Update examples to include footer:
#
#    examples:
#      example_commit:
#        body: |
#          Changes description.
#
#          Skill: conventional-commits
#
# 3. Install this hook:
#    - Copy to .git/hooks/commit-msg
#    - Make executable: chmod +x .git/hooks/commit-msg
#
# TESTING:
# - Valid: git commit -m "feat: Add feature\n\nSkill: conventional-commits"  ✅
# - Invalid: git commit -m "feat: Add feature"  ❌ Blocked
#
# BYPASS (Emergency only):
# git commit --no-verify -m "emergency: Critical fix"

# Git passes the commit message file as first argument
COMMIT_MSG_FILE="$1"

# Read the commit message
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Check if commit message has the skill marker
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
    echo "The skill ensures:"
    echo "  • Proper conventional commit format (type(scope): subject)"
    echo "  • Intelligent multi-commit splitting"
    echo "  • Follows project-specific rules"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    exit 1
fi

# All checks passed
exit 0
