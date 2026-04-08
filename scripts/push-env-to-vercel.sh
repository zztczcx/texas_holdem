#!/bin/bash
# Reads .env.local and pushes all non-comment, non-empty vars to Vercel (production).
# Usage: bash scripts/push-env-to-vercel.sh

set -e

ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found. Run from the project root."
  exit 1
fi

echo "Pushing env vars from $ENV_FILE to Vercel (production)..."

while IFS= read -r line || [[ -n "$line" ]]; do
  # Strip carriage returns (Windows line endings)
  line="${line//$'\r'/}"
  # Skip comments and blank lines
  [[ "$line" =~ ^#.*$ ]] && continue
  [[ -z "$line" ]] && continue

  KEY="${line%%=*}"
  VALUE="${line#*=}"
  # Strip all carriage returns, newlines, leading/trailing whitespace
  VALUE="$(printf '%s' "$VALUE" | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

  # Skip if value is empty
  if [ -z "$VALUE" ]; then
    echo "  Skipping $KEY (empty value)"
    continue
  fi

  echo "  Adding $KEY..."
  printf '%s' "$VALUE" | vercel env add "$KEY" production --force
done < "$ENV_FILE"

echo ""
echo "Done. Redeploy to apply: vercel --prod"
