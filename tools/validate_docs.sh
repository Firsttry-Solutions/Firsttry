#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

fail(){ echo "FAIL: $*" >&2; exit 1; }

for c in rg git bash sed python3; do command -v "$c" >/dev/null || fail "missing cmd: $c"; done

echo "=== VALIDATE_DOCS: Check Gate 1+2 required files ==="

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
echo "=== Check for placeholders in Gate 1+2 docs only ==="
if rg -n "REPLACE_WITH_|TODO|TBD" docs/VENDOR_FACTS.yml docs/PRIVACY_POLICY.md docs/TERMS_OF_SERVICE.md docs/DATA_FLOW.md docs/PERMISSIONS_AND_SCOPES.md docs/SECURITY_CONTACT.md docs/VULNERABILITY_MANAGEMENT.md docs/INCIDENT_RESPONSE.md docs/SUBPROCESSORS.md docs/DATA_RETENTION_AND_DELETION.md docs/ENTERPRISE_SECURITY_PACKET.md docs/SUPPORT_POLICY.md docs/CHANGE_MANAGEMENT.md docs/ROADMAP.md -S >/dev/null 2>&1; then
  rg -n "REPLACE_WITH_|TODO|TBD" docs/VENDOR_FACTS.yml docs/PRIVACY_POLICY.md docs/TERMS_OF_SERVICE.md docs/DATA_FLOW.md docs/PERMISSIONS_AND_SCOPES.md docs/SECURITY_CONTACT.md docs/VULNERABILITY_MANAGEMENT.md docs/INCIDENT_RESPONSE.md docs/SUBPROCESSORS.md docs/DATA_RETENTION_AND_DELETION.md docs/ENTERPRISE_SECURITY_PACKET.md docs/SUPPORT_POLICY.md docs/CHANGE_MANAGEMENT.md docs/ROADMAP.md -S || true
  fail "placeholders found in Gate 1+2 docs"
fi
echo "✅ No placeholders in Gate 1+2 docs"

echo ""
echo "=== Check required headings ==="

req_heading(){
  local file="$1"; shift
  for h in "$@"; do
    # Exact line matching: grep -F (literal) -x (whole line) ensures no substring false positives
    grep -nFx "## $h" "$file" >/dev/null || fail "missing heading '## $h' in $file"
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
echo "✅ VALIDATE_DOCS: PASSED"

# SOFT_PLACEHOLDER_BANS_BEGIN
# Reject "soft placeholders" that aren't caught by REPLACE_WITH_/TODO/TBD.
# (Skip EVIDENCE_REPRODUCTION.md since it contains these phrases in code examples)
if rg -n "add feature justification|add code reference|must be documented|you MUST list|Auto-populated" docs -S --glob '!EVIDENCE_REPRODUCTION.md' >/dev/null; then
  rg -n "add feature justification|add code reference|must be documented|you MUST list|Auto-populated" docs -S --glob '!EVIDENCE_REPRODUCTION.md' || true
  fail "soft placeholders found in docs (replace with real content)"
fi
# SOFT_PLACEHOLDER_BANS_END
