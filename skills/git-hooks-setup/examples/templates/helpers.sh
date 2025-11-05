#!/bin/sh
# Common helper functions for git hooks
# Source this file in your hooks: . "$(dirname "$0")/helpers.sh"

# Print a step header
print_step() {
    echo "▶ $1"
    echo "------------------------------------------"
}

# Print success message
print_success() {
    echo "✅ $1"
    echo ""
}

# Print error message and exit
print_error() {
    echo ""
    echo "❌ $1"
    echo "=========================================="
    echo "💡 Tip: Fix the issues above and try again"
    echo "   Or use --no-verify to skip hooks (not recommended)"
    echo "=========================================="
    exit 1
}

# Print hook header
print_header() {
    echo "=========================================="
    echo "🎣 Git Hook: $1"
    echo "=========================================="
    echo ""
}

# Print hook footer
print_footer() {
    echo "=========================================="
    echo "✅ All checks passed!"
    echo "=========================================="
    echo ""
}