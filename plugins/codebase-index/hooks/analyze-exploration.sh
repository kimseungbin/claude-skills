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

# Extract current turn only (entries after the last user message)
filtered_file=$(mktemp)
trap "rm -f '$filtered_file'" EXIT

last_user_line=$(grep -n '"role":"user"' "$transcript_path" | tail -1 | cut -d: -f1)
if [ -n "$last_user_line" ]; then
  tail -n +"$((last_user_line + 1))" "$transcript_path" > "$filtered_file"
else
  cp "$transcript_path" "$filtered_file"
fi

explore_count=$(cat "$filtered_file" | jq -r '.message.content[]? | select(.type == "tool_use") | select(.name == "Task") | select(.input.subagent_type == "Explore") | .name' 2>/dev/null | wc -l | tr -d ' ')
glob_count=$(cat "$filtered_file" | jq -r '.message.content[]? | select(.type == "tool_use") | select(.name == "Glob") | .name' 2>/dev/null | wc -l | tr -d ' ')
grep_count=$(cat "$filtered_file" | jq -r '.message.content[]? | select(.type == "tool_use") | select(.name == "Grep") | .name' 2>/dev/null | wc -l | tr -d ' ')

# Get file paths that were edited (to distinguish edit targets from reference reads)
edited_files=$(cat "$filtered_file" | jq -r '.message.content[]? | select(.type == "tool_use") | select(.name == "Edit") | .input.file_path' 2>/dev/null | sort -u)

# Get error tool_result IDs (to identify failed Read attempts)
error_ids=$(cat "$filtered_file" | jq -r '.message.content[]? | select(.type == "tool_result") | select(.is_error == true) | .tool_use_id' 2>/dev/null | sort -u)

# Get all Read tool calls with IDs for success/failure filtering
all_read_entries=$(cat "$filtered_file" | jq -r '.message.content[]? | select(.type == "tool_use") | select(.name == "Read") | "\(.id)\t\(.input.file_path)\t\(.input.limit // "")"' 2>/dev/null)

# Separate successful reads from failed attempts
successful_reads_file=$(mktemp)
failed_read_count=0
while IFS=$'\t' read -r id filepath limit; do
  [ -z "$id" ] && continue
  if [ -n "$error_ids" ] && echo "$error_ids" | grep -qF "$id"; then
    failed_read_count=$((failed_read_count + 1))
  else
    # When limit is empty, the whole file was read — count actual lines
    if [ -z "$limit" ]; then
      if [ -f "$filepath" ]; then
        limit=$(wc -l < "$filepath" | tr -d ' ')
      else
        limit=0
      fi
    fi
    printf '%s\t%s\n' "$filepath" "$limit" >> "$successful_reads_file"
  fi
done <<< "$all_read_entries"

files_with_lines=$(cat "$successful_reads_file" 2>/dev/null)
read_count=$(wc -l < "$successful_reads_file" 2>/dev/null | tr -d ' ')
rm -f "$successful_reads_file"

# Calculate total lines read (successful reads only)
lines_read=$(echo "$files_with_lines" | awk -F'\t' '{sum+=$2} END {print sum+0}')

# Calculate lines from reference-only reads (files Read but not Edited)
# Edit targets need full reads — file-headers won't help there
if [ -z "$edited_files" ]; then
  lines_read_refs=$lines_read
else
  edited_pattern=$(echo "$edited_files" | paste -sd'|' -)
  lines_read_refs=$(echo "$files_with_lines" | awk -F'\t' -v pat="$edited_pattern" '$1 !~ pat {sum+=$2} END {print sum+0}')
fi

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

if [ "$failed_read_count" -gt 0 ]; then
  reasons+=("$failed_read_count failed Read attempt(s) (wrong paths)")
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
  read_summary="Read: $read_count ($unique_file_count files"
  if [ "$failed_read_count" -gt 0 ]; then
    read_summary+=", $failed_read_count failed"
  fi
  read_summary+=")"
  message+="  Explore: $explore_count | $read_summary | Glob: $glob_count | Grep: $grep_count | ~${lines_read} lines\\n\\n"
  message+="⚠️  Thresholds Exceeded:\\n"
  for reason in "${reasons[@]}"; do
    message+="  - $reason\\n"
  done
  if [ -n "$files_formatted" ]; then
    message+="\\n📁 Files Accessed:\\n$files_formatted\\n"
  fi

  # Build metric-specific suggestions
  suggestions=()
  if [ "$read_count" -gt "$READ_THRESHOLD" ] || [ "$explore_count" -gt "$EXPLORE_THRESHOLD" ] || [ "$glob_grep_count" -gt "$GLOB_GREP_THRESHOLD" ] || [ "$failed_read_count" -gt 0 ]; then
    suggestions+=("Navigation could be improved. Run \`Skill(maintain-index)\` to update INDEX.md")
  fi
  if [ "$lines_read_refs" -gt "$LINES_THRESHOLD" ]; then
    suggestions+=("Large reference files detected. Run \`Skill(file-headers)\` to add JSDoc summaries so you can check APIs without reading full files")
  fi

  message+="\\n💡 Suggestions:\\n"
  for suggestion in "${suggestions[@]}"; do
    message+="  - $suggestion\\n"
  done

  # Use jq to properly escape the message for JSON
  echo "{\"decision\": \"block\", \"reason\": \"$message\"}"
  exit 0
fi

# No thresholds exceeded - silent exit
exit 0
