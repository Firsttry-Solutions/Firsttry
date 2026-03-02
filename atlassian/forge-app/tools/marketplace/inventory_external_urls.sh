#!/usr/bin/env bash
# inventory_external_urls.sh
# Scan repo for external URLs, categorize as runtime vs non-runtime (fail-closed)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Evidence directory
E="${1:-/tmp/ft_marketplace_phase3_5_latest}"
if [[ ! -d "$E" ]]; then
  E="/tmp/ft_marketplace_phase3_5_latest"
fi
E=$(readlink -f "$E" 2>/dev/null || echo "$E")

OUTPUT_JSON="$E/01_scan/external_urls.json"
RUNTIME_TXT="$E/01_scan/runtime_urls.txt"
NONRUNTIME_TXT="$E/01_scan/non_runtime_urls.txt"
VERDICT="$E/01_scan/VERDICT.txt"

echo "[EXTERNAL URLS] Scanning repository for external URL literals..."

cd "$REPO_ROOT"

# Patterns to search
PATTERNS='https?://|hooks\.slack\.com|example\.com'

# Exclude paths (directories)
EXCLUDE_PATHS=(
  "node_modules"
  "dist"
  "coverage"
  ".git"
  "artifacts"
)

# Exclude files (patterns)
EXCLUDE_FILES=(
  "package-lock.json"
  "*.lock"
  "yarn.lock"
  "pnpm-lock.yaml"
)

# Build exclude pattern
EXCLUDE_ARGS=""
for path in "${EXCLUDE_PATHS[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude-dir=$path"
done
for file in "${EXCLUDE_FILES[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude=$file"
done

# Find all occurrences
RUNTIME_URLS=()
NONRUNTIME_URLS=()

echo "  Scanning src/ (runtime)..."
if [[ -d "src" ]]; then
  while IFS= read -r line; do
    if [[ -n "$line" ]]; then
      FILE=$(echo "$line" | cut -d: -f1)
      
      # Skip test files (classify as non-runtime)
      if [[ "$FILE" =~ /__tests__/|\.test\.|\.spec\. ]]; then
        continue
      fi
      
      LINE_NUM=$(echo "$line" | cut -d: -f2)
      CONTENT=$(echo "$line" | cut -d: -f3-)
      
      # Extract URL
      URL=$(echo "$CONTENT" | grep -oP 'https?://[^\s"'\''`]+' | head -1 || true)
      [[ -z "$URL" ]] && URL=$(echo "$CONTENT" | grep -oP 'hooks\.slack\.com[^\s"'\'']*' | head -1 || true)
      [[ -z "$URL" ]] && URL=$(echo "$CONTENT" | grep -oP 'example\.com[^\s"'\'']*' | head -1 || true)
      
      if [[ -n "$URL" ]]; then
        RUNTIME_URLS+=("$FILE:$LINE_NUM:$URL")
      fi
    fi
  done < <(grep -rn $EXCLUDE_ARGS -E "$PATTERNS" src/ 2>/dev/null | head -200 || true)
fi

echo "  Scanning non-runtime paths (tests, docs, tools, .github)..."

# Scan test files in src/
if [[ -d "src" ]]; then
  while IFS= read -r line; do
    if [[ -n "$line" ]]; then
      FILE=$(echo "$line" | cut -d: -f1)
      
      # Only include test files
      if [[ ! "$FILE" =~ /__tests__/|\.test\.|\.spec\. ]]; then
        continue
      fi
      
      LINE_NUM=$(echo "$line" | cut -d: -f2)
      CONTENT=$(echo "$line" | cut -d: -f3-)
      
      # Extract URL
      URL=$(echo "$CONTENT" | grep -oP 'https?://[^\s"'\''`]+' | head -1 || true)
      [[ -z "$URL" ]] && URL=$(echo "$CONTENT" | grep -oP 'hooks\.slack\.com[^\s"'\'']*' | head -1 || true)
      [[ -z "$URL" ]] && URL=$(echo "$CONTENT" | grep -oP 'example\.com[^\s"'\'']*' | head -1 || true)
      
      if [[ -n "$URL" ]]; then
        NONRUNTIME_URLS+=("$FILE:$LINE_NUM:$URL")
      fi
    fi
  done < <(grep -rn $EXCLUDE_ARGS -E "$PATTERNS" src/ 2>/dev/null | head -200 || true)
fi

# Scan other non-runtime directories
for dir in tests docs tools .github; do
  if [[ -d "$dir" ]]; then
    while IFS= read -r line; do
      if [[ -n "$line" ]]; then
        FILE=$(echo "$line" | cut -d: -f1)
        LINE_NUM=$(echo "$line" | cut -d: -f2)
        CONTENT=$(echo "$line" | cut -d: -f3-)
        
        # Extract URL
        URL=$(echo "$CONTENT" | grep -oP 'https?://[^\s"'\''`]+' | head -1 || true)
        [[ -z "$URL" ]] && URL=$(echo "$CONTENT" | grep -oP 'hooks\.slack\.com[^\s"'\'']*' | head -1 || true)
        [[ -z "$URL" ]] && URL=$(echo "$CONTENT" | grep -oP 'example\.com[^\s"'\'']*' | head -1 || true)
        
        if [[ -n "$URL" ]]; then
          NONRUNTIME_URLS+=("$FILE:$LINE_NUM:$URL")
        fi
      fi
    done < <(grep -rn $EXCLUDE_ARGS -E "$PATTERNS" "$dir/" 2>/dev/null | head -200 || true)
  fi
done

echo "  Runtime URLs found: ${#RUNTIME_URLS[@]}"
echo "  Non-runtime URLs found: ${#NONRUNTIME_URLS[@]}"

# Write runtime URLs to text file
{
  echo "# Runtime External URLs (src/**)"
  echo "# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  if [[ ${#RUNTIME_URLS[@]} -eq 0 ]]; then
    echo "No runtime external URL literals detected."
  else
    for entry in "${RUNTIME_URLS[@]}"; do
      echo "$entry"
    done
  fi
} > "$RUNTIME_TXT"

# Write non-runtime URLs to text file
{
  echo "# Non-Runtime External URLs (tests, docs, tools, .github)"
  echo "# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  if [[ ${#NONRUNTIME_URLS[@]} -eq 0 ]]; then
    echo "No non-runtime external URL literals detected."
  else
    for entry in "${NONRUNTIME_URLS[@]}"; do
      echo "$entry"
    done
  fi
} > "$NONRUNTIME_TXT"

# Build JSON arrays
RUNTIME_JSON="[]"
if [[ ${#RUNTIME_URLS[@]} -gt 0 ]]; then
  RUNTIME_JSON=$(printf '%s\n' "${RUNTIME_URLS[@]}" | awk -F: '{print "{\"file\":\""$1"\",\"line\":"$2",\"url\":\""$3"\"}"}' | jq -s .)
fi

NONRUNTIME_JSON="[]"
if [[ ${#NONRUNTIME_URLS[@]} -gt 0 ]]; then
  NONRUNTIME_JSON=$(printf '%s\n' "${NONRUNTIME_URLS[@]}" | awk -F: '{print "{\"file\":\""$1"\",\"line\":"$2",\"url\":\""$3"\"}"}' | jq -s .)
fi

# Write JSON
jq -n \
  --argjson runtime "$RUNTIME_JSON" \
  --argjson nonruntime "$NONRUNTIME_JSON" \
  '{
    generated_at: (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
    runtime_src: $runtime,
    non_runtime: $nonruntime,
    runtime_count: ($runtime | length),
    non_runtime_count: ($nonruntime | length)
  }' > "$OUTPUT_JSON"

# Fail-closed policy: any runtime URLs => FAIL
if [[ ${#RUNTIME_URLS[@]} -gt 0 ]]; then
  echo "FAIL" > "$VERDICT"
  echo ""
  echo "❌ FAIL: Runtime external URL literals detected in src/"
  echo ""
  echo "Found ${#RUNTIME_URLS[@]} runtime URL(s):"
  for entry in "${RUNTIME_URLS[@]}"; do
    echo "  - $entry"
  done
  echo ""
  echo "Remediation:"
  echo "  1. Remove hardcoded external URL literals from src/"
  echo "  2. If external calls are required, use environment/config"
  echo "  3. If URLs are test fixtures, move to tests/"
  echo ""
  echo "Evidence: $RUNTIME_TXT"
  exit 1
fi

echo "PASS" > "$VERDICT"
echo ""
echo "✅ PASS: No runtime external URL literals in src/"
echo "  Evidence: $RUNTIME_TXT"
echo "  Non-runtime refs: $NONRUNTIME_TXT"
exit 0
