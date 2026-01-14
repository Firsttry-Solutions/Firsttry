#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

RUN_DIR="/tmp/ft_evidence_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN_DIR"

# Run proof
bash tools/proof_run.sh | tee "$RUN_DIR/00_proof_stdout.txt" || {
  echo "FAIL: proof_run failed; bundle still created for debugging."
}

# Collect key docs
mkdir -p "$RUN_DIR/docs"
for f in \
  docs/ENTERPRISE_REVIEW_START_HERE.md \
  docs/SECURITY_SUMMARY.md \
  docs/PRIVACY.md \
  docs/SCOPES.md \
  docs/SUPPORT_POLICY.md \
  docs/INCIDENT_RESPONSE.md \
  docs/SECURITY_CONTACT.md \
  docs/MARKETPLACE_LISTING_COPY.md \
; do
  [ -f "$f" ] && cp "$f" "$RUN_DIR/docs/" || true
done

# Create bundle
BUNDLE="/tmp/FirstTry_Evidence_Bundle_$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
tar -czf "$BUNDLE" -C "$RUN_DIR" .
echo "BUNDLE=$BUNDLE"
