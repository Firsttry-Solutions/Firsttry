#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

fail(){ echo "FAIL: $*" >&2; exit 1; }

for c in rg git bash sed python3; do command -v "$c" >/dev/null || fail "missing cmd: $c"; done

echo "=== VALIDATE_DOCS: Check required files ==="

REQ=(
  "docs/VENDOR_FACTS.yml"
  "docs/PRIVACY_POLICY.md"
  "docs/TERMS_OF_SERVICE.md"
  "docs/DATA_FLOW.md"
  "docs/PERMISSIONS_AND_SCOPES.md"
  "docs/SECURITY_CONTACT.md"
  "docs/VULNERABILITY_MANAGEMENT.md"
  "docs/INCIDENT_RESPONSE.md"
  "docs/SUBPROCESSORS.md"
  "docs/DATA_RETENTION_AND_DELETION.md"
  "docs/ENTERPRISE_SECURITY_PACKET.md"
  "docs/SUPPORT_POLICY.md"
  "docs/CHANGE_MANAGEMENT.md"
  "docs/ROADMAP.md"
)

for f in "${REQ[@]}"; do 
  if [ ! -f "$f" ]; then
    fail "missing required doc: $f"
  fi
done
echo "✅ All required docs present"

echo ""
echo "=== Check for placeholders ==="
if rg -n "REPLACE_WITH_|TODO|TBD" docs -S >/dev/null; then
  rg -n "REPLACE_WITH_|TODO|TBD" docs -S || true
  fail "placeholders found in docs/"
fi
echo "✅ No placeholders"

echo ""
echo "=== Check required headings ==="

req_heading(){
  local file="$1"; shift
  for h in "$@"; do
    if ! rg -n "^\s*##\s+$h\s*$" "$file" >/dev/null; then
      fail "missing heading '$h' in $file"
    fi
  done
}

req_heading docs/PRIVACY_POLICY.md \
  "Who We Are" "Data We Access" "Data We Collect" "Data We Store" "Data Sharing" "Data Retention & Deletion" "Security" "User Rights & Requests" "Changes"

req_heading docs/PERMISSIONS_AND_SCOPES.md \
  "Forge Manifest" "Declared Scopes (List EXACT)" "Least Privilege Rationale"

req_heading docs/ENTERPRISE_SECURITY_PACKET.md \
  "1) Product Summary" "2) Access & Permissions" "3) Data Handling" "4) Security Operations" "5) Subprocessors" "6) Support & Change Management" "7) Evidence Pack"

echo "✅ All required headings present"

echo ""
echo "=== Manifest consistency checks ==="

MANIFESTS="$(find . -maxdepth 8 -name manifest.yml -print 2>/dev/null | sort || true)"
if echo "$MANIFESTS" | rg -q "^\./atlassian/forge-app/manifest\.yml$"; then
  MANIFEST="./atlassian/forge-app/manifest.yml"
else
  COUNT="$(echo "$MANIFESTS" | sed '/^\s*$/d' | wc -l | tr -d ' ')"
  if [ "$COUNT" -ne 1 ]; then
    fail "expected 1 manifest.yml or canonical ./atlassian/forge-app/manifest.yml; found $COUNT"
  fi
  MANIFEST="$(echo "$MANIFESTS" | head -1)"
fi
FORGE_ROOT="$(dirname "$MANIFEST")"
echo "Using manifest: $MANIFEST"

STORAGE_HITS="$(rg -n "storage\.(get|set|delete|query)|from '@forge/api'|@forge/api" "$FORGE_ROOT" -S 2>/dev/null || true)"
NETWORK_HITS="$(rg -n "fetch\(|axios|node-fetch|request\(|https\.request|http\.request" "$FORGE_ROOT" -S 2>/dev/null || true)"

# Check for contradictions
PRIV_NO_STORE="$(rg -n "store no|do not store|no customer data stored|we do not store" docs/PRIVACY_POLICY.md -S 2>/dev/null || true)"
if [[ -n "$PRIV_NO_STORE" && -n "$STORAGE_HITS" ]]; then
  echo "--- PRIVACY CLAIM (no storage) ---"
  echo "$PRIV_NO_STORE"
  echo "--- STORAGE HITS (actual code) ---"
  echo "$STORAGE_HITS"
  fail "contradiction: privacy claims no storage but code indicates storage usage"
fi

SUBP_NONE="$(rg -n "^\s*##\s*Current Subprocessors\s$|-\s*None\s*$|Subprocessors:\s*None" docs/SUBPROCESSORS.md -S 2>/dev/null || true)"
DATAFLOW_EGRESS="$(rg -n "Outbound|Egress|External|Network|fetch|Third-Party" docs/DATA_FLOW.md -S 2>/dev/null || true)"
if [[ -n "$SUBP_NONE" && -n "$NETWORK_HITS" && -z "$DATAFLOW_EGRESS" ]]; then
  echo "--- SUBPROCESSORS (claims none) ---"
  echo "$SUBP_NONE"
  echo "--- NETWORK HITS (actual code) ---"
  echo "$NETWORK_HITS"
  fail "contradiction: subprocessors says none, but code indicates network calls and DATA_FLOW does not describe egress"
fi

echo "✅ No contradictions"
echo ""
echo "✅ VALIDATE_DOCS: PASSED"
