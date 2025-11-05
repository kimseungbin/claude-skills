#!/bin/sh
# Commit-msg hook template for Conventional Commits validation
# Suitable for: Projects following Conventional Commits specification
#
# Customize:
# - Adjust allowed types based on your conventions
# - Add/remove scope validation
# - Modify regex pattern for your commit format

set -e

commit_msg_file="$1"
commit_msg=$(cat "$commit_msg_file")

# Conventional Commits pattern
# Format: type(scope): subject
# Example: feat(auth): Add OAuth2 support
pattern="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .+"

if ! echo "$commit_msg" | grep -qE "$pattern"; then
    echo ""
    echo "=========================================="
    echo "❌ Invalid commit message format"
    echo "=========================================="
    echo ""
    echo "Your commit message:"
    echo "  $commit_msg"
    echo ""
    echo "Expected format: type(scope): subject"
    echo ""
    echo "Valid types:"
    echo "  feat:     New feature"
    echo "  fix:      Bug fix"
    echo "  docs:     Documentation changes"
    echo "  style:    Code style changes (formatting)"
    echo "  refactor: Code refactoring"
    echo "  perf:     Performance improvement"
    echo "  test:     Adding or updating tests"
    echo "  build:    Build system changes"
    echo "  ci:       CI/CD changes"
    echo "  chore:    Other changes"
    echo "  revert:   Revert previous commit"
    echo ""
    echo "Examples:"
    echo "  feat(auth): Add OAuth2 login"
    echo "  fix(api): Handle null response"
    echo "  docs: Update README"
    echo ""
    echo "=========================================="
    echo "💡 Tip: Use --no-verify to skip (not recommended)"
    echo "=========================================="
    echo ""
    exit 1
fi

exit 0