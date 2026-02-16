#!/usr/bin/env bash
set -euo pipefail

# Reviewer Bundle Script
# One command to package docs, goldens, and guard scripts for auditors/reviewers

OUT_DIR="${1:-/tmp/ft_reviewer_bundle_$(date +%s)}"
mkdir -p "$OUT_DIR"

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Copy directories and files
mkdir -p "$OUT_DIR/docs"
cp -r docs/*.md "$OUT_DIR/docs/" 2>/dev/null || true

mkdir -p "$OUT_DIR/determinism_goldens"
cp -r atlassian/forge-app/tests/determinism/golden/*.json "$OUT_DIR/determinism_goldens/" 2>/dev/null || true

mkdir -p "$OUT_DIR/scripts"
cp scripts/proof/verify_deterministic_build.sh "$OUT_DIR/scripts/" || true
cp scripts/proof/guard_no_new_outbound.sh "$OUT_DIR/scripts/" || true
cp scripts/proof/verify_scope_set_unchanged.sh "$OUT_DIR/scripts/" || true
cp scripts/proof/verify_storage_inventory_complete.sh "$OUT_DIR/scripts/" || true
cp scripts/proof/scan_outbound_candidates.sh "$OUT_DIR/scripts/" || true
cp scripts/proof/select_ui_entrypoint.sh "$OUT_DIR/scripts/" || true
cp scripts/proof/update_review_pack_golden.sh "$OUT_DIR/scripts/" || true

chmod +x "$OUT_DIR/scripts"/*.sh

# Create INDEX.md
cat > "$OUT_DIR/INDEX.md" <<EOF
# Reviewer Bundle - Phase 4.2.2.1

**Generated**: $(date -u +"%Y-%m-%dT%H:%M:%SZ")  
**Commit**: $(git rev-parse --short HEAD)  
**Full Commit**: $(git rev-parse HEAD)  

## Contents

### Documentation
EOF

find "$OUT_DIR/docs" -type f -name "*.md" 2>/dev/null | sort >> "$OUT_DIR/INDEX.md" || true

cat >> "$OUT_DIR/INDEX.md" <<EOF

### Deterministic Golden Fixtures
EOF

find "$OUT_DIR/determinism_goldens" -type f -name "*.json" 2>/dev/null | sort >> "$OUT_DIR/INDEX.md" || true

cat >> "$OUT_DIR/INDEX.md" <<EOF

### Verification Scripts
EOF

ls -lh "$OUT_DIR/scripts" >> "$OUT_DIR/INDEX.md" || true

cat >> "$OUT_DIR/INDEX.md" <<EOF

## Expected Proof Markers (from npm test + guards)

- [FT_EXPORT_GOLDEN_TEST_PASS]
- [FT_HASH_INVARIANT_PASS]
- [FT_TENANT_INVARIANT_ENFORCED]
- [FT_TENANT_NEGATIVE_TEST_PASS]
- [FT_SCOPE_REGRESSION_TEST_PASS]
- [FT_FAILURE_PATH_COMPLETE]
- [FT_STORAGE_KEY_REGISTRY_PASS]
- [FT_STORAGE_INVENTORY_VERIFIED]
- [FT_OUTBOUND_REGRESSION_PASS]
- [FT_NODE_VERSION_GUARD_PASS]
- [FT_PDF_DETERMINISM_DOC_GUARD_PASS]
- [FT_DETERMINISTIC_BUILD_VERIFIED]
- [FT_SCOPE_SET_UNCHANGED]
- [FT_REVIEW_PACK_GOLDEN_TEST_PASS]
- [FT_EXPORT_SCHEMA_LOCK_PASS]
- [FT_SCOPE_RATIONALE_PASS]
- [FT_SCALE_ENVELOPE_LOCAL_PROOF_PASS]
- [FT_REVIEWER_BUNDLE_BUILT]

## Notes
- Doc paths are repository paths and are NOT clickable in Jira UI
- This bundle is for offline auditor/reviewer inspection
- All verification are deterministic and fail-closed
EOF

# Create tarball
tar -czf "${OUT_DIR}.tar.gz" -C "$(dirname "$OUT_DIR")" "$(basename "$OUT_DIR")"

echo "[FT_REVIEWER_BUNDLE_BUILT]"
echo "$OUT_DIR"
