#!/bin/bash
#
# Commit-msg hook to enforce commit-expert agent usage
#
# PURPOSE: Validate that commits are created via Claude's commit-expert agent
# USE CASE: Teams using Claude Code who want to ensure consistent commit quality
#
# Installation:
#   1. Copy bundles/base/.githooks/ to your project
#   2. Copy this file to .githooks/commit-msg
#   3. chmod +x .githooks/commit-msg
#   4. git config core.hooksPath .githooks
#
# INTEGRATION:
#   1. Add footer requirement to .claude/config/commit-expert/main.yaml:
#
#      conventions:
#        footer:
#          - "REQUIRED: Always add 'Agent: commit-expert' to mark agent usage"
#
# Bypass (emergency only):
#   git commit --no-verify -m "emergency: Critical fix"

# Script directory and shared lib
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"

# Source shared libraries
if [[ -f "$LIB_DIR/colors.sh" ]]; then
    source "$LIB_DIR/colors.sh"
    source "$LIB_DIR/output.sh"
else
    # Fallback if lib not available
    RED='\033[0;31m'
    YELLOW='\033[1;33m'
    GREEN='\033[0;32m'
    NC='\033[0m'
    SYM_CHECK="✓"
    SYM_CROSS="✗"
fi

# Git passes the commit message file as first argument
COMMIT_MSG_FILE="$1"

# Read the commit message
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Check if commit message has the agent marker
if ! echo "$COMMIT_MSG" | grep -q "Agent: commit-expert"; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${RED}${SYM_CROSS:-✗} COMMIT BLOCKED${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "This commit was not created using the commit-expert agent."
    echo ""
    echo "Required footer tag missing: 'Agent: commit-expert'"
    echo ""
    echo "┌─────────────────────────────────────────────────────┐"
    echo "│  HOW TO FIX:                                        │"
    echo "├─────────────────────────────────────────────────────┤"
    echo "│  ${SYM_CHECK:-✓} Use: Task(subagent_type=\"commit-expert\")        │"
    echo "│  ${SYM_CROSS:-✗} DO NOT use: git commit directly                 │"
    echo "└─────────────────────────────────────────────────────┘"
    echo ""
    echo "The agent ensures:"
    echo "  - Proper conventional commit format (type(scope): subject)"
    echo "  - Intelligent multi-commit splitting"
    echo "  - Follows project-specific rules"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    exit 1
fi

# All checks passed
exit 0