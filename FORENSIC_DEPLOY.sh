#!/bin/bash
# FORENSIC BACKBONE: Exact Commands for Deployment & Verification
#
# Copy-paste these commands in order to deploy and verify the forensic framework.
# Each command is labeled with the phase and step for easy tracking.

set -euo pipefail

# ============================================================================
# PHASE 1: VERIFY FORGE AUTHENTICATION (2 minutes)
# ============================================================================

echo "════════════════════════════════════════════════════════════════"
echo "PHASE 1: Verify Forge Authentication"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Step 1.1: Check forge auth
echo "Step 1.1: Check forge authentication..."
cd /workspaces/Firsttry/atlassian/forge-app
forge whoami
echo ""
echo "Expected: Email, Tenant, and other fields"
echo "If not authenticated, run: forge login"
echo ""

# Step 1.2: Verify app installation
echo "Step 1.2: Verify app installation in production..."
forge install list --environment production
echo ""
echo "Expected: App ID, Version 2.14.0, Status: installed"
echo ""
echo "✅ PHASE 1 COMPLETE"
echo ""

# ============================================================================
# PHASE 2: BUILD & DEPLOY (5 minutes)
# ============================================================================

echo "════════════════════════════════════════════════════════════════"
echo "PHASE 2: Build & Deploy to Production"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Step 2.1: Run all tests
echo "Step 2.1: Running all tests..."
cd /workspaces/Firsttry/atlassian/forge-app
npm test
echo ""
echo "Expected: Test Files 118 passed | Tests 1464 passed"
echo ""

# Step 2.2: Build gadget
echo "Step 2.2: Building gadget UI..."
npm run build
echo ""
echo "Expected: ✓ 79 modules transformed ✓ built in ~450ms"
echo ""

# Step 2.3: Deploy to production
echo "Step 2.3: Deploying to Forge production..."
forge deploy --environment production
echo ""
echo "Expected: ✓ App deployed successfully"
echo ""

# Step 2.4: Upgrade installation
echo "Step 2.4: Upgrading installation to new version..."
forge install --upgrade --environment production
echo ""
echo "Expected: ✓ Installation upgraded"
echo ""

# Step 2.5: Verify deployment
echo "Step 2.5: Verifying deployment..."
forge install list --environment production
echo ""
echo "Expected: Version updated, Status: installed"
echo ""
echo "✅ PHASE 2 COMPLETE"
echo ""

# ============================================================================
# PHASE 3: TEST IN JIRA (5 minutes)
# ============================================================================

echo "════════════════════════════════════════════════════════════════"
echo "PHASE 3: Test Probe in Jira (Manual)"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "INSTRUCTIONS (Do these manually in browser):"
echo ""
echo "1. Open: https://<your-site>.atlassian.net"
echo "2. Go to dashboard with Firsttry gadget"
echo "3. Hard refresh: Ctrl+F5 (or Cmd+Shift+R on Mac)"
echo "4. Scroll to 'FORENSIC_PROBE' section"
echo "5. Click blue 'Run Probe' button"
echo "6. Wait for ✅ PROBE SUCCESS (< 2 seconds)"
echo "7. Copy value from PROOF LINES section:"
echo "   PROBE_GREP_NONCE=probe_..."
echo "   (Save this value in terminal below)"
echo ""
echo "Press ENTER when you have the nonce value..."
read -p "Nonce (press ENTER to continue): " NONCE_VALUE

if [ -z "$NONCE_VALUE" ]; then
  echo "❌ Nonce not provided. Aborting."
  exit 2
fi

echo ""
echo "Nonce saved: $NONCE_VALUE"
echo "✅ PHASE 3 COMPLETE"
echo ""

# ============================================================================
# PHASE 4: EXECUTE PROOF VERIFICATION (2 minutes)
# ============================================================================

echo "════════════════════════════════════════════════════════════════"
echo "PHASE 4: Verify Proof (Automated)"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo "Step 4.1: Waiting 30 seconds for logs to propagate..."
sleep 30
echo "✓ Done waiting"
echo ""

echo "Step 4.2: Running proof verification script..."
cd /workspaces/Firsttry
bash tools/probe_prod.sh --nonce "$NONCE_VALUE" --minutes 30

RESULT=$?

echo ""

if [ $RESULT -eq 0 ]; then
  echo "════════════════════════════════════════════════════════════════"
  echo "✅ PROOF VERIFIED"
  echo "════════════════════════════════════════════════════════════════"
  echo ""
  echo "PROOF COMPLETE!"
  echo ""
  echo "This proves:"
  echo "  ✓ UI successfully invoked probe resolver"
  echo "  ✓ Backend generated unique nonce"
  echo "  ✓ Backend logged nonce to production logs"
  echo "  ✓ Forge captured logs in production environment"
  echo "  ✓ Nonce found in logs (binary match, not assumption)"
  echo ""
  echo "Deployment successful! 🎉"
  echo ""
  echo "Next steps:"
  echo "  1. Archive evidence: ls -lh /tmp/ft_probe_<latest>/"
  echo "  2. Document in compliance records"
  echo "  3. Schedule quarterly re-validation"
  echo ""
  exit 0
else
  echo "════════════════════════════════════════════════════════════════"
  echo "❌ PROOF FAILED"
  echo "════════════════════════════════════════════════════════════════"
  echo ""
  echo "Nonce NOT found in production logs."
  echo ""
  echo "Next step: Generate forensic diagnosis report"
  echo ""
  
  # Auto-run diagnostic
  echo "Generating diagnostic report..."
  cd /workspaces/Firsttry
  bash tools/forensic_report.sh --nonce "$NONCE_VALUE" --minutes 30
  
  echo ""
  echo "Open FORENSIC_CHECK_REPORT.md and follow the diagnosis:"
  echo "  open /workspaces/Firsttry/FORENSIC_CHECK_REPORT.md"
  echo ""
  echo "Diagnosis will tell you which branch (A/B/C/D) applies:"
  echo "  A) Logs are empty (auth/env problem)"
  echo "  B) Logs captured but no PROBE markers (resolver not invoked)"
  echo "  C) Plain-text markers missing (logging issue)"
  echo "  D) Markers present but nonce not in window (timing issue)"
  echo ""
  exit 2
fi
