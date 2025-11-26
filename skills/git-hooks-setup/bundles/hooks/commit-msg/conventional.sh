#!/bin/bash
#
# Commit-msg hook for Conventional Commits validation
#
# Validates commit message format:
# - type(scope): subject
# - feat(auth): Add OAuth2 support
#
# Installation:
#   1. Copy bundles/base/.githooks/ to your project
#   2. Copy this file to .githooks/commit-msg
#   3. chmod +x .githooks/commit-msg
#   4. git config core.hooksPath .githooks
#
# Customize:
#   - Adjust allowed types based on your conventions
#   - Add/remove scope validation

# Script directory and shared lib
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"

# Source shared libraries (if available)
if [[ -f "$LIB_DIR/colors.sh" ]]; then
    source "$LIB_DIR/colors.sh"
    source "$LIB_DIR/output.sh"
else
    # Fallback colors if lib not available
    RED='\033[0;31m'
    YELLOW='\033[1;33m'
    GREEN='\033[0;32m'
    NC='\033[0m'
fi

# Git passes the commit message file as first argument
COMMIT_MSG_FILE="$1"
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Extract first line (subject)
SUBJECT=$(echo "$COMMIT_MSG" | head -1)

# Conventional Commits pattern
# Format: type(scope): subject
# Examples:
#   feat(auth): Add OAuth2 support
#   fix: Handle null response
#   docs: Update README
pattern="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .+"

if ! echo "$SUBJECT" | grep -qE "$pattern"; then
    echo ""
    echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ✗ Invalid commit message format${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Your commit message:"
    echo -e "  ${YELLOW}$SUBJECT${NC}"
    echo ""
    echo "Expected format: type(scope): subject"
    echo ""
    echo "Valid types:"
    echo -e "  ${GREEN}feat${NC}:     New feature"
    echo -e "  ${GREEN}fix${NC}:      Bug fix"
    echo -e "  ${GREEN}docs${NC}:     Documentation changes"
    echo -e "  ${GREEN}style${NC}:    Code style changes (formatting)"
    echo -e "  ${GREEN}refactor${NC}: Code refactoring"
    echo -e "  ${GREEN}perf${NC}:     Performance improvement"
    echo -e "  ${GREEN}test${NC}:     Adding or updating tests"
    echo -e "  ${GREEN}build${NC}:    Build system changes"
    echo -e "  ${GREEN}ci${NC}:       CI/CD changes"
    echo -e "  ${GREEN}chore${NC}:    Other changes"
    echo -e "  ${GREEN}revert${NC}:   Revert previous commit"
    echo ""
    echo "Examples:"
    echo -e "  ${GREEN}feat(auth): Add OAuth2 login${NC}"
    echo -e "  ${GREEN}fix(api): Handle null response${NC}"
    echo -e "  ${GREEN}docs: Update README${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${YELLOW}Tip: Use --no-verify to skip (not recommended)${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    exit 1
fi

exit 0