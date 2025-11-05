#!/bin/sh
# Basic pre-commit hook template
# Suitable for: Simple TypeScript/JavaScript projects
#
# Customize:
# - Replace npm commands with your package.json scripts
# - Add/remove checks based on your tooling

set -e

echo "=========================================="
echo "🎣 Git Hook: Pre-commit"
echo "=========================================="
echo ""

# Helper functions
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

# 1. Auto-fix code formatting
print_step "Auto-fixing code formatting..."
if npm run format; then
    print_success "Code formatting fixed and staged"
    git add -u
else
    print_error "Code formatting failed. Check the errors above."
fi

# 2. Auto-fix linting issues
print_step "Auto-fixing linting issues..."
if npm run lint; then
    print_success "Linting issues fixed and staged"
    git add -u
else
    print_error "Linting failed. Fix the issues above."
fi

# 3. Type check (if TypeScript)
print_step "Type checking..."
if npm run type-check; then
    print_success "Type checking passed"
else
    print_error "Type checking failed. Fix type errors above."
fi

echo "=========================================="
echo "✅ All pre-commit checks passed!"
echo "=========================================="
echo ""

exit 0