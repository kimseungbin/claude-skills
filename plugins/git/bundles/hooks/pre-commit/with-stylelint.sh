#!/bin/bash
# plugin_version: 1.0.27
#
# Pre-commit hook with Stylelint for CSS validation
#
# Checks:
# - Auto-fix code formatting (Prettier) — staged files only
# - Auto-fix linting issues (ESLint) — staged files only
# - CSS linting (Stylelint) — staged files only
# - Design-token contrast against WCAG (scripts/check-contrast.ts) — runs only
#   when a configured token file is staged
# - Type checking (TypeScript)
#
# Installation:
#   1. Copy bundles/base/.githooks/ to your project
#   2. Copy this file to .githooks/pre-commit
#   3. chmod +x .githooks/pre-commit
#   4. git config core.hooksPath .githooks
#   5. Point .githooks/scripts/contrast-limits.yaml at your token file
#
# Customize:
#   - Adjust PRETTIER_EXTS / LINT_EXTS / CSS_EXTS for your file types
#   - type-check: tsc --noEmit
#   - contrast thresholds and token paths: scripts/contrast-limits.yaml

set -e

# Script directory and shared lib
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"

# Source shared libraries
source "$LIB_DIR/colors.sh"
source "$LIB_DIR/output.sh"

# Buffer output so the result appears on the first line
buffer_start
steps_init 5

# Save list of staged files to re-add after auto-fix
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR)

# Track whether any auto-fix step modified files
_AUTO_FIXED=false

# File extensions for each tool (customize for your project)
PRETTIER_EXTS="ts tsx js jsx json css scss md html yaml yml svelte vue"
LINT_EXTS="ts tsx js jsx svelte vue"
CSS_EXTS="css scss"

# Filter staged files by extensions
filter_by_ext() {
    local exts="$1"
    echo "$STAGED_FILES" | while IFS= read -r f; do
        [ -z "$f" ] && continue
        local ext="${f##*.}"
        for e in $exts; do
            if [ "$ext" = "$e" ]; then
                echo "$f"
                break
            fi
        done
    done
}

STAGED_FORMAT_FILES=$(filter_by_ext "$PRETTIER_EXTS")
STAGED_LINT_FILES=$(filter_by_ext "$LINT_EXTS")
STAGED_CSS_FILES=$(filter_by_ext "$CSS_EXTS")

#############################################
# 1. Auto-fix code formatting
#############################################
print_step "Auto-fixing code formatting..."

if [ -z "$STAGED_FORMAT_FILES" ]; then
    print_success_indent "No formattable files staged, skipping"
else
    if echo "$STAGED_FORMAT_FILES" | xargs npx prettier --write 2>&1; then
        # Re-stage files modified by formatting
        CHANGED_BY_FORMAT=$(echo "$STAGED_FORMAT_FILES" | while IFS= read -r f; do
            [ -n "$f" ] && git diff --quiet -- "$f" 2>/dev/null || echo "$f"
        done)
        if [ -z "$CHANGED_BY_FORMAT" ]; then
            print_success_indent "Formatting passed"
        else
            _AUTO_FIXED=true
            echo "$CHANGED_BY_FORMAT" | while IFS= read -r f; do
                [ -n "$f" ] && git add -- "$f"
            done
            print_success_indent "Formatting auto-fixed and re-staged"
        fi
    else
        print_error_indent "Code formatting failed"
        echo -e "${YELLOW}Run 'npx prettier --check <file>' to see errors${NC}"
        buffer_end "${RED}${SYM_CROSS} Pre-commit FAILED: code formatting${NC}"
        exit 1
    fi
fi

echo ""

#############################################
# 2. Auto-fix linting issues
#############################################
print_step "Auto-fixing linting issues..."

if [ -z "$STAGED_LINT_FILES" ]; then
    print_success_indent "No lintable files staged, skipping"
else
    if echo "$STAGED_LINT_FILES" | xargs npx eslint --fix 2>&1; then
        # Re-stage files modified by linting
        CHANGED_BY_LINT=$(echo "$STAGED_LINT_FILES" | while IFS= read -r f; do
            [ -n "$f" ] && git diff --quiet -- "$f" 2>/dev/null || echo "$f"
        done)
        if [ -z "$CHANGED_BY_LINT" ]; then
            print_success_indent "Linting passed"
        else
            _AUTO_FIXED=true
            echo "$CHANGED_BY_LINT" | while IFS= read -r f; do
                [ -n "$f" ] && git add -- "$f"
            done
            print_success_indent "Linting auto-fixed and re-staged"
        fi
    else
        print_error_indent "Linting failed"
        echo -e "${YELLOW}Run 'npx eslint <file>' to see errors${NC}"
        buffer_end "${RED}${SYM_CROSS} Pre-commit FAILED: linting${NC}"
        exit 1
    fi
fi

echo ""

#############################################
# 3. CSS linting (Stylelint)
#############################################
print_step "Checking CSS with Stylelint..."

if [ -z "$STAGED_CSS_FILES" ]; then
    print_success_indent "No CSS files staged, skipping"
else
    if echo "$STAGED_CSS_FILES" | xargs npx stylelint 2>&1; then
        print_success_indent "CSS linting passed"
    else
        print_error_indent "CSS linting failed"
        echo -e "${YELLOW}Run 'npx stylelint <file>' to see errors${NC}"
        buffer_end "${RED}${SYM_CROSS} Pre-commit FAILED: CSS linting${NC}"
        exit 1
    fi
fi

echo ""

#############################################
# 4. Design-token contrast (WCAG)
#############################################
print_step "Checking design-token contrast..."

CONTRAST_SCRIPT="$SCRIPT_DIR/scripts/check-contrast.ts"

# The validator strips its own TypeScript types, which Node does natively from
# 22.18 and 23.6. On an older runtime it fails as a syntax error, so check the
# version first and say why rather than letting that surface as a parse dump.
node_strips_types() {
    local version major minor
    version=$(node -v 2>/dev/null) || return 1
    version="${version#v}"
    major="${version%%.*}"
    minor="${version#*.}"
    minor="${minor%%.*}"
    [ "$major" -ge 24 ] && return 0
    [ "$major" -eq 23 ] && [ "$minor" -ge 6 ] && return 0
    [ "$major" -eq 22 ] && [ "$minor" -ge 18 ] && return 0
    return 1
}

if [ ! -f "$CONTRAST_SCRIPT" ]; then
    print_success_indent "Contrast validator not installed, skipping"
elif ! node_strips_types; then
    print_error_indent "Node $(node -v 2>/dev/null || echo '(not found)') cannot run the contrast validator"
    echo -e "${YELLOW}check-contrast.ts needs Node >=22.18 or >=23.6 for native TypeScript${NC}"
    buffer_end "${RED}${SYM_CROSS} Pre-commit FAILED: contrast (Node too old)${NC}"
    exit 1
else
    # --staged makes the validator itself decide whether any configured token
    # file is in this commit, so the token path lives in one place: its config.
    if node "$CONTRAST_SCRIPT" --staged; then
        print_success_indent "Contrast check passed"
    else
        print_error_indent "Contrast check failed"
        echo -e "${YELLOW}Run 'node .githooks/scripts/check-contrast.ts' to see failing pairs${NC}"
        buffer_end "${RED}${SYM_CROSS} Pre-commit FAILED: token contrast${NC}"
        exit 1
    fi
fi

echo ""

#############################################
# 5. Type checking
#############################################
print_step "Type checking..."

if npm run type-check 2>&1; then
    print_success_indent "Type checking passed"
else
    print_error_indent "Type checking failed"
    echo -e "${YELLOW}Run 'npm run type-check' to see errors${NC}"
    buffer_end "${RED}${SYM_CROSS} Pre-commit FAILED: type checking${NC}"
    exit 1
fi

echo ""

if [ "$_AUTO_FIXED" = true ]; then
    buffer_end "${GREEN}${SYM_CHECK} All pre-commit checks passed${NC}\n  Auto-fixed and re-staged"
else
    buffer_end "${GREEN}${SYM_CHECK} All pre-commit checks passed${NC}"
fi
exit 0