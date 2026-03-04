#!/bin/bash
# Phase 02: Manifest and Modules Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"

PHASE_ID="PHASE_02_manifest"

PHASE_DIR="$EVIDENCE_DIR/PHASE_02_manifest"
mkdir -p "$PHASE_DIR"

info "Phase 02: Manifest and Modules"

# Find manifest.yml
MANIFEST_PATH="$REPO_ROOT/atlassian/forge-app/manifest.yml"
if [ ! -f "$MANIFEST_PATH" ]; then
  die "manifest.yml not found at expected location: $MANIFEST_PATH"
fi

echo "$MANIFEST_PATH" > "$PHASE_DIR/manifest_path.txt"
ok "Found manifest.yml"

# Validate YAML is parseable (check for tabs first)
if grep -q $'\t' "$MANIFEST_PATH"; then
  phase_fail "manifest.yml contains tab characters (YAML requires spaces)" "$PHASE_DIR/manifest_path.txt"
fi

# Parse manifest with real YAML parser
PARSER_SCRIPT="$SCRIPT_DIR/lib/manifest_parse.mjs"
if [ ! -f "$PARSER_SCRIPT" ]; then
  phase_fail "Manifest parser script not found: $PARSER_SCRIPT" "$PHASE_DIR"
fi

# Check if node is available
if ! command -v node >/dev/null 2>&1; then
  phase_fail "Node.js not found (required for manifest parsing)" "$PHASE_DIR"
fi

# Run parser from forge-app directory - copy script there temporarily so node can resolve yaml module
FORGE_APP_DIR="$REPO_ROOT/atlassian/forge-app"
PARSER_ORIG="$SCRIPT_DIR/lib/manifest_parse.mjs"
PARSER_TEMP="$FORGE_APP_DIR/.manifest_parse_tmp.mjs"

cp "$PARSER_ORIG" "$PARSER_TEMP"

if ! (cd "$FORGE_APP_DIR" && node ".manifest_parse_tmp.mjs" "./manifest.yml") > "$PHASE_DIR/manifest_json.json" 2> "$PHASE_DIR/parser_error.txt"; then
  rm -f "$PARSER_TEMP"
  phase_fail "Manifest YAML parsing failed: $(cat "$PHASE_DIR/parser_error.txt")" "$PHASE_DIR/parser_error.txt"
fi

rm -f "$PARSER_TEMP"
ok "Manifest parsed successfully with real YAML parser"

# Load parsed JSON
if ! MANIFEST_JSON=$(cat "$PHASE_DIR/manifest_json.json"); then
  phase_fail "Failed to read parsed manifest JSON" "$PHASE_DIR/manifest_json.json"
fi

# Extract app ID
APP_ID=$(echo "$MANIFEST_JSON" | grep -o '"appId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "")
if [ -z "$APP_ID" ] || [ "$APP_ID" = "null" ]; then
  phase_fail "manifest.yml missing app.id" "$PHASE_DIR/manifest_json.json"
fi
echo "$APP_ID" > "$PHASE_DIR/app_id.txt"
ok "App ID: $APP_ID"

# Extract scopes count
SCOPES_COUNT=$(echo "$MANIFEST_JSON" | grep -o '"scopes"[[:space:]]*:[[:space:]]*\[' | wc -l || echo 0)
echo "Scopes count: $SCOPES_COUNT" > "$PHASE_DIR/scopes_count.txt"
ok "Scopes: $SCOPES_COUNT declared"

# Extract modules count
MODULES_COUNT=$(echo "$MANIFEST_JSON" | grep -c '"type"[[:space:]]*:' || echo 0)
echo "Modules count: $MODULES_COUNT" > "$PHASE_DIR/modules_count.txt"
if [ "$MODULES_COUNT" -eq 0 ]; then
  warn "No modules found in manifest"
else
  ok "Modules: $MODULES_COUNT declared"
fi

write_section "$REPORT_PATH" "Phase 02: Manifest and Modules - PASS"
echo "- Manifest location: \`$MANIFEST_PATH\`" >> "$REPORT_PATH"
echo "- YAML validation: passed" >> "$REPORT_PATH"
echo "- App ID: present" >> "$REPORT_PATH"
echo "- Modules: validated" >> "$REPORT_PATH"
echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

ok "Phase 02: Manifest and Modules - PASS"
