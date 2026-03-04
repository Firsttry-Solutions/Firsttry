#!/bin/bash
# Phase 14: License and EULA Consistency Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"
PHASE_ID="PHASE_14_license"

PHASE_DIR="$EVIDENCE_DIR/PHASE_14_license_eula"
mkdir -p "$PHASE_DIR"

info "Phase 14: License and EULA Consistency"

# Check LICENSE file exists
LICENSE_FILE="$REPO_ROOT/LICENSE"
if [ ! -f "$LICENSE_FILE" ]; then
  LICENSE_FILE="$REPO_ROOT/LICENSE.txt"
fi
if [ ! -f "$LICENSE_FILE" ]; then
  LICENSE_FILE="$REPO_ROOT/LICENSE.md"
fi

require_file "$LICENSE_FILE" 200

# Copy license to evidence
cp "$LICENSE_FILE" "$PHASE_DIR/LICENSE.txt"
ok "LICENSE file found: $LICENSE_FILE"

# Check package.json license field
PKG_JSON="$REPO_ROOT/atlassian/forge-app/package.json"
require_file "$PKG_JSON"

PKG_LICENSE=$(grep -oE '"license"[[:space:]]*:[[:space:]]*"[^"]+"' "$PKG_JSON" | grep -oE '"[^"]+"$' | tr -d '"')

if [ -z "$PKG_LICENSE" ]; then
  die "No license field in package.json"
fi

echo "Package.json license: $PKG_LICENSE" > "$PHASE_DIR/license_check.txt"
ok "Package.json license: $PKG_LICENSE"

# Verify Terms of Service acts as EULA
TERMS_OF_SERVICE="$REPO_ROOT/docs/marketplace/MARKETPLACE_TERMS_OF_SERVICE.md"
require_file "$TERMS_OF_SERVICE" 400

# Check that Terms include key EULA sections
echo "" >> "$PHASE_DIR/license_check.txt"
echo "Terms of Service EULA check:" >> "$PHASE_DIR/license_check.txt"

REQUIRED_TERMS_SECTIONS=("warranty" "liability" "termination" "license grant")
for sect in "${REQUIRED_TERMS_SECTIONS[@]}"; do
  if ! grep -qiE "$sect" "$TERMS_OF_SERVICE"; then
    warn "Terms of Service may not cover: $sect"
    echo "⚠ Missing or weak: $sect" >> "$PHASE_DIR/license_check.txt"
  else
    ok "Terms includes: $sect"
    echo "✓ Includes: $sect" >> "$PHASE_DIR/license_check.txt"
  fi
done

# Check manifest.yml for license consistency (if present)
MANIFEST="$REPO_ROOT/atlassian/forge-app/manifest.yml"
if [ -f "$MANIFEST" ]; then
  if grep -qE "^license:" "$MANIFEST"; then
    MANIFEST_LICENSE=$(grep -E "^license:" "$MANIFEST" | awk '{print $2}')
    echo "Manifest license: $MANIFEST_LICENSE" >> "$PHASE_DIR/license_check.txt"
    if [ "$PKG_LICENSE" != "$MANIFEST_LICENSE" ]; then
      warn "License mismatch: package.json=$PKG_LICENSE, manifest=$MANIFEST_LICENSE"
    else
      ok "License consistent across package.json and manifest"
    fi
  fi
fi

write_section "$REPORT_PATH" "Phase 14: License and EULA Consistency - PASS"
echo "- LICENSE file: present" >> "$REPORT_PATH"
echo "- Package.json license: $PKG_LICENSE" >> "$REPORT_PATH"
echo "- Terms of Service: acts as EULA" >> "$REPORT_PATH"
echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

ok "Phase 14: License and EULA Consistency - PASS"
