#!/bin/sh
# Commit-msg hook template for visual snapshot validation
# Suitable for: Projects with visual regression testing (Playwright, Percy, Chromatic)
#
# Customize:
# - Adjust file extensions to match your UI files
# - Modify snapshot footer keywords
# - Update documentation references

set -e

commit_msg_file="$1"
changed_files=$(git diff --cached --name-only --diff-filter=ACM)

# Check for UI file changes (customize extensions for your project)
if echo "$changed_files" | grep -qE "\.(svelte|vue|jsx|tsx|css|scss)$"; then
    echo ""
    echo "=========================================="
    echo "⚠️  UI Changes Detected"
    echo "=========================================="
    echo ""
    echo "You've modified UI files that may affect visual snapshots:"
    echo ""
    echo "$changed_files" | grep -E "\.(svelte|vue|jsx|tsx|css|scss)$" | sed 's/^/  📄 /'
    echo ""

    commit_msg=$(cat "$commit_msg_file")

    # Check for snapshot handling footers
    has_update_keyword=false
    has_skip_keyword=false

    if echo "$commit_msg" | grep -qE "(Snapshots: update|\[update-snapshots\])"; then
        has_update_keyword=true
    fi

    if echo "$commit_msg" | grep -qE "(Snapshots: skip|\[skip-snapshots\])"; then
        has_skip_keyword=true
    fi

    if [ "$has_update_keyword" = true ]; then
        echo "✅ Snapshot update footer detected: Snapshots: update"
        echo "   CI will automatically update visual snapshots after push."
        echo ""
        echo "=========================================="
    elif [ "$has_skip_keyword" = true ]; then
        echo "✅ Snapshot skip footer detected: Snapshots: skip"
        echo "   You've confirmed these changes don't affect visual appearance."
        echo ""
        echo "=========================================="
    else
        echo "❌ ERROR: Missing snapshot handling footer"
        echo "=========================================="
        echo ""
        echo "UI files were modified but no snapshot footer found in commit message."
        echo ""
        echo "You must explicitly declare snapshot handling intent:"
        echo ""
        echo "  Option 1: Snapshots: update"
        echo "    • Use when UI appearance changes (styling, layout, new elements)"
        echo "    • CI will automatically update snapshots after push"
        echo "    • Example:"
        echo "      git commit -m \"feat: Redesign button"
        echo ""
        echo "      Changes button color and adds hover effect."
        echo ""
        echo "      Snapshots: update\""
        echo ""
        echo "  Option 2: Snapshots: skip"
        echo "    • Use when UI files changed but appearance unchanged"
        echo "    • Example: Internal refactoring, prop renaming, type changes"
        echo "    • Example:"
        echo "      git commit -m \"refactor: Extract component logic"
        echo ""
        echo "      Moves validation logic to separate function."
        echo ""
        echo "      Snapshots: skip\""
        echo ""
        echo "=========================================="
        echo "💡 Tip: Use --no-verify to bypass (not recommended)"
        echo "=========================================="
        echo ""
        exit 1
    fi
fi

exit 0