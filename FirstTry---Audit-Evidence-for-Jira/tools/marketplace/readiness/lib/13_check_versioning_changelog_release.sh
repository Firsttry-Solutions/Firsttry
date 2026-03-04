#!/bin/bash
# Phase 13: Versioning and Changelog Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"
PHASE_ID="PHASE_13_versioning"

PHASE_DIR="$EVIDENCE_DIR/PHASE_13_versioning"
mkdir -p "$PHASE_DIR"

info "Phase 13: Versioning and Changelog"

# Get version from package.json
PKG_JSON="$FORGE_APP_DIR/package.json"
require_file "$PKG_JSON"

VERSION=$(grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]+"' "$PKG_JSON" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)

if [ -z "$VERSION" ]; then
  die "Could not extract version from package.json"
fi

echo "$VERSION" > "$PHASE_DIR/package_version.txt"
ok "Package version: $VERSION"

# Check CHANGELOG.md
CHANGELOG="$REPO_ROOT/CHANGELOG.md"
require_file "$CHANGELOG"

echo "# Changelog Version Check" > "$PHASE_DIR/changelog_version_check.txt"
echo "Package version: $VERSION" >> "$PHASE_DIR/changelog_version_check.txt"
echo "" >> "$PHASE_DIR/changelog_version_check.txt"

# Check if version appears in CHANGELOG
if ! grep -q "$VERSION" "$CHANGELOG"; then
  die "Version $VERSION not found in CHANGELOG.md"
fi
ok "Version $VERSION found in CHANGELOG"
echo "✓ Version $VERSION found in CHANGELOG" >> "$PHASE_DIR/changelog_version_check.txt"

# Check for TODO/TBD in latest entry
if head -50 "$CHANGELOG" | grep -qiE "(TODO|TBD|FIXME)"; then
  die "CHANGELOG contains TODO/TBD/FIXME in recent entries"
fi
ok "No TODO/TBD in CHANGELOG"

# Extract recent changelog entry
echo "" >> "$PHASE_DIR/changelog_version_check.txt"
echo "Recent entries:" >> "$PHASE_DIR/changelog_version_check.txt"
head -30 "$CHANGELOG" >> "$PHASE_DIR/changelog_version_check.txt"

write_section "$REPORT_PATH" "Phase 13: Versioning and Changelog - PASS"
echo "- Package version: $VERSION" >> "$REPORT_PATH"
echo "- CHANGELOG: version present, no TODOs" >> "$REPORT_PATH"
echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

ok "Phase 13: Versioning and Changelog - PASS"
