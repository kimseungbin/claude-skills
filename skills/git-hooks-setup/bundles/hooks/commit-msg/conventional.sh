#!/bin/bash
#
# Commit-msg hook for Conventional Commits validation
#
# Validates commit message format:
# - type(scope): subject
# - feat(auth): Add OAuth2 support
#
# Features:
# - Auto-detects types from conventional-commits skill config
# - Falls back to standard Conventional Commits types
# - Supports custom types (Korean, etc.)
#
# Installation:
#   1. Copy bundles/base/.githooks/ to your project
#   2. Copy this file to .githooks/commit-msg
#   3. chmod +x .githooks/commit-msg
#   4. git config core.hooksPath .githooks
#

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

#############################################
# Load types from conventional-commits config
#############################################
TYPES=""
TYPES_WITH_DESC=""
CONFIG_FOUND=false

# Check for split config pattern first
if [[ -f ".claude/config/conventional-commits/main.yaml" ]]; then
    CONFIG_FILE=".claude/config/conventional-commits/main.yaml"
    CONFIG_FOUND=true
# Check for single file pattern
elif [[ -f ".claude/config/conventional-commits.yaml" ]]; then
    CONFIG_FILE=".claude/config/conventional-commits.yaml"
    CONFIG_FOUND=true
fi

if [[ "$CONFIG_FOUND" == true ]]; then
    # Extract types from types_quick section
    # Format in YAML:
    #   types_quick:
    #       기능: '새로운 기능 추가'
    #       수정: '버그 수정'
    IN_TYPES_QUICK=false
    while IFS= read -r line; do
        # Check if we're entering types_quick section
        if [[ "$line" =~ ^types_quick: ]]; then
            IN_TYPES_QUICK=true
            continue
        fi

        # Check if we've left the types_quick section (new section starts)
        if [[ "$IN_TYPES_QUICK" == true && "$line" =~ ^[a-z_]+: && ! "$line" =~ ^[[:space:]] ]]; then
            break
        fi

        # Parse type entries (indented lines with colon)
        if [[ "$IN_TYPES_QUICK" == true && "$line" =~ ^[[:space:]]+([^:]+):[[:space:]]*[\'\"]?([^\'\"]+) ]]; then
            type_name="${BASH_REMATCH[1]}"
            type_desc="${BASH_REMATCH[2]}"
            # Trim whitespace
            type_name=$(echo "$type_name" | xargs)
            type_desc=$(echo "$type_desc" | sed "s/['\"]//g" | xargs)

            if [[ -n "$TYPES" ]]; then
                TYPES="$TYPES|$type_name"
            else
                TYPES="$type_name"
            fi
            TYPES_WITH_DESC="$TYPES_WITH_DESC  ${GREEN}${type_name}${NC}: $type_desc\n"
        fi
    done < "$CONFIG_FILE"
fi

# Fallback to default Conventional Commits types
if [[ -z "$TYPES" ]]; then
    TYPES="feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert"
    TYPES_WITH_DESC="  ${GREEN}feat${NC}:     New feature
  ${GREEN}fix${NC}:      Bug fix
  ${GREEN}docs${NC}:     Documentation changes
  ${GREEN}style${NC}:    Code style changes (formatting)
  ${GREEN}refactor${NC}: Code refactoring
  ${GREEN}perf${NC}:     Performance improvement
  ${GREEN}test${NC}:     Adding or updating tests
  ${GREEN}build${NC}:    Build system changes
  ${GREEN}ci${NC}:       CI/CD changes
  ${GREEN}chore${NC}:    Other changes
  ${GREEN}revert${NC}:   Revert previous commit"
fi

# Build the pattern
# Format: type(scope): subject
pattern="^($TYPES)(\(.+\))?: .+"

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
    echo -e "$TYPES_WITH_DESC"
    echo ""
    if [[ "$CONFIG_FOUND" == true ]]; then
        echo -e "${GREEN}(Types loaded from: $CONFIG_FILE)${NC}"
        echo ""
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${YELLOW}Tip: Use --no-verify to skip (not recommended)${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    exit 1
fi

exit 0