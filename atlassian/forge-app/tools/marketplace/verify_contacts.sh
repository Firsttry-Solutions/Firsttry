#!/usr/bin/env bash
# verify_contacts.sh
# Verify CONTACTS.json is filled with valid emails (fail-closed)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Evidence directory
E="${1:-/tmp/ft_marketplace_phase3_5_latest}"
if [[ ! -d "$E" ]]; then
  E="/tmp/ft_marketplace_phase3_5_latest"
fi
E=$(readlink -f "$E" 2>/dev/null || echo "$E")

CONTACTS_FILE="$REPO_ROOT/docs/trust/CONTACTS.json"
OUTPUT="$E/02_contacts/contacts.json"
VERDICT="$E/02_contacts/VERDICT.txt"

echo "[CONTACTS] Verifying contact information..."

if [[ ! -f "$CONTACTS_FILE" ]]; then
  echo "FAIL" > "$VERDICT"
  echo ""
  echo "❌ FAIL: CONTACTS.json not found"
  echo ""
  echo "Remediation:"
  echo "  Create docs/trust/CONTACTS.json with structure:"
  echo '  {'
  echo '    "support_email": "support@example.com",'
  echo '    "security_email": "security@example.com",'
  echo '    "privacy_email": "privacy@example.com",'
  echo '    "disclosure_email": "security@example.com"'
  echo '  }'
  exit 1
fi

# Read contacts
SUPPORT_EMAIL=$(jq -r '.support_email // ""' "$CONTACTS_FILE")
SECURITY_EMAIL=$(jq -r '.security_email // ""' "$CONTACTS_FILE")
PRIVACY_EMAIL=$(jq -r '.privacy_email // ""' "$CONTACTS_FILE")
DISCLOSURE_EMAIL=$(jq -r '.disclosure_email // ""' "$CONTACTS_FILE")

# Email regex: ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$
EMAIL_REGEX='^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'

FAILURES=()

# Check each email
for field in "support_email:$SUPPORT_EMAIL" "security_email:$SECURITY_EMAIL" "privacy_email:$PRIVACY_EMAIL" "disclosure_email:$DISCLOSURE_EMAIL"; do
  KEY="${field%%:*}"
  VALUE="${field#*:}"
  
  if [[ -z "$VALUE" ]]; then
    FAILURES+=("$KEY is empty")
  elif [[ "$VALUE" =~ (example\.com|TODO|TBD|FIXME) ]]; then
    FAILURES+=("$KEY contains placeholder: $VALUE")
  elif [[ ! "$VALUE" =~ $EMAIL_REGEX ]]; then
    FAILURES+=("$KEY has invalid format: $VALUE")
  fi
done

# Copy contacts to evidence
cp "$CONTACTS_FILE" "$OUTPUT"

if [[ ${#FAILURES[@]} -gt 0 ]]; then
  echo "FAIL" > "$VERDICT"
  echo ""
  echo "❌ FAIL: Contact validation errors"
  echo ""
  for failure in "${FAILURES[@]}"; do
    echo "  - $failure"
  done
  echo ""
  echo "Remediation:"
  echo "  Fill docs/trust/CONTACTS.json with real email addresses."
  echo "  Remove placeholders (example.com, TODO, TBD)."
  echo "  Format: name@domain.tld"
  exit 1
fi

echo "PASS" > "$VERDICT"
echo ""
echo "✅ PASS: All contact emails valid"
echo "  - Support: $SUPPORT_EMAIL"
echo "  - Security: $SECURITY_EMAIL"
echo "  - Privacy: $PRIVACY_EMAIL"
echo "  - Disclosure: $DISCLOSURE_EMAIL"
exit 0
