#!/bin/bash

# Codebase Index Plugin - Stop Hook
# Analyzes session transcript for inefficient exploration patterns

set -euo pipefail

# Read hook input from stdin
input=$(cat)

# Extract fields
transcript_path=$(echo "$input" | jq -r '.transcript_path')
stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active')
cwd=$(echo "$input" | jq -r '.cwd')

# Prevent infinite loops - if we already triggered, allow stop
if [ "$stop_hook_active" = "true" ]; then
  exit 0
fi

# Check if transcript exists
if [ ! -f "$transcript_path" ]; then
  exit 0
fi

# Default thresholds
EXPLORE_THRESHOLD=0
READ_THRESHOLD=5
LINES_THRESHOLD=500
GLOB_GREP_THRESHOLD=3

# Load project-specific config if exists
config_file="$cwd/.claude/config/codebase-index.yaml"
if [ -f "$config_file" ] && command -v yq &> /dev/null; then
  EXPLORE_THRESHOLD=$(yq -r '.thresholds.explore_count // 0' "$config_file")
  READ_THRESHOLD=$(yq -r '.thresholds.read_count // 5' "$config_file")
  LINES_THRESHOLD=$(yq -r '.thresholds.lines_read // 500' "$config_file")
  GLOB_GREP_THRESHOLD=$(yq -r '.thresholds.glob_grep_count // 3' "$config_file")
fi

# Count exploration signals from transcript
explore_count=$(jq -r 'select(.tool_name == "Task") | select(.tool_input.subagent_type == "Explore") | .tool_name' "$transcript_path" 2>/dev/null | wc -l | tr -d ' ')
read_count=$(jq -r 'select(.tool_name == "Read") | .tool_name' "$transcript_path" 2>/dev/null | wc -l | tr -d ' ')
glob_count=$(jq -r 'select(.tool_name == "Glob") | .tool_name' "$transcript_path" 2>/dev/null | wc -l | tr -d ' ')
grep_count=$(jq -r 'select(.tool_name == "Grep") | .tool_name' "$transcript_path" 2>/dev/null | wc -l | tr -d ' ')

# Calculate total lines read (sum of limit fields or estimate from output)
lines_read=$(jq -r 'select(.tool_name == "Read") | .tool_input.limit // 200' "$transcript_path" 2>/dev/null | awk '{sum+=$1} END {print sum+0}')

# Get files that were read for context
files_read=$(jq -r 'select(.tool_name == "Read") | .tool_input.file_path' "$transcript_path" 2>/dev/null | sort -u | head -10)

glob_grep_count=$((glob_count + grep_count))

# Build reasons array
reasons=()

if [ "$explore_count" -gt "$EXPLORE_THRESHOLD" ]; then
  reasons+=("Used Explore agent $explore_count time(s)")
fi

if [ "$read_count" -gt "$READ_THRESHOLD" ]; then
  reasons+=("Read $read_count files")
fi

if [ "$lines_read" -gt "$LINES_THRESHOLD" ]; then
  reasons+=("Read ~$lines_read lines total")
fi

if [ "$glob_grep_count" -gt "$GLOB_GREP_THRESHOLD" ]; then
  reasons+=("Used Glob/Grep $glob_grep_count time(s)")
fi

# If any threshold exceeded, suggest improvements
if [ ${#reasons[@]} -gt 0 ]; then
  reason_text=$(IFS=', '; echo "${reasons[*]}")

  # Build file list for context
  file_context=""
  if [ -n "$files_read" ]; then
    file_context="Files accessed: $(echo "$files_read" | tr '\n' ', ' | sed 's/,$//'). "
  fi

  cat <<EOF
{
  "decision": "block",
  "reason": "Exploration detected: $reason_text. ${file_context}Consider suggesting updates to CLAUDE.md or INDEX.md to make this faster next time. What file paths or patterns should be documented for this feature area?"
}
EOF
  exit 0
fi

# No issues - allow stop
exit 0
