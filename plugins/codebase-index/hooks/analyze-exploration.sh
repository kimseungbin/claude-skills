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

# Count exploration signals from transcript (JSONL format - must pipe through cat)
# Tool calls are in .message.content[] where .type == "tool_use"
explore_count=$(cat "$transcript_path" | jq -r '.message.content[]? | select(.type == "tool_use") | select(.name == "Task") | select(.input.subagent_type == "Explore") | .name' 2>/dev/null | wc -l | tr -d ' ')
read_count=$(cat "$transcript_path" | jq -r '.message.content[]? | select(.type == "tool_use") | select(.name == "Read") | .name' 2>/dev/null | wc -l | tr -d ' ')
glob_count=$(cat "$transcript_path" | jq -r '.message.content[]? | select(.type == "tool_use") | select(.name == "Glob") | .name' 2>/dev/null | wc -l | tr -d ' ')
grep_count=$(cat "$transcript_path" | jq -r '.message.content[]? | select(.type == "tool_use") | select(.name == "Grep") | .name' 2>/dev/null | wc -l | tr -d ' ')

# Get file paths with their line counts (file_path<tab>limit)
files_with_lines=$(cat "$transcript_path" | jq -r '.message.content[]? | select(.type == "tool_use") | select(.name == "Read") | "\(.input.file_path)\t\(.input.limit // 200)"' 2>/dev/null)

# Calculate total lines read
lines_read=$(echo "$files_with_lines" | awk -F'\t' '{sum+=$2} END {print sum+0}')

# Aggregate lines per unique file (sum if file read multiple times)
files_read=$(echo "$files_with_lines" | awk -F'\t' '{lines[$1]+=$2} END {for(f in lines) print f"\t"lines[f]}' | sort -t$'\t' -k2 -rn | head -10)

# Count unique files
unique_file_count=$(echo "$files_read" | grep -c . || echo 0)

glob_grep_count=$((glob_count + grep_count))

# Build reasons array
reasons=()

if [ "$explore_count" -gt "$EXPLORE_THRESHOLD" ]; then
  reasons+=("Used Explore agent $explore_count time(s)")
fi

if [ "$read_count" -gt "$READ_THRESHOLD" ]; then
  reasons+=("$read_count Read operations")
fi

if [ "$lines_read" -gt "$LINES_THRESHOLD" ]; then
  reasons+=("Read ~$lines_read lines total")
fi

if [ "$glob_grep_count" -gt "$GLOB_GREP_THRESHOLD" ]; then
  reasons+=("Used Glob/Grep $glob_grep_count time(s)")
fi

# Build formatted file list with line counts
files_formatted=""
if [ -n "$files_read" ]; then
  # Convert to relative paths and format with line counts: "  - path (N lines)"
  files_formatted=$(echo "$files_read" | while IFS=$'\t' read -r filepath linecount; do
    relpath=$(echo "$filepath" | sed "s|^$cwd/||")
    echo "  - $relpath ($linecount lines)"
  done | tr '\n' '|' | sed 's/|$//' | sed 's/|/\\n/g')
fi

# If any threshold exceeded, suggest improvements
if [ ${#reasons[@]} -gt 0 ]; then
  reason_text=$(IFS=', '; echo "${reasons[*]}")

  # Build formatted message
  message="📊 Exploration Summary\\n"
  message+="  Explore: $explore_count | Read: $read_count ($unique_file_count files) | Glob: $glob_count | Grep: $grep_count | ~${lines_read} lines\\n\\n"
  message+="⚠️  Thresholds Exceeded:\\n"
  for reason in "${reasons[@]}"; do
    message+="  - $reason\\n"
  done
  if [ -n "$files_formatted" ]; then
    message+="\\n📁 Files Accessed:\\n$files_formatted\\n"
  fi
  message+="\\n💡 Consider adding these paths to CLAUDE.md for faster navigation."

  # Use jq to properly escape the message for JSON
  echo "{\"decision\": \"block\", \"reason\": \"$message\"}"
  exit 0
fi

# No thresholds exceeded - print summary
message="📊 Exploration Summary\\n"
message+="  Explore: $explore_count | Read: $read_count ($unique_file_count files) | Glob: $glob_count | Grep: $grep_count | ~${lines_read} lines\\n\\n"
message+="✅ All within thresholds."

echo "{\"decision\": \"block\", \"reason\": \"$message\"}"
exit 0
