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

# Marker file to track last check timestamp (per-session)
session_id=$(basename "$transcript_path" .jsonl)
marker_file="$cwd/.claude/.codebase-index-marker-$session_id"

# Get last check timestamp (empty string if first run)
last_check=""
if [ -f "$marker_file" ]; then
  last_check=$(cat "$marker_file")
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

# Count exploration signals from transcript (JSONL format)
# Tool calls are in .message.content[] where .type == "tool_use"
# Filter by timestamp if we have a last_check marker (use temp file to handle large transcripts)
filtered_file=$(mktemp)
trap "rm -f '$filtered_file'" EXIT

if [ -n "$last_check" ]; then
  # Filter entries after the marker timestamp
  while IFS= read -r line; do
    ts=$(echo "$line" | jq -r '.timestamp // ""' 2>/dev/null)
    if [[ -n "$ts" && "$ts" > "$last_check" ]]; then
      echo "$line"
    fi
  done < "$transcript_path" > "$filtered_file"
else
  cp "$transcript_path" "$filtered_file"
fi

explore_count=$(cat "$filtered_file" | jq -r '.message.content[]? | select(.type == "tool_use") | select(.name == "Task") | select(.input.subagent_type == "Explore") | .name' 2>/dev/null | wc -l | tr -d ' ')
read_count=$(cat "$filtered_file" | jq -r '.message.content[]? | select(.type == "tool_use") | select(.name == "Read") | .name' 2>/dev/null | wc -l | tr -d ' ')
glob_count=$(cat "$filtered_file" | jq -r '.message.content[]? | select(.type == "tool_use") | select(.name == "Glob") | .name' 2>/dev/null | wc -l | tr -d ' ')
grep_count=$(cat "$filtered_file" | jq -r '.message.content[]? | select(.type == "tool_use") | select(.name == "Grep") | .name' 2>/dev/null | wc -l | tr -d ' ')

# Get file paths with their line counts (file_path<tab>limit)
files_with_lines=$(cat "$filtered_file" | jq -r '.message.content[]? | select(.type == "tool_use") | select(.name == "Read") | "\(.input.file_path)\t\(.input.limit // 200)"' 2>/dev/null)

# Calculate total lines read
lines_read=$(echo "$files_with_lines" | awk -F'\t' '{sum+=$2} END {print sum+0}')

# Aggregate lines per unique file (sum if file read multiple times)
if [ -z "$files_with_lines" ]; then
  files_read=""
else
  files_read=$(echo "$files_with_lines" | awk -F'\t' '$1 != "" {lines[$1]+=$2} END {for(f in lines) print f"\t"lines[f]}' | sort -t$'\t' -k2 -rn | head -10)
fi

# Count unique files (handle empty case)
if [ -z "$files_read" ]; then
  unique_file_count=0
else
  unique_file_count=$(echo "$files_read" | grep -c . || echo 0)
fi

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

  # Build metric-specific suggestions
  suggestions=()
  if [ "$read_count" -gt "$READ_THRESHOLD" ] || [ "$explore_count" -gt "$EXPLORE_THRESHOLD" ] || [ "$glob_grep_count" -gt "$GLOB_GREP_THRESHOLD" ]; then
    suggestions+=("Navigation could be improved. Run \`Skill(maintain-index)\` to update INDEX.md")
  fi
  if [ "$lines_read" -gt "$LINES_THRESHOLD" ]; then
    suggestions+=("Large files detected. Run \`Skill(file-headers)\` to add JSDoc summaries")
  fi

  message+="\\n💡 Suggestions:\\n"
  for suggestion in "${suggestions[@]}"; do
    message+="  - $suggestion\\n"
  done

  # Save current timestamp as marker for next check
  current_ts=$(cat "$transcript_path" | jq -r '.timestamp' 2>/dev/null | tail -1)
  mkdir -p "$(dirname "$marker_file")"
  echo "$current_ts" > "$marker_file"

  # Use jq to properly escape the message for JSON
  echo "{\"decision\": \"block\", \"reason\": \"$message\"}"
  exit 0
fi

# Save current timestamp as marker for next check
current_ts=$(cat "$transcript_path" | jq -r '.timestamp' 2>/dev/null | tail -1)
mkdir -p "$(dirname "$marker_file")"
echo "$current_ts" > "$marker_file"

# No thresholds exceeded - silent exit
exit 0
