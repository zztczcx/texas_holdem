#!/usr/bin/env bash
# PostToolUse hook: run TypeScript type-check after any file edit.
# If there are errors, inject them as a systemMessage so the agent self-corrects.

set -euo pipefail

# Read the tool input from stdin (JSON)
input=$(cat)

# Extract the file path from the tool call (works for both str_replace_in_file and write_file)
file_path=$(echo "$input" | grep -oP '"path"\s*:\s*"\K[^"]+' 2>/dev/null || \
            echo "$input" | grep -oP '"filePath"\s*:\s*"\K[^"]+' 2>/dev/null || \
            echo "")

# Only run for TypeScript files
if [[ -z "$file_path" ]] || [[ "$file_path" != *.ts && "$file_path" != *.tsx ]]; then
  exit 0
fi

# Run tsc --noEmit from the project root
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")"

errors=$(npx --no-install tsc --noEmit 2>&1 || true)

if [[ -n "$errors" ]]; then
  # Return a systemMessage that the agent will read and act on
  printf '{"systemMessage": "TypeScript errors found after your last edit — fix these before continuing:\n\n%s"}' \
    "$(echo "$errors" | head -50 | sed 's/"/\\"/g' | sed 's/$/\\n/' | tr -d '\n')"
fi

exit 0
