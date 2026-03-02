#!/usr/bin/env bash
set -euo pipefail

# fix_docs_links_pages_safe.sh
# Automatically fix broken links in docs/ to be Pages-safe (no escaping, no repo refs)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DOCS_ROOT="$REPO_ROOT/docs"

# Link report path (default to latest)
LINK_REPORT="${1:-/tmp/ft_marketplace_phase3_5_latest/05_links/link_report.txt}"

# If report doesn't exist, run checker first
if [[ ! -f "$LINK_REPORT" ]]; then
  echo "[FIX] Link report not found, running checker first..."
  bash "$SCRIPT_DIR/build_docs_site_offline.sh" /tmp/ft_linkcheck_for_fixes
  LINK_REPORT="/tmp/ft_marketplace_phase3_5_latest/05_links/link_report.txt"
fi

if [[ ! -f "$LINK_REPORT" ]]; then
  echo "❌ FAIL: Cannot find link report at $LINK_REPORT"
  exit 1
fi

echo "[FIX] Reading broken links from: $LINK_REPORT"
cd "$REPO_ROOT"

# Ensure generated and stubs directories exist
mkdir -p "$DOCS_ROOT/trust/generated"
mkdir -p "$DOCS_ROOT/trust/stubs"

# Track fixes applied
FIXES_APPLIED=0

# Helper: Create stub doc
create_stub() {
  local stub_path="$1"
  local stub_name="$2"
  local canonical_ref="$3"
  
  mkdir -p "$(dirname "$stub_path")"
  
  cat > "$stub_path" <<EOF
# ${stub_name}

**Status**: Placeholder for Pages linkability

This document is a stub to maintain offline link integrity for GitHub Pages deployment.

**Canonical source**: ${canonical_ref}

**Purpose**: Ensures all documentation links resolve without network access or repository file access.

---

For comprehensive documentation, see:
- [Trust Documentation Index](../README.md)
- [Generated Facts](../generated/README.md)

EOF
  echo "  Created stub: $stub_path"
}

# Parse broken links and apply fixes
echo "[FIX] Parsing broken links..."

# Extract unique broken link entries (skip header lines)
grep -E " -> .* \(" "$LINK_REPORT" | while IFS= read -r line; do
  # Parse: "source_file.md -> target_link (reason)"
  SOURCE_FILE=$(echo "$line" | awk -F ' -> ' '{print $1}' | sed 's/^- //')
  TARGET_LINK=$(echo "$line" | awk -F ' -> ' '{print $2}' | sed 's/ (.*)//')
  REASON=$(echo "$line" | sed 's/.* (\(.*\))/\1/')
  
  SOURCE_PATH="$DOCS_ROOT/$SOURCE_FILE"
  
  # Skip if source doesn't exist
  [[ ! -f "$SOURCE_PATH" ]] && continue
  
  NEW_TARGET=""
  NEEDS_STUB=false
  STUB_PATH=""
  STUB_NAME=""
  
  # RULE 1: Links with "docs/" prefix (wrong - already inside docs/)
  if [[ "$TARGET_LINK" == docs/* ]]; then
    NEW_TARGET="${TARGET_LINK#docs/}"
    echo "  [RULE1] $SOURCE_FILE: docs/$NEW_TARGET -> $NEW_TARGET"
  
  # RULE 2: Parent-directory escapes
  elif [[ "$TARGET_LINK" == ../* ]]; then
    case "$TARGET_LINK" in
      ../SECURITY.md|../SECURITY.md#*)
        NEW_TARGET="trust/generated/security_overview_mirror.md"
        ;;
      ../PRIVACY*.md|../PRIVACY*.md#*)
        NEW_TARGET="trust/generated/privacy_policy_mirror.md"
        ;;
      ../legal/*)
        NEW_TARGET="trust/generated/legal_mirror.md"
        ;;
      ../manifest.yml|../manifest.yml#*)
        NEW_TARGET="trust/generated/manifest_scopes.md"
        ;;
      ../src/*|../tests/*|../tools/*)
        # Extract filename for anchor
        BASENAME=$(basename "$TARGET_LINK" | sed 's/#.*$//')
        SLUG=$(echo "$BASENAME" | tr '[:upper:]' '[:lower:]' | tr '.' '-')
        NEW_TARGET="trust/generated/code_refs_inventory.md#${SLUG}"
        ;;
      *)
        NEW_TARGET="trust/generated/repo_refs.md"
        ;;
    esac
    echo "  [RULE2] $SOURCE_FILE: $TARGET_LINK -> $NEW_TARGET"
  
  # RULE 3: Direct code/legal file references
  elif [[ "$TARGET_LINK" =~ ^(src/|tests/|tools/|legal/) ]]; then
    BASENAME=$(basename "$TARGET_LINK" | sed 's/#.*$//')
    SLUG=$(echo "$BASENAME" | tr '[:upper:]' '[:lower:]' | tr '.' '-')
    NEW_TARGET="trust/generated/code_refs_inventory.md#${SLUG}"
    echo "  [RULE3] $SOURCE_FILE: $TARGET_LINK -> $NEW_TARGET"
  
  # RULE 4: Missing trust docs
  elif [[ "$REASON" == "not found" ]] && [[ "$TARGET_LINK" =~ \.md$ ]]; then
    STUB_NAME=$(basename "$TARGET_LINK" .md)
    STUB_PATH="$DOCS_ROOT/trust/stubs/${STUB_NAME}.md"
    NEW_TARGET="trust/stubs/${STUB_NAME}.md"
    NEEDS_STUB=true
    echo "  [RULE4] $SOURCE_FILE: $TARGET_LINK -> $NEW_TARGET (stub)"
  
  # RULE 5: Absolute paths (/Firsttry/...)
  elif [[ "$TARGET_LINK" == /* ]]; then
    NEW_TARGET="trust/stubs/ABSOLUTE_PATH_REFERENCES.md"
    NEEDS_STUB=true
    STUB_PATH="$DOCS_ROOT/$NEW_TARGET"
    STUB_NAME="Absolute Path References"
    echo "  [RULE5] $SOURCE_FILE: $TARGET_LINK -> $NEW_TARGET"
  fi
  
  # Apply fix if we have a new target
  if [[ -n "$NEW_TARGET" ]]; then
    # Create stub if needed
    if [[ "$NEEDS_STUB" == true ]] && [[ ! -f "$STUB_PATH" ]]; then
      create_stub "$STUB_PATH" "$STUB_NAME" "Repository context (not available in Pages deployment)"
    fi
    
    # Escape special characters for sed
    TARGET_ESC=$(echo "$TARGET_LINK" | sed 's/[]\/$*.^[]/\\&/g')
    NEW_TARGET_ESC=$(echo "$NEW_TARGET" | sed 's/[\/&]/\\&/g')
    
    # Replace in source file
    if grep -qF "]($TARGET_LINK)" "$SOURCE_PATH" 2>/dev/null; then
      sed -i "s|]($TARGET_ESC)|]($NEW_TARGET_ESC)|g" "$SOURCE_PATH"
      FIXES_APPLIED=$((FIXES_APPLIED + 1))
    fi
  fi
done

echo ""
echo "✅ Applied $FIXES_APPLIED link fixes"
echo ""
echo "Next steps:"
echo "  1. Regenerate trust facts: bash tools/marketplace/regenerate_trust_facts.sh"
echo "  2. Re-run link checker: bash tools/marketplace/build_docs_site_offline.sh /tmp/ft_linkcheck_verify"
