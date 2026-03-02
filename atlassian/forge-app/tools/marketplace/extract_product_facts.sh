#!/usr/bin/env bash
# extract_product_facts.sh
# Extract actual product facts from code and manifest (offline)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Evidence directory
E="${1:-/tmp/ft_marketplace_gap_closure_latest}"
if [[ ! -d "$E" ]]; then
  E="/tmp/ft_marketplace_gap_closure_latest"
fi
E=$(readlink -f "$E" 2>/dev/null || echo "$E")

OUTPUT="$E/02_claims/product_facts.json"

echo "[PRODUCT FACTS] Extracting from code and manifest..."

cd "$REPO_ROOT"

# 1. Extract manifest scopes
MANIFEST_PATH="manifest.yml"
SCOPES=()
if [[ -f "$MANIFEST_PATH" ]]; then
  # Extract scopes using yq or grep
  if command -v yq &>/dev/null; then
    SCOPES_RAW=$(yq '.permissions.scopes[]' "$MANIFEST_PATH" 2>/dev/null || echo "")
  else
    # Fallback: grep-based extraction (stop at next top-level key)
    SCOPES_RAW=$(grep -A 20 'permissions:' "$MANIFEST_PATH" | grep -A 10 'scopes:' | grep '^\s*-' | grep -v 'key:' | sed 's/^\s*-\s*//' || echo "")
  fi
  while IFS= read -r line; do
    [[ -n "$line" ]] && SCOPES+=("$line")
  done <<< "$SCOPES_RAW"
fi

echo "  Scopes found: ${#SCOPES[@]}"

# 2. Check for write-implying modules (webtrigger, scheduled)
HAS_WEBTRIGGER=false
HAS_SCHEDULED=false
if [[ -f "$MANIFEST_PATH" ]]; then
  if grep -q 'function:' "$MANIFEST_PATH" || grep -q 'webtrigger:' "$MANIFEST_PATH"; then
    HAS_WEBTRIGGER=true
  fi
  if grep -q 'scheduled:' "$MANIFEST_PATH" || grep -q 'trigger:' "$MANIFEST_PATH"; then
    HAS_SCHEDULED=true
  fi
fi

# 3. External egress detection
EXTERNAL_URLS=()
EXTERNAL_REFS=()

echo "  Scanning for external egress..."

# Search for fetch/axios/request/https patterns in src/ (limit to first 100 matches)
if [[ -d "src" ]]; then
  while IFS= read -r match; do
    EXTERNAL_REFS+=("$match")
    # Extract URL if possible
    URL=$(echo "$match" | grep -oP 'https?://[^\s"'\'']+' || true)
    [[ -n "$URL" ]] && EXTERNAL_URLS+=("$URL")
  done < <(grep -rn --include="*.ts" --include="*.js" -E '(fetch|axios|request|https?://)' src/ 2>/dev/null | head -100 || true)
fi

# Deduplicate URLs
if [[ ${#EXTERNAL_URLS[@]} -gt 0 ]]; then
  UNIQUE_URLS=($(printf '%s\n' "${EXTERNAL_URLS[@]}" | sort -u 2>/dev/null || true))
else
  UNIQUE_URLS=()
fi

echo "  External URL references: ${#UNIQUE_URLS[@]}"

# 4. Storage usage inventory
echo "  Scanning for storage API usage..."
STORAGE_REFS=()
if [[ -d "src" ]]; then
  while IFS= read -r match; do
    STORAGE_REFS+=("$match")
  done < <(grep -rn --include="*.ts" --include="*.js" -E 'storage\.(get|set|delete|query)' src/ 2>/dev/null | head -100 || true)
fi

echo "  Storage API calls: ${#STORAGE_REFS[@]}"

# 5. Check for existing audit artifacts
HAS_AUDIT_HOOKS=false
if [[ -d "tools/audit" ]]; then
  HAS_AUDIT_HOOKS=true
fi

# Generate JSON output (simple approach)
{
  echo "{"
  echo "  \"manifest_path\": \"$MANIFEST_PATH\","
  
  # Scopes array
  echo "  \"scopes\": ["
  if [[ ${#SCOPES[@]} -gt 0 ]]; then
    for i in "${!SCOPES[@]}"; do
      echo -n "    \"${SCOPES[$i]}\""
      [[ $i -lt $((${#SCOPES[@]} - 1)) ]] && echo "," || echo ""
    done
  fi
  echo "  ],"
  
  echo "  \"has_webtrigger\": $HAS_WEBTRIGGER,"
  echo "  \"has_scheduled\": $HAS_SCHEDULED,"
  
  # External URLs array
  echo "  \"external_urls\": ["
  if [[ ${#UNIQUE_URLS[@]} -gt 0 ]]; then
    for i in "${!UNIQUE_URLS[@]}"; do
      echo -n "    \"${UNIQUE_URLS[$i]}\""
      [[ $i -lt $((${#UNIQUE_URLS[@]} - 1)) ]] && echo "," || echo ""
    done
  fi
  echo "  ],"
  
  echo "  \"external_url_count\": ${#UNIQUE_URLS[@]},"
  echo "  \"storage_usage_count\": ${#STORAGE_REFS[@]},"
  echo "  \"has_audit_hooks\": $HAS_AUDIT_HOOKS"
  echo "}"
} > "$OUTPUT"

echo "  Output: $OUTPUT"
