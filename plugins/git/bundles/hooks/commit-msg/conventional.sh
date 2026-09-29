#!/bin/bash
# plugin_version: 1.0.26
#
# Commit-msg hook for Conventional Commits validation
#
# Validates the subject line: type(scope)!: subject
#   - type:  a key of types_quick, or the standard types when none are configured
#   - scope: optional; when scopes_quick lists scopes, it must be one of them
#   - !:     optional breaking-change marker
#
# Reads the commit skill's config, .claude/config/git/commit/main.yaml
# (written by Skill(git:commit-config)). Keys are read at the first indentation
# level under types_quick / scopes_quick, so any indent width and nested scope
# entries (description:, default_type:) both work.
#
# Git-generated subjects pass untouched: Merge ..., Revert "...",
# fixup! / squash! / amend!.
#
# Installation:
#   1. Copy bundles/base/.githooks/ to your project
#   2. Copy this file to .githooks/commit-msg
#   3. chmod +x .githooks/commit-msg
#   4. git config core.hooksPath .githooks
#
# Bypass (emergency only):
#   git commit --no-verify -m "emergency: Critical fix"

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

DEFAULT_TYPES="feat fix docs style refactor perf test build ci chore revert"

# Git passes the commit message file as first argument
COMMIT_MSG_FILE="$1"

# Subject is the first line that is neither blank nor a git comment
SUBJECT=$(grep -v -e '^#' -e '^[[:space:]]*$' "$COMMIT_MSG_FILE" | head -n1)

# Nothing to validate — git rejects empty messages itself
[[ -z "$SUBJECT" ]] && exit 0

# Git-generated subjects
GENERATED_RE='^(Merge |Revert "|fixup! |squash! |amend! )'
if [[ "$SUBJECT" =~ $GENERATED_RE ]]; then
    exit 0
fi

#############################################
# Load types and scopes from the commit config
#############################################
GIT_ROOT="$(git rev-parse --show-toplevel)"
CONFIG_FILE="$GIT_ROOT/.claude/config/git/commit/main.yaml"

# Print the keys at the first indentation level under a top-level YAML section
section_keys() {
    local section="$1"
    awk -v section="$section" -v q="'" '
        !in_section { if ($0 ~ "^" section ":") in_section = 1; next }
        /^[^[:space:]#]/ { exit }
        /^[[:space:]]*(#|$)/ { next }
        {
            match($0, /^[[:space:]]+/)
            if (indent == "") indent = RLENGTH
            if (RLENGTH != indent) next
            key = substr($0, RLENGTH + 1)
            sub(/:.*/, "", key)
            gsub(/"/, "", key)
            gsub(q, "", key)
            print key
        }
    ' "$CONFIG_FILE"
}

TYPES=""
SCOPES=""
if [[ -f "$CONFIG_FILE" ]]; then
    TYPES=$(section_keys types_quick)
    SCOPES=$(section_keys scopes_quick)
fi

TYPES_SOURCE="$CONFIG_FILE"
if [[ -z "$TYPES" ]]; then
    TYPES=$(tr ' ' '\n' <<< "$DEFAULT_TYPES")
    TYPES_SOURCE="standard Conventional Commits types"
fi

# Exact-match membership in a newline-separated list
in_list() {
    local needle="$1" item
    while IFS= read -r item; do
        [[ "$item" == "$needle" ]] && return 0
    done <<< "$2"
    return 1
}

#############################################
# Validate the subject
#############################################
# type, optional (scope), optional !, then ": " and a non-blank subject
SUBJECT_RE='^([^():! ]+)(\(([^()]+)\))?!?: [^ ]'

PROBLEM=""
if [[ ! "$SUBJECT" =~ $SUBJECT_RE ]]; then
    PROBLEM="Subject does not match type(scope): subject"
else
    MATCHED_TYPE="${BASH_REMATCH[1]}"
    MATCHED_SCOPE="${BASH_REMATCH[3]}"
    if ! in_list "$MATCHED_TYPE" "$TYPES"; then
        PROBLEM="Unknown type: $MATCHED_TYPE"
    elif [[ -n "$MATCHED_SCOPE" && -n "$SCOPES" ]] && ! in_list "$MATCHED_SCOPE" "$SCOPES"; then
        PROBLEM="Unknown scope: $MATCHED_SCOPE"
    fi
fi

[[ -z "$PROBLEM" ]] && exit 0

# Buffer output so the result appears on the first line
if type buffer_start &>/dev/null; then
    buffer_start
fi

echo ""
echo -e "  ${RED}${PROBLEM}${NC}"
echo ""
echo "Your commit message:"
echo -e "  ${YELLOW}${SUBJECT}${NC}"
echo ""
echo "Expected format: type(scope): subject   (scope and ! are optional)"
echo ""
echo "Allowed types (from $TYPES_SOURCE):"
while IFS= read -r t; do echo -e "  ${GREEN}${t}${NC}"; done <<< "$TYPES"
if [[ -n "$SCOPES" ]]; then
    echo ""
    echo "Allowed scopes (from $CONFIG_FILE):"
    while IFS= read -r s; do echo -e "  ${GREEN}${s}${NC}"; done <<< "$SCOPES"
fi
echo ""

if type buffer_end &>/dev/null; then
    buffer_end "${RED}✗ Commit REJECTED: invalid message format${NC}"
fi
exit 1
