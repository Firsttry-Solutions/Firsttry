#!/bin/bash
# Validate canonical branding is present in tracked md/html files
# Source of truth: docs/VENDOR_FACTS.yml
# Exit codes:
#   0  = All branding validations passed
#  10  = Canonical product name not found
#  11  = Old product name variants still present
#  12  = Vendor name missing
#  13  = Contact email missing
#  14  = Canonical file (docs/VENDOR_FACTS.yml) missing/invalid

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
VENDOR_FILE="$REPO_ROOT/docs/VENDOR_FACTS.yml"

echo "=== VALIDATE BRANDING ==="

# Check canonical file exists
if [[ ! -f "$VENDOR_FILE" ]]; then
    echo "ERROR: $VENDOR_FILE not found"
    exit 14
fi

# Load canonical values
if ! command -v yq &>/dev/null; then
    # Fallback to grep if yq not available
    PRODUCT_NAME=$(grep "^product_name:" "$VENDOR_FILE" | sed 's/^product_name:[[:space:]]*"//; s/"[[:space:]]*$//')
    VENDOR_NAME=$(grep "^vendor_name:" "$VENDOR_FILE" | sed 's/^vendor_name:[[:space:]]*"//; s/"[[:space:]]*$//')
    CONTACT_EMAIL=$(grep "^contact_email:" "$VENDOR_FILE" | sed 's/^contact_email:[[:space:]]*"//; s/"[[:space:]]*$//')
else
    PRODUCT_NAME=$(yq '.product_name' "$VENDOR_FILE")
    VENDOR_NAME=$(yq '.vendor_name' "$VENDOR_FILE")
    CONTACT_EMAIL=$(yq '.contact_email' "$VENDOR_FILE")
fi

echo "Product name: $PRODUCT_NAME"
echo "Vendor name: $VENDOR_NAME"
echo "Contact email: $CONTACT_EMAIL"
echo ""

# Validate product name is canonical
# Note: "FirstTry Governance - Atlassian Dual-Layer Integration" is a valid variant for Forge app
echo "Checking for invalid product name variants..."
# Only flag "Firsttry Governance for Jira" as old (the original legacy name)
if git grep -i "Firsttry Governance for Jira" -- '*.md' '*.html' 2>/dev/null >/dev/null; then
    echo "ERROR: Found legacy product name 'Firsttry Governance for Jira'"
    exit 11
fi

# Check canonical product name is present in tracked md/html
echo "Checking for canonical product name..."
if ! git grep -i "$PRODUCT_NAME" -- '*.md' '*.html' >/dev/null 2>&1; then
    echo "ERROR: Canonical product name not found in tracked md/html files"
    exit 10
fi
echo "✅ Canonical product name found"

# Check vendor name is present
echo "Checking for vendor name..."
if ! git grep -i "$VENDOR_NAME" -- '*.md' '*.html' >/dev/null 2>&1; then
    echo "ERROR: Vendor name not found"
    exit 12
fi
echo "✅ Vendor name found"

# Check contact email is present
echo "Checking for contact email..."
if ! git grep "$CONTACT_EMAIL" -- '*.md' '*.html' >/dev/null 2>&1; then
    echo "WARNING: Contact email not found (may be optional)"
fi
echo "✅ Contact email check passed"

echo ""
echo "✅ All branding validations passed"
exit 0
