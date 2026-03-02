#!/usr/bin/env bash
# build_docs_site_offline.sh
# Verify all internal links resolve in docs/ structure (fail-closed)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Evidence directory
E="${1:-/tmp/ft_marketplace_phase3_5_latest}"
if [[ ! -d "$E" ]]; then
  E="/tmp/ft_marketplace_phase3_5_latest"
fi
E=$(readlink -f "$E" 2>/dev/null || echo "$E")

SITE_DIR="$E/05_links/site"
REPORT="$E/05_links/link_report.txt"
VERDICT="$E/05_links/VERDICT.txt"

echo "[LINKABILITY] Building offline docs site..."

cd "$REPO_ROOT"

# Copy docs to site dir
mkdir -p "$SITE_DIR"
if [[ -d "docs" ]]; then
  cp -r docs/* "$SITE_DIR/"
  echo "  Copied docs/ to $SITE_DIR"
else
  echo "FAIL" > "$VERDICT"
  echo "❌ FAIL: docs/ directory not found"
  exit 1
fi

echo "  Checking internal links..."

BROKEN_LINKS=()
CHECKED_COUNT=0

# Find all markdown files
while IFS= read -r MD_FILE; do
  REL_PATH="${MD_FILE#$SITE_DIR/}"
  
  # Extract markdown links: [text](path) or [text](path#anchor)
  while IFS= read -r LINK; do
    # Skip external links (http://, https://, mailto:)
    if [[ "$LINK" =~ ^https?:// ]] || [[ "$LINK" =~ ^mailto: ]]; then
      continue
    fi
    
    # Split link from anchor
    LINK_PATH="${LINK%%#*}"
    ANCHOR="${LINK#*#}"
    [[ "$ANCHOR" == "$LINK" ]] && ANCHOR=""
    
    # Skip empty links
    [[ -z "$LINK_PATH" ]] && continue
    
    # Resolve relative path
    LINK_DIR=$(dirname "$MD_FILE")
    if [[ "$LINK_PATH" =~ ^/ ]]; then
      # Absolute from repo root
      TARGET="$SITE_DIR${LINK_PATH}"
    else
      # Relative to current file
      TARGET="$LINK_DIR/$LINK_PATH"
    fi
    
    # Normalize path
    TARGET=$(readlink -f "$TARGET" 2>/dev/null || echo "$TARGET")
    
    # Check if target exists
    CHECKED_COUNT=$((CHECKED_COUNT + 1))
    if [[ ! -f "$TARGET" ]] && [[ ! -d "$TARGET" ]]; then
      BROKEN_LINKS+=("$REL_PATH -> $LINK_PATH (not found)")
    elif [[ -n "$ANCHOR" ]] && [[ -f "$TARGET" ]]; then
      # Basic anchor check: does heading exist?
      # GitHub anchor format: lowercase, spaces -> -, strip punctuation
      NORMALIZED_ANCHOR=$(echo "$ANCHOR" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g')
      
      # Search for heading (# Heading, ## Heading, etc.)
      HEADING_TEXT="${ANCHOR//-/ }"
      if ! grep -qi "^#.* $HEADING_TEXT" "$TARGET"; then
        BROKEN_LINKS+=("$REL_PATH -> $LINK_PATH#$ANCHOR (anchor not found)")
      fi
    fi
  done < <(grep -oP '\[([^\]]+)\]\(([^)]+)\)' "$MD_FILE" | sed -E 's/\[([^\]]+)\]\(([^)]+)\)/\2/' || true)
done < <(find "$SITE_DIR" -name "*.md" -type f)

# Write report
{
  echo "# Offline Docs Link Report"
  echo "# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  echo "Links checked: $CHECKED_COUNT"
  echo "Broken links: ${#BROKEN_LINKS[@]}"
  echo ""
  if [[ ${#BROKEN_LINKS[@]} -gt 0 ]]; then
    echo "## Broken Links"
    echo ""
    for link in "${BROKEN_LINKS[@]}"; do
      echo "- $link"
    done
  else
    echo "✅ All links valid"
  fi
} > "$REPORT"

if [[ ${#BROKEN_LINKS[@]} -gt 0 ]]; then
  echo "FAIL" > "$VERDICT"
  echo ""
  echo "❌ FAIL: ${#BROKEN_LINKS[@]} broken link(s) detected"
  echo ""
  for link in "${BROKEN_LINKS[@]}"; do
    echo "  - $link"
  done
  echo ""
  echo "Report: $REPORT"
  exit 1
fi

echo "PASS" > "$VERDICT"
echo ""
echo "✅ PASS: All links valid ($CHECKED_COUNT checked)"
echo "  Report: $REPORT"
exit 0
