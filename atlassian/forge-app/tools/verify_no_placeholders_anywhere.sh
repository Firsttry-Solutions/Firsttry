#!/bin/bash
# Gate: Verify no placeholder emails remain in docs and source
set -euo pipefail

echo "Gate: verify:no-placeholders"
echo "==============================="

# Search only in docs and src (not tools where gate scripts live)
# Exclude shell scripts and compiled/archived files
if grep -r "SUPPORT_EMAIL_HERE\|SECURITY_EMAIL_HERE\|PRIVACY_EMAIL_HERE\|YOURDOMAIN\.com" \
  docs src --exclude-dir=node_modules --exclude-dir=dist \
  --exclude="*.sh" --exclude="*.tar.gz" 2>/dev/null | grep -v node_modules; then
  echo "✗ GATE FAILED: Placeholder emails still present"
  exit 1
fi

echo "✓ OK: No placeholder emails found"
exit 0
