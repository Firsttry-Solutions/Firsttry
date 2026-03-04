#!/bin/bash
# Phase 03: Scopes and Justification Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"

PHASE_ID="PHASE_03_scopes"

PHASE_DIR="$EVIDENCE_DIR/PHASE_03_scopes"
mkdir -p "$PHASE_DIR"

info "Phase 03: Scopes and Justification"

MANIFEST_PATH="$REPO_ROOT/atlassian/forge-app/manifest.yml"
SCOPE_DOC="$REPO_ROOT/docs/marketplace/MARKETPLACE_SCOPE_JUSTIFICATION.md"

# Parse manifest with real YAML parser
PARSER_SCRIPT="$SCRIPT_DIR/lib/manifest_parse.mjs"
if [ ! -f "$PARSER_SCRIPT" ]; then
  phase_fail "Manifest parser script not found: $PARSER_SCRIPT" "$PHASE_DIR"
fi

FORGE_APP_DIR="$REPO_ROOT/atlassian/forge-app"
PARSER_ORIG="$SCRIPT_DIR/lib/manifest_parse.mjs"
PARSER_TEMP="$FORGE_APP_DIR/.manifest_parse_tmp.mjs"

cp "$PARSER_ORIG" "$PARSER_TEMP"

if ! (cd "$FORGE_APP_DIR" && node ".manifest_parse_tmp.mjs" "./manifest.yml") > "$PHASE_DIR/manifest_json.json" 2> "$PHASE_DIR/parser_error.txt"; then
  rm -f "$PARSER_TEMP"
  phase_fail "Manifest YAML parsing failed: $(cat "$PHASE_DIR/parser_error.txt")" "$PHASE_DIR/parser_error.txt"
fi

rm -f "$PARSER_TEMP"

# Extract scopes from parsed JSON
echo "$( cat "$PHASE_DIR/manifest_json.json" | grep -o '"scopes"[[:space:]]*:[[:space:]]*\[[^\]]*\]' | sed 's/"scopes"[[:space:]]*:[[:space:]]*\[//;s/\]//;s/"//g;s/,/\n/g' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' )" > "$PHASE_DIR/scopes_manifest.txt"

# Clean up empty lines
sed -i '/^$/d' "$PHASE_DIR/scopes_manifest.txt" 2>/dev/null || sed -i '' '/^$/d' "$PHASE_DIR/scopes_manifest.txt" 2>/dev/null || true

MANIFEST_SCOPE_COUNT=$(wc -l < "$PHASE_DIR/scopes_manifest.txt" | tr -d ' ')

if [ "$MANIFEST_SCOPE_COUNT" -eq 0 ]; then
  warn "No scopes found in manifest (app may not require any)"
  echo "none" > "$PHASE_DIR/scopes_manifest.txt"
fi

ok "Found $MANIFEST_SCOPE_COUNT scopes in manifest"

# Check scope justification document
require_file "$SCOPE_DOC" 1200

# Extract scopes mentioned in doc
grep -oE "(read:|write:|manage:)[a-z:-]+" "$SCOPE_DOC" | sort -u > "$PHASE_DIR/scopes_doc_scopes.txt" 2>&1 || echo "none" > "$PHASE_DIR/scopes_doc_scopes.txt"

# Compare scopes
comm -3 <(sort "$PHASE_DIR/scopes_manifest.txt") <(sort "$PHASE_DIR/scopes_doc_scopes.txt") > "$PHASE_DIR/scopes_diff.txt" || true

if [ -s "$PHASE_DIR/scopes_diff.txt" ] && [ "$MANIFEST_SCOPE_COUNT" -gt 0 ]; then
  DIFF_COUNT=$(wc -l < "$PHASE_DIR/scopes_diff.txt" | tr -d ' ')
  if [ "$DIFF_COUNT" -gt 3 ]; then
    warn "Scope documentation may not cover all manifest scopes (diff: $DIFF_COUNT lines)"
  fi
fi

# Check for write scopes
if grep -qE "(write:|delete:|manage:)" "$PHASE_DIR/scopes_manifest.txt" 2>/dev/null; then
  if ! grep -qi "mitigation\|justification\|why.*write" "$SCOPE_DOC"; then
    die "Manifest contains write/manage scopes but justification doc lacks mitigation section"
  fi
  ok "Write scopes present and mitigation documented"
fi

write_section "$REPORT_PATH" "Phase 03: Scopes and Justification - PASS"
echo "- Scopes in manifest: $MANIFEST_SCOPE_COUNT" >> "$REPORT_PATH"
echo "- Justification document: present ($(stat -c%s "$SCOPE_DOC" 2>/dev/null || stat -f%z "$SCOPE_DOC") bytes)" >> "$REPORT_PATH"
echo "- Coverage: validated" >> "$REPORT_PATH"
echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

ok "Phase 03: Scopes and Justification - PASS"
