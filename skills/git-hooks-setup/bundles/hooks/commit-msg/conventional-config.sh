#!/bin/bash
#
# Commit-msg hook for Conventional Commits validation (Config-based)
#
# Reads allowed types and scopes from config file instead of hardcoding.
# Supports any language (Korean, English, etc.) based on config.
#
# Config file locations (checked in order):
#   1. .claude/config/conventional-commits/main.yaml (split config)
#   2. .claude/config/conventional-commits.yaml (single file)
#
# Installation:
#   1. Copy bundles/base/.githooks/ to your project
#   2. Copy this file to .githooks/commit-msg
#   3. chmod +x .githooks/commit-msg
#   4. git config core.hooksPath .githooks
#   5. Create config file with your types/scopes
#
# Config format (YAML):
#   types_quick:
#       feat: 'New feature'
#       fix: 'Bug fix'
#   scopes_quick:
#       frontend: 'Frontend code'
#       backend: 'Backend code'
#

set -e

# Script directory and shared lib
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"

# Source shared libraries (if available)
if [[ -f "$LIB_DIR/colors.sh" ]]; then
    source "$LIB_DIR/colors.sh"
    source "$LIB_DIR/output.sh"
    HAS_LIB=true
else
    # Fallback colors if lib not available
    RED='\033[0;31m'
    YELLOW='\033[1;33m'
    GREEN='\033[0;32m'
    BLUE='\033[0;34m'
    NC='\033[0m'
    HAS_LIB=false
fi

# Git passes the commit message file as first argument
COMMIT_MSG_FILE="$1"

# Validate that commit message file is provided and exists
if [[ -z "$COMMIT_MSG_FILE" ]]; then
    echo "Error: No commit message file provided"
    exit 1
fi

if [[ ! -f "$COMMIT_MSG_FILE" ]]; then
    echo "Error: Commit message file does not exist: $COMMIT_MSG_FILE"
    exit 1
fi

COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")
FIRST_LINE=$(echo "$COMMIT_MSG" | head -n1)

# Find git root
GIT_ROOT="$(git rev-parse --show-toplevel)"

# Config file locations (priority order)
CONFIG_SPLIT="${GIT_ROOT}/.claude/config/conventional-commits/main.yaml"
CONFIG_SINGLE="${GIT_ROOT}/.claude/config/conventional-commits.yaml"

# Determine which config file to use
if [[ -f "$CONFIG_SPLIT" ]]; then
    CONFIG_FILE="$CONFIG_SPLIT"
elif [[ -f "$CONFIG_SINGLE" ]]; then
    CONFIG_FILE="$CONFIG_SINGLE"
else
    CONFIG_FILE=""
fi

#############################################
# Helper: Print header
#############################################
print_header_msg() {
    if [[ "$HAS_LIB" == "true" ]]; then
        print_header "Commit Message Validation"
    else
        echo ""
        echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
        echo -e "${BLUE}  Commit Message Validation${NC}"
        echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    fi
}

#############################################
# Helper: Print success
#############################################
print_success_msg() {
    local type="$1"
    local scope="$2"
    if [[ "$HAS_LIB" == "true" ]]; then
        print_success_indent "Format valid: ${type}(${scope})"
        print_info "Message: ${FIRST_LINE}"
        print_success_banner "Commit message accepted"
    else
        echo -e "${GREEN}  ✓ Format valid: ${type}(${scope})${NC}"
        echo -e "${BLUE}Message: ${FIRST_LINE}${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  ✓ Commit message accepted${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    fi
}

#############################################
# Helper: Print error
#############################################
print_error_msg() {
    local types="$1"
    local scopes="$2"

    if [[ "$HAS_LIB" == "true" ]]; then
        print_error_indent "Invalid commit message format"
    else
        echo -e "${RED}  ✗ Invalid commit message format${NC}"
    fi

    echo ""
    echo -e "  ${YELLOW}Expected format:${NC} type(scope): subject"
    echo ""
    echo -e "  ${YELLOW}Allowed types:${NC}"
    echo "$types" | tr '|' '\n' | while read -r type; do
        [[ -n "$type" ]] && echo -e "    - $type"
    done
    echo ""
    echo -e "  ${YELLOW}Allowed scopes:${NC}"
    echo "$scopes" | tr '|' '\n' | while read -r scope; do
        [[ -n "$scope" ]] && echo -e "    - $scope"
    done
    echo ""
    echo -e "  ${YELLOW}Your message:${NC} $FIRST_LINE"
    echo ""

    if [[ "$HAS_LIB" == "true" ]]; then
        print_critical_banner "Commit rejected"
    else
        echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
        echo -e "${RED}  ✗ Commit rejected${NC}"
        echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
    fi
}

#############################################
# Main validation logic
#############################################
print_header_msg

# If no config file, skip validation with warning
if [[ -z "$CONFIG_FILE" ]]; then
    echo -e "${YELLOW}  ⚠ No config file found${NC}"
    echo -e "    Checked: .claude/config/conventional-commits/main.yaml"
    echo -e "    Checked: .claude/config/conventional-commits.yaml"
    echo ""
    echo -e "${GREEN}  ✓ Commit message accepted (no validation)${NC}"
    exit 0
fi

# Extract allowed types from config
# Parse types_quick section keys (supports Korean, English, any language)
ALLOWED_TYPES=$(awk '
    /^types_quick:/ { in_section=1; next }
    /^[^ #]/ && in_section { exit }
    in_section && /^    [^ ]+:/ {
        gsub(/^    /, "")
        gsub(/:.*/, "")
        print
    }
' "$CONFIG_FILE" | tr '\n' '|' | sed 's/|$//')

if [[ -z "$ALLOWED_TYPES" ]]; then
    echo -e "${YELLOW}  ⚠ Could not parse types from config${NC}"
    echo -e "${GREEN}  ✓ Commit message accepted (parse error)${NC}"
    exit 0
fi

# Extract allowed scopes from config
ALLOWED_SCOPES=$(awk '
    /^scopes_quick:/ { in_section=1; next }
    /^[^ #]/ && in_section { exit }
    in_section && /^    [^ ]+:/ {
        gsub(/^    /, "")
        gsub(/:.*/, "")
        print
    }
' "$CONFIG_FILE" | tr '\n' '|' | sed 's/|$//')

if [[ -z "$ALLOWED_SCOPES" ]]; then
    echo -e "${YELLOW}  ⚠ Could not parse scopes from config${NC}"
    echo -e "${GREEN}  ✓ Commit message accepted (parse error)${NC}"
    exit 0
fi

# Build regex pattern
# Format: type(scope): subject
COMMIT_REGEX="^(${ALLOWED_TYPES})\((${ALLOWED_SCOPES})\): .+"

# Validate commit message
if [[ ! "$FIRST_LINE" =~ $COMMIT_REGEX ]]; then
    print_error_msg "$ALLOWED_TYPES" "$ALLOWED_SCOPES"
    exit 1
fi

# Extract matched type and scope
MATCHED_TYPE="${BASH_REMATCH[1]}"
MATCHED_SCOPE="${BASH_REMATCH[2]}"

print_success_msg "$MATCHED_TYPE" "$MATCHED_SCOPE"
exit 0