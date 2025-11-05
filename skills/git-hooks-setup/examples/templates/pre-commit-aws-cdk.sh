#!/bin/sh
# Pre-commit hook template for AWS CDK projects
# Suitable for: Infrastructure-as-code projects using AWS CDK
#
# Customize:
# - Adjust artifact paths for your project structure
# - Modify synth command if using different CDK commands

set -e

echo "=========================================="
echo "🎣 Git Hook: Pre-commit (AWS CDK)"
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

# 1. Clean existing build artifacts
print_step "Cleaning existing build artifacts..."
find . -type f \( -name "*.js" -o -name "*.d.ts" -o -name "*.js.map" \) \
    ! -path "*/node_modules/*" \
    ! -name "jest.config.js" \
    ! -name ".eslintrc.js" \
    -delete 2>/dev/null || true
rm -rf cdk.out/ 2>/dev/null || true
print_success "Cleaned existing artifacts"

# 2. Linting
print_step "Running linter..."
if npm run lint:check; then
    print_success "Linting passed"
else
    print_error "Linting failed. Fix the issues above."
fi

# 3. CDK synthesis validation
print_step "Validating CDK synthesis..."
if npm run cdk synth --quiet; then
    print_success "CDK synthesis successful"
else
    print_error "CDK synthesis failed. Fix CloudFormation errors above."
fi

# 4. Clean CDK output
print_step "Cleaning CDK output..."
rm -rf cdk.out/
print_success "CDK output cleaned"

echo "=========================================="
echo "✅ All pre-commit checks passed!"
echo "=========================================="
echo ""

exit 0