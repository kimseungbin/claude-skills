#!/bin/bash
#
# Pre-commit hook for monorepo projects
#
# Suitable for: npm/pnpm/yarn workspaces, Lerna, Nx monorepos
#
# Checks:
# - Clean build artifacts
# - Auto-fix formatting
# - Auto-fix linting
# - Type check all workspaces
# - Build all packages
# - Clean artifacts after validation
#
# Installation:
#   1. Copy bundles/base/.githooks/ to your project
#   2. Copy this file to .githooks/pre-commit
#   3. chmod +x .githooks/pre-commit
#   4. git config core.hooksPath .githooks
#
# Customize:
#   - Adjust PACKAGES_DIR for your monorepo structure
#   - Modify workspace commands for your package manager

set -e

# Script directory and shared lib
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"

# Source shared libraries
source "$LIB_DIR/colors.sh"
source "$LIB_DIR/output.sh"

print_header "Pre-commit Checks (Monorepo)"

# Customize this for your monorepo structure
PACKAGES_DIR="packages"

#############################################
# 1. Clean build artifacts
#############################################
print_step "1/6" "Cleaning build artifacts..."

if [[ -d "$PACKAGES_DIR" ]]; then
    find "$PACKAGES_DIR" -type f \( -name "*.js" -o -name "*.d.ts" -o -name "*.js.map" \) \
        ! -name "jest.config.js" \
        ! -name ".eslintrc.js" \
        -delete 2>/dev/null || true
    print_success_indent "Cleaned existing artifacts"
else
    print_warning_indent "Packages directory not found: $PACKAGES_DIR"
fi

echo ""

#############################################
# 2. Auto-fix formatting
#############################################
print_step "2/6" "Auto-fixing code formatting..."

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
# 3. Auto-fix linting
#############################################
print_step "3/6" "Auto-fixing linting issues..."

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
# 4. Type check all workspaces
#############################################
print_step "4/6" "Type checking all workspaces..."

if npm run type-check 2>&1; then
    print_success_indent "Type checking passed"
else
    print_error_indent "Type checking failed"
    echo -e "${YELLOW}Run 'npm run type-check' to see errors${NC}"
    exit 1
fi

echo ""

#############################################
# 5. Build all packages
#############################################
print_step "5/6" "Building all packages..."

if npm run build 2>&1; then
    print_success_indent "Build successful"
else
    print_error_indent "Build failed"
    echo -e "${YELLOW}Run 'npm run build' to see errors${NC}"
    exit 1
fi

echo ""

#############################################
# 6. Clean build artifacts after validation
#############################################
print_step "6/6" "Cleaning build artifacts..."

if [[ -d "$PACKAGES_DIR" ]]; then
    find "$PACKAGES_DIR" -type f \( -name "*.js" -o -name "*.d.ts" -o -name "*.js.map" \) \
        ! -name "jest.config.js" \
        ! -name ".eslintrc.js" \
        -delete 2>/dev/null || true
    print_success_indent "Build artifacts cleaned"
fi

echo ""

#############################################
# Summary
#############################################
print_success_banner "All pre-commit checks passed"
echo ""
echo -e "${DIM}Remember: Run tests before pushing${NC}"
echo ""

exit 0