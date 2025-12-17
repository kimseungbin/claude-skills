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

print_header "Pre-commit Checks"

# Save list of staged files to re-add after auto-fix
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR)

#############################################
# 1. Auto-fix code formatting
#############################################
print_step "1/4" "Auto-fixing code formatting..."

if npm run format 2>&1; then
    print_success_indent "Code formatting fixed"
    # Re-add only originally staged files
    echo "$STAGED_FILES" | xargs -r git add
else
    print_error_indent "Code formatting failed"
    echo -e "${YELLOW}Run 'npm run format' to see errors${NC}"
    exit 1
fi

echo ""

#############################################
# 2. Auto-fix linting issues
#############################################
print_step "2/4" "Auto-fixing linting issues..."

if npm run lint 2>&1; then
    print_success_indent "Linting passed"
    # Re-add only originally staged files
    echo "$STAGED_FILES" | xargs -r git add
else
    print_error_indent "Linting failed"
    echo -e "${YELLOW}Run 'npm run lint' to see errors${NC}"
    exit 1
fi

echo ""

#############################################
# 3. CSS linting (Stylelint)
#############################################
print_step "3/4" "Checking CSS with Stylelint..."

# Check if lint:css script exists
if npm run lint:css --if-present 2>&1; then
    print_success_indent "CSS linting passed"
else
    print_error_indent "CSS linting failed"
    echo -e "${YELLOW}Run 'npm run lint:css' to see errors${NC}"
    exit 1
fi

echo ""

#############################################
# 4. Type checking
#############################################
print_step "4/4" "Type checking..."

if npm run type-check 2>&1; then
    print_success_indent "Type checking passed"
else
    print_error_indent "Type checking failed"
    echo -e "${YELLOW}Run 'npm run type-check' to see errors${NC}"
    exit 1
fi

echo ""

#############################################
# Summary
#############################################
print_success_banner "All pre-commit checks passed"
echo ""

exit 0