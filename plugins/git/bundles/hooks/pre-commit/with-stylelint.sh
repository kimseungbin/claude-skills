#!/bin/bash
# plugin_version: 1.0.12
#
# Pre-commit hook with Stylelint for CSS validation
#
# Checks:
# - Auto-fix code formatting (Prettier) — staged files only
# - Auto-fix linting issues (ESLint) — staged files only
# - CSS linting (Stylelint) — staged files only
# - Type checking (TypeScript)
#
# Installation:
#   1. Copy bundles/base/.githooks/ to your project
#   2. Copy this file to .githooks/pre-commit
#   3. chmod +x .githooks/pre-commit
#   4. git config core.hooksPath .githooks
#
# Customize:
#   - Adjust PRETTIER_EXTS / LINT_EXTS / CSS_EXTS for your file types
#   - type-check: tsc --noEmit

set -e

# Script directory and shared lib
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"

# Source shared libraries
source "$LIB_DIR/colors.sh"
source "$LIB_DIR/output.sh"

# Buffer output so the result appears on the first line
buffer_start
steps_init 4

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
# 4. Type checking
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