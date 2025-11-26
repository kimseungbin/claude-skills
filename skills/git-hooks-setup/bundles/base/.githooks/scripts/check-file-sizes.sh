#!/bin/bash
#
# File Size Check Script
#
# Warns about files that exceed size limits and may benefit from refactoring.
# Large files consume more tokens when AI assistants read them.
#
# Usage:
#   .githooks/scripts/check-file-sizes.sh              # Check files changed since remote
#   .githooks/scripts/check-file-sizes.sh --all        # Check all tracked files
#   .githooks/scripts/check-file-sizes.sh --staged     # Check staged files only
#
# Exit codes:
#   0 - Success (warnings may have been shown)
#   1 - Error (configuration or script error)
#
# See .githooks/README.md for full documentation.

set -e

# Script directory and shared lib
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/../lib"

# Source shared libraries
source "$LIB_DIR/colors.sh"
source "$LIB_DIR/output.sh"
source "$LIB_DIR/utils.sh"

# Configuration
CONFIG_FILE="$SCRIPT_DIR/file-size-limits.yaml"

# Default values
CHECK_MODE="changed"  # changed, all, staged

#############################################
# Parse arguments
#############################################
while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            CHECK_MODE="all"
            shift
            ;;
        --staged)
            CHECK_MODE="staged"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--all|--staged]"
            echo ""
            echo "Options:"
            echo "  --all     Check all tracked files"
            echo "  --staged  Check staged files only"
            echo "  (default) Check files changed in commits to be pushed"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

#############################################
# Load configuration
#############################################
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "Error: Configuration file not found: $CONFIG_FILE" >&2
    exit 1
fi

# Parse YAML configuration (simple parser for our format)
# Extract limits
LIMIT_TS=$(grep -E "^\s+ts:" "$CONFIG_FILE" | awk '{print $2}' | head -1)
LIMIT_MD=$(grep -E "^\s+md:" "$CONFIG_FILE" | awk '{print $2}' | head -1)

# Extract exclude directories
EXCLUDE_DIRS=()
in_exclude=false
while IFS= read -r line; do
    if [[ "$line" =~ ^exclude: ]]; then
        in_exclude=true
        continue
    fi
    if $in_exclude; then
        if [[ "$line" =~ ^[a-z] ]] || [[ -z "$line" ]]; then
            break
        fi
        if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*(.+) ]]; then
            EXCLUDE_DIRS+=("${BASH_REMATCH[1]}")
        fi
    fi
done < "$CONFIG_FILE"

# Set defaults if not configured
LIMIT_TS=${LIMIT_TS:-8192}
LIMIT_MD=${LIMIT_MD:-15360}

#############################################
# Get list of files to check
#############################################
get_files_to_check() {
    local files=()

    case $CHECK_MODE in
        all)
            # All tracked .ts and .md files
            while IFS= read -r file; do
                files+=("$file")
            done < <(git ls-files '*.ts' '*.md' 2>/dev/null)
            ;;
        staged)
            # Only staged files
            while IFS= read -r file; do
                files+=("$file")
            done < <(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -E '\.(ts|md)$' || true)
            ;;
        changed)
            # Files changed in commits being pushed
            # Get the remote tracking branch
            local remote_ref
            remote_ref=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "")

            if [[ -z "$remote_ref" ]]; then
                # No upstream, check against origin/master or origin/main
                if git rev-parse --verify origin/master >/dev/null 2>&1; then
                    remote_ref="origin/master"
                elif git rev-parse --verify origin/main >/dev/null 2>&1; then
                    remote_ref="origin/main"
                else
                    # Fallback to all files
                    CHECK_MODE="all"
                    get_files_to_check
                    return
                fi
            fi

            while IFS= read -r file; do
                files+=("$file")
            done < <(git diff --name-only "$remote_ref"..HEAD 2>/dev/null | grep -E '\.(ts|md)$' || true)
            ;;
    esac

    printf '%s\n' "${files[@]}"
}

#############################################
# Check if path should be excluded
#############################################
is_excluded() {
    local file="$1"
    for exclude in "${EXCLUDE_DIRS[@]}"; do
        if [[ "$file" == "$exclude"/* ]] || [[ "$file" == "$exclude" ]]; then
            return 0
        fi
    done
    return 1
}

#############################################
# Check for escape comment in file
#############################################
has_escape_comment() {
    local file="$1"
    local ext="${file##*.}"

    # Read first 5 lines
    local head_content
    head_content=$(head -5 "$file" 2>/dev/null || echo "")

    case $ext in
        ts)
            # Check for: // large-file-ok: reason
            if echo "$head_content" | grep -qE "^//\s*large-file-ok:"; then
                return 0
            fi
            ;;
        md)
            # Check for: <!-- large-file-ok: reason -->
            if echo "$head_content" | grep -qE "<!--\s*large-file-ok:"; then
                return 0
            fi
            ;;
    esac

    return 1
}

#############################################
# Get size limit for file extension
#############################################
get_limit() {
    local ext="$1"
    case $ext in
        ts) echo "$LIMIT_TS" ;;
        md) echo "$LIMIT_MD" ;;
        *) echo "0" ;;
    esac
}

#############################################
# Main check logic
#############################################
warnings=()
checked_count=0

while IFS= read -r file; do
    # Skip empty lines
    [[ -z "$file" ]] && continue

    # Skip if file doesn't exist (deleted in working tree)
    [[ ! -f "$file" ]] && continue

    # Skip excluded directories
    if is_excluded "$file"; then
        continue
    fi

    # Skip .d.ts files
    if [[ "$file" == *.d.ts ]]; then
        continue
    fi

    # Get file extension and limit
    ext="${file##*.}"
    limit=$(get_limit "$ext")

    # Skip if no limit defined for this extension
    [[ "$limit" == "0" ]] && continue

    ((checked_count++))

    # Get file size using shared utility
    size=$(get_file_size "$file")

    # Check if exceeds limit
    if [[ $size -gt $limit ]]; then
        # Check for escape comment
        if has_escape_comment "$file"; then
            continue
        fi

        warnings+=("$file|$size|$limit|$ext")
    fi
done < <(get_files_to_check)

#############################################
# Output results
#############################################
if [[ ${#warnings[@]} -eq 0 ]]; then
    # No warnings - silent success
    exit 0
fi

# Print warnings
echo ""
print_warning "FILE SIZE WARNING"
echo ""
echo -e "The following files exceed recommended size limits:"
echo ""

for warning in "${warnings[@]}"; do
    IFS='|' read -r file size limit ext <<< "$warning"

    size_fmt=$(format_size "$size")
    limit_fmt=$(format_size "$limit")

    echo -e "  ${CYAN}${SYM_FILE} $file${NC}"
    echo -e "     Size: ${YELLOW}$size_fmt${NC} (limit: $limit_fmt)"

    # Suggestions based on file type
    case $ext in
        ts)
            print_hint "Consider: Splitting into smaller, focused modules"
            echo -e "     ${DIM}Bypass: Add${NC} ${BLUE}// large-file-ok: reason${NC} ${DIM}at the top of the file${NC}"
            ;;
        md)
            print_hint "Consider: Breaking into multiple focused documents"
            echo -e "     ${DIM}Bypass: Add${NC} ${BLUE}<!-- large-file-ok: reason -->${NC} ${DIM}at the top of the file${NC}"
            ;;
    esac
    echo ""
done

# Summary line
print_separator
echo ""
echo -e "Summary: ${YELLOW}${#warnings[@]} file(s) exceed size limits${NC}"
echo ""
echo -e "${DIM}These warnings help AI assistants work more efficiently.${NC}"
echo -e "${DIM}Large files consume more tokens and may benefit from refactoring.${NC}"
echo ""

exit 0