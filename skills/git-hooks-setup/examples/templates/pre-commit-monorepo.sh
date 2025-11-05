#!/bin/sh
# Pre-commit hook template for monorepo projects
# Suitable for: npm/pnpm/yarn workspaces, Lerna, Nx monorepos
#
# Customize:
# - Adjust workspace commands for your package manager
# - Modify package paths (packages/, apps/, libs/, etc.)
# - Add/remove workspace-specific checks

set -e

echo "=========================================="
echo "🎣 Git Hook: Pre-commit (Monorepo)"
echo "=========================================="
echo ""

print_step() {
    echo "▶ $1"
    echo "------------------------------------------"
}

print_success() {
    echo "✅ $1"
    echo ""
}

print_error() {
    echo ""
    echo "❌ $1"
    echo "=========================================="
    echo "💡 Tip: Fix the issues above and try again"
    echo "   Or use --no-verify to skip hooks (not recommended)"
    echo "=========================================="
    exit 1
}

# 1. Clean build artifacts
print_step "Cleaning build artifacts..."
find packages/ -type f \( -name "*.js" -o -name "*.d.ts" -o -name "*.js.map" \) \
    ! -name "jest.config.js" \
    ! -name ".eslintrc.js" \
    -delete 2>/dev/null || true
print_success "Cleaned existing artifacts"

# 2. Auto-fix formatting
print_step "Auto-fixing code formatting..."
if npm run format; then
    print_success "Code formatting fixed and staged"
    git add -u
else
    print_error "Code formatting failed. Check the errors above."
fi

# 3. Auto-fix linting
print_step "Auto-fixing linting issues..."
if npm run lint; then
    print_success "Linting issues fixed and staged"
    git add -u
else
    print_error "Linting failed. Fix the issues above."
fi

# 4. Type check all workspaces
print_step "Type checking all workspaces..."
if npm run type-check; then
    print_success "Type checking passed"
else
    print_error "Type checking failed. Fix type errors above."
fi

# 5. Build all packages
print_step "Building all packages..."
if npm run build; then
    print_success "Build successful"
else
    print_error "Build failed. Fix compilation errors above."
fi

# 6. Clean build artifacts after validation
print_step "Cleaning build artifacts..."
find packages/ -type f \( -name "*.js" -o -name "*.d.ts" -o -name "*.js.map" \) \
    ! -name "jest.config.js" \
    ! -name ".eslintrc.js" \
    -delete 2>/dev/null || true
print_success "Build artifacts cleaned"

echo "=========================================="
echo "✅ All pre-commit checks passed!"
echo "=========================================="
echo "💡 Remember: Run tests before pushing"
echo "=========================================="
echo ""

exit 0