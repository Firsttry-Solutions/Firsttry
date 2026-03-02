#!/usr/bin/env bash
# build_docs_site_offline.sh
# Verify all internal links resolve in docs/ structure (fail-closed)
set -euo pipefail

# SELFTEST MODE
if [[ "${FT_LINKCHECK_SELFTEST:-0}" == "1" ]]; then
  echo "[SELFTEST] Running link checker self-test..."
  TEMP_SITE=$(mktemp -d)
  trap "rm -rf $TEMP_SITE" EXIT
  
  mkdir -p "$TEMP_SITE"
  echo "# Test Doc A" > "$TEMP_SITE/a.md"
  echo "[Valid link](b.md)" >> "$TEMP_SITE/a.md"
  echo "[Broken link](missing.md)" >> "$TEMP_SITE/a.md"
  echo "# Test Doc B" > "$TEMP_SITE/b.md"
  
  BROKEN_COUNT=0
  while IFS= read -r MD_FILE; do
    while IFS= read -r LINK; do
      [[ "$LINK" =~ ^https?:// ]] && continue
      [[ "$LINK" =~ ^mailto: ]] && continue
      LINK_PATH="${LINK%%#*}"
      [[ -z "$LINK_PATH" ]] && continue
      LINK_DIR=$(dirname "$MD_FILE")
      TARGET="$LINK_DIR/$LINK_PATH"
      if [[ ! -f "$TARGET" ]] && [[ ! -d "$TARGET" ]]; then
        BROKEN_COUNT=$((BROKEN_COUNT + 1))
      fi
    done < <(grep -oP '\[([^\]]+)\]\(([^)]+)\)' "$MD_FILE" | sed -E 's/.*\(([^)]+)\).*/\1/' || true)
  done < <(find "$TEMP_SITE" -name "*.md" -type f)
  
  if [[ $BROKEN_COUNT -eq 1 ]]; then
    echo "✅ SELFTEST PASS (detected 1 broken link as expected)"
    exit 0
  else
    echo "❌ SELFTEST FAIL (expected 1 broken link, got $BROKEN_COUNT)"
    exit 1
  fi
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"

# Evidence directory
E="${1:-/tmp/ft_marketplace_phase3_5_latest}"
if [[ ! -d "$E" ]]; then
  E="/tmp/ft_marketplace_phase3_5_latest"
fi
E=$(readlink -f "$E" 2>/dev/null || echo "$E")

SITE_DIR="$E/05_links/site"
REPORT="$E/05_links/link_report.txt"
VERDICT="$E/05_links/VERDICT.txt"

# Create evidence directory
mkdir -p "$E/05_links"

echo "[LINKABILITY] Building offline docs site..."

cd "$REPO_ROOT"

# Fail-closed: verify docs exists at repo root
if [[ ! -d "$REPO_ROOT/docs" ]]; then
  echo "FAIL" > "$VERDICT"
  echo "❌ FAIL: docs/ not found at $REPO_ROOT/docs"
  exit 1
fi

# Copy docs to site dir
mkdir -p "$SITE_DIR"
cp -r "$REPO_ROOT/docs/"* "$SITE_DIR/"
echo "  Copied docs/ to $SITE_DIR"

echo "  Checking internal links..."

BROKEN_LINKS=()
ANCHOR_WARNINGS=()
CHECKED_COUNT=0

# Helper: normalize path without requiring existence
normalize_path() {
  local path="$1"
  # Remove ./ occurrences
  path="${path//\/.\//\/}"
  # Handle ../ by manual traversal (simple case)
  while [[ "$path" =~ /[^/]+/\.\./  ]]; do
    path=$(echo "$path" | sed 's|/[^/]*/\.\./|/|')
  done
  echo "$path"
}

# Find all markdown files
while IFS= read -r MD_FILE; do
  REL_PATH="${MD_FILE#$SITE_DIR/}"
  MD_DIR="$(dirname "$MD_FILE")"
  
  # Extract markdown links: [text](path) or [text](path#anchor)
  while IFS= read -r LINK; do
    # Skip external links (http://, https://, mailto:)
    if [[ "$LINK" =~ ^https?:// ]] || [[ "$LINK" =~ ^mailto: ]]; then
      continue
    fi
    
    # Skip pure anchors
    if [[ "$LINK" =~ ^# ]]; then
      continue
    fi
    
    # Split link from anchor
    LINK_FILE="${LINK%%#*}"
    ANCHOR="${LINK#*#}"
    [[ "$ANCHOR" == "$LINK" ]] && ANCHOR=""
    
    # Skip empty links
    [[ -z "$LINK_FILE" ]] && continue
    
    # Resolve path relative to SITE_DIR
    if [[ "$LINK_FILE" =~ ^/ ]]; then
      # Absolute link (relative to site root)
      TARGET="$SITE_DIR$LINK_FILE"
    else
      # Relative to current file
      TARGET="$MD_DIR/$LINK_FILE"
    fi
    
    # Normalize path
    TARGET=$(normalize_path "$TARGET")
    
    # Guard: ensure target is within SITE_DIR
    if [[ "$TARGET" != "$SITE_DIR/"* ]]; then
      BROKEN_LINKS+=("$REL_PATH -> $LINK_FILE (escapes site directory)")
      CHECKED_COUNT=$((CHECKED_COUNT + 1))
      continue
    fi
    
    # Check file existence (fail-closed)
    CHECKED_COUNT=$((CHECKED_COUNT + 1))
    TARGET_EXISTS=0
    
    if [[ -f "$TARGET" ]] || [[ -d "$TARGET" ]]; then
      TARGET_EXISTS=1
    elif [[ ! "$LINK_FILE" =~ \.md$ ]] && [[ -f "$TARGET.md" ]]; then
      # Handle markdown shorthand: link without .md extension
      TARGET="$TARGET.md"
      TARGET_EXISTS=1
    elif [[ "$LINK_FILE" =~ /$ ]] && [[ -f "$TARGET/index.md" ]]; then
      # Handle directory index: link/ -> link/index.md
      TARGET="$TARGET/index.md"
      TARGET_EXISTS=1
    fi
    
    if [[ $TARGET_EXISTS -eq 0 ]]; then
      BROKEN_LINKS+=("$REL_PATH -> $LINK_FILE (not found)")
      continue
    fi
    
    # Anchor check (WARNING ONLY, not fail-closed)
    if [[ -n "$ANCHOR" ]] && [[ -f "$TARGET" ]]; then
      # GitHub anchor format: lowercase, spaces -> -, strip punctuation
      NORMALIZED_ANCHOR=$(echo "$ANCHOR" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g')
      
      # Search for heading (# Heading, ## Heading, etc.)
      HEADING_TEXT="${ANCHOR//-/ }"
      if ! grep -qi "^#.* $HEADING_TEXT" "$TARGET"; then
        ANCHOR_WARNINGS+=("$REL_PATH -> $LINK_FILE#$ANCHOR (anchor not found)")
      fi
    fi
done < <(grep -oP '\[([^\]]+)\]\(([^)]+)\)' "$MD_FILE" | sed -E 's/.*\(([^)]+)\).*/\1/' || true)
done < <(find "$SITE_DIR" -name "*.md" -type f)

# Write report
{
  echo "# Offline Docs Link Report"
  echo "# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  echo "Links checked: $CHECKED_COUNT"
  echo "Broken links: ${#BROKEN_LINKS[@]}"
  echo "Anchor warnings: ${#ANCHOR_WARNINGS[@]}"
  echo ""
  
  if [[ ${#BROKEN_LINKS[@]} -gt 0 ]]; then
    echo "## Broken Links"
    echo ""
    for link in "${BROKEN_LINKS[@]}"; do
      echo "- $link"
    done
    echo ""
  fi
  
  if [[ ${#ANCHOR_WARNINGS[@]} -gt 0 ]]; then
    echo "## Anchor Warnings"
    echo ""
    for warning in "${ANCHOR_WARNINGS[@]}"; do
      echo "- $warning"
    done
    echo ""
  fi
  
  if [[ ${#BROKEN_LINKS[@]} -eq 0 ]]; then
    echo "✅ All links valid"
  fi
} > "$REPORT"

if [[ ${#BROKEN_LINKS[@]} -gt 0 ]]; then
  echo "FAIL" > "$VERDICT"
  echo ""
  echo "❌ FAIL: ${#BROKEN_LINKS[@]} broken link(s) detected"
  echo ""
  head -20 < <(printf '%s\n' "${BROKEN_LINKS[@]}")
  echo ""
  echo "Report: $REPORT"
  exit 1
fi

echo "PASS" > "$VERDICT"
echo ""
echo "✅ PASS: All links valid ($CHECKED_COUNT checked)"
if [[ ${#ANCHOR_WARNINGS[@]} -gt 0 ]]; then
  echo "  ⚠️  ${#ANCHOR_WARNINGS[@]} anchor warning(s) (non-fatal)"
fi
echo "  Report: $REPORT"
exit 0
