#!/bin/bash

# Codebase Index Plugin - UserPromptSubmit Hook
# Reminds Claude to check INDEX.md before exploring

set -euo pipefail

# Read hook input from stdin
input=$(cat)

# Extract cwd
cwd=$(echo "$input" | jq -r '.cwd')

# Check for INDEX.md in common locations
index_file=""
if [ -f "$cwd/INDEX.md" ]; then
  index_file="INDEX.md"
elif [ -f "$cwd/src/INDEX.md" ]; then
  index_file="src/INDEX.md"
elif [ -f "$cwd/docs/INDEX.md" ]; then
  index_file="docs/INDEX.md"
fi

# If INDEX.md exists, output reminder
if [ -n "$index_file" ]; then
  echo "📋 INDEX.md exists at ./$index_file - read it before exploring the codebase to find files faster."
fi

exit 0