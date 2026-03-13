#!/bin/bash
#
# Pre-commit hook with Stylelint for CSS validation
#
# Checks:
# - Auto-fix code formatting (Prettier)
# - Auto-fix linting issues (ESLint)
# - CSS linting (Stylelint)
# - Type checking (TypeScript)
#
# Installation:
#   1. Copy bundles/base/.githooks/ to your project
#   2. Copy this file to .githooks/pre-commit
#   3. chmod +x .githooks/pre-commit
#   4. git config core.hooksPath .githooks
#
# Required npm scripts:
#   - format: prettier --write .
#   - lint: eslint --fix .
#   - lint:css: stylelint 'src/**/*.css' (adjust path as needed)
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

#############################################
# 1. Auto-fix code formatting
#############################################
print_step "Auto-fixing code formatting..."

if npm run format 2>&1; then
    # Re-stage only originally staged files that were modified by formatting
    CHANGED_BY_FORMAT=$(echo "$STAGED_FILES" | while IFS= read -r f; do
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
    echo -e "${YELLOW}Run 'npm run format' to see errors${NC}"
    buffer_end "${RED}${SYM_CROSS} Pre-commit FAILED: code formatting${NC}"
    exit 1
fi

echo ""

#############################################
# 2. Auto-fix linting issues
#############################################
print_step "Auto-fixing linting issues..."

if npm run lint 2>&1; then
    # Re-stage only originally staged files that were modified by linting
    CHANGED_BY_LINT=$(echo "$STAGED_FILES" | while IFS= read -r f; do
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
    echo -e "${YELLOW}Run 'npm run lint' to see errors${NC}"
    buffer_end "${RED}${SYM_CROSS} Pre-commit FAILED: linting${NC}"
    exit 1
fi

echo ""

#############################################
# 3. CSS linting (Stylelint)
#############################################
print_step "Checking CSS with Stylelint..."

# Check if lint:css script exists
if npm run lint:css --if-present 2>&1; then
    print_success_indent "CSS linting passed"
else
    print_error_indent "CSS linting failed"
    echo -e "${YELLOW}Run 'npm run lint:css' to see errors${NC}"
    buffer_end "${RED}${SYM_CROSS} Pre-commit FAILED: CSS linting${NC}"
    exit 1
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