#!/bin/bash
#
# Pre-commit hook for simple TypeScript/JavaScript projects
#
# Checks:
# - Auto-fix code formatting (Prettier)
# - Auto-fix linting issues (ESLint)
# - Type checking (TypeScript)
#
# Installation:
#   1. Copy bundles/base/.githooks/ to your project
#   2. Copy this file to .githooks/pre-commit
#   3. chmod +x .githooks/pre-commit
#   4. git config core.hooksPath .githooks
#
# Customize:
#   - Replace npm commands with your package.json scripts
#   - Add/remove checks based on your tooling

set -e

# Script directory and shared lib
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"

# Source shared libraries
source "$LIB_DIR/colors.sh"
source "$LIB_DIR/output.sh"

print_header "Pre-commit Checks"

#############################################
# 1. Auto-fix code formatting
#############################################
print_step "1/3" "Auto-fixing code formatting..."

if npm run format 2>&1; then
    print_success_indent "Code formatting fixed"
    git add -u
else
    print_error_indent "Code formatting failed"
    echo -e "${YELLOW}Run 'npm run format' to see errors${NC}"
    exit 1
fi

echo ""

#############################################
# 2. Auto-fix linting issues
#############################################
print_step "2/3" "Auto-fixing linting issues..."

if npm run lint 2>&1; then
    print_success_indent "Linting passed"
    git add -u
else
    print_error_indent "Linting failed"
    echo -e "${YELLOW}Run 'npm run lint' to see errors${NC}"
    exit 1
fi

echo ""

#############################################
# 3. Type checking
#############################################
print_step "3/3" "Type checking..."

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