#!/bin/bash
#
# Shared utility functions for git hooks
#
# Usage:
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/utils.sh"
#

# Get the directory of the .githooks folder
# Usage: HOOKS_DIR=$(get_hooks_dir)
get_hooks_dir() {
    cd "$(dirname "${BASH_SOURCE[1]}")" && pwd
}

# Get the current git branch name
# Usage: BRANCH=$(get_current_branch)
get_current_branch() {
    git branch --show-current 2>/dev/null
}

# Format bytes to human-readable size
# Usage: size_str=$(format_size 1048576)  # Returns "1.0MB"
format_size() {
    local bytes="$1"
    if [[ $bytes -ge 1048576 ]]; then
        echo "$(echo "scale=1; $bytes/1048576" | bc)MB"
    elif [[ $bytes -ge 1024 ]]; then
        echo "$(echo "scale=1; $bytes/1024" | bc)KB"
    else
        echo "${bytes}B"
    fi
}

# Get file size in bytes (cross-platform)
# Usage: size=$(get_file_size "path/to/file")
get_file_size() {
    local file="$1"
    stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0"
}

# Check if running in CI environment
# Usage: if is_ci; then ...
is_ci() {
    [[ -n "${CI:-}" ]] || [[ -n "${GITHUB_ACTIONS:-}" ]] || [[ -n "${JENKINS_URL:-}" ]]
}

# Check if a branch is a deployment branch
# Override this function in your hooks or create a project-specific config
# Usage: if is_deployment_branch "main"; then ...
#
# Default: main, master, staging, prod, production
is_deployment_branch() {
    local branch="$1"

    # Check project-specific config first
    local config_file
    config_file="$(get_hooks_dir)/config/deployment-branches.txt"

    if [[ -f "$config_file" ]]; then
        grep -qx "$branch" "$config_file"
        return $?
    fi

    # Default deployment branches
    case "$branch" in
        main|master|staging|prod|production)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}