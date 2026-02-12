# PHASE 1 ACCESS INTELLIGENCE DASHBOARD GADGET - PRODUCTION DEPLOYMENT GUIDE

## Overview
This document provides production deployment commands and verification procedures for Phase 1 Access Intelligence Engine integration into the Jira Dashboard Gadget.

**Deployment Status**: Ready for Production ✅
- All tests pass
- Build verification gates pass
- Scopes properly configured
- Log markers implemented
- Fail-closed semantics enforced
- Deterministic hashing validated

---

## STEP 6: Production Readiness Checklist

### Code Quality
- [x] TypeScript compilation passes (npx tsc --noEmit)
- [x] Resolvers properly registered (gadget-resolver.ts)
- [x] Manifest function entries correct
- [x] Build verification gates pass (npm run build)
- [x] No compilation warnings or errors

### Functionality
- [x] ft_runAccessIntelligence_v1 resolver implemented
  - Calls Phase 1 engine from /src/access-intelligence/
  - Fetches users (pagination)
  - Fetches projects (pagination)
  - Detects global admins (read-only)
  - Applies toxic rules (deterministic)
  - Computes risk model
  - Persists snapshot with canonical hash

- [x] ft_exportAccessPack_v1 resolver implemented
  - Reads governance snapshot from storage
  - Builds 7-file ZIP structure
  - Computes deterministic ZIP hash
  - Returns download URL with hash
  - Produces deterministic exports (same input = same output)

- [x] Dashboard state updated (ft_getDashboardState_v1)
  - Returns Phase 1 governance snapshots
  - Includes risk tier and counts
  - Marks Phase 1 snapshots as exportEligible=true

- [x] UI buttons added to dashboard
  - "Run Access Review (Phase 1)" button
  - "Export Access Pack" button
  - Event listeners properly wired

### Security & Compliance
- [x] Read-only enforcement (no Jira mutations)
- [x] Fail-closed semantics (any API error → FAILED status)
- [x] No silent degradation (explicit error reasons)
- [x] Production log markers ([FT_ACCESS_*] prefix)
- [x] Deterministic output (canonical hashing)
- [x] Proper scopes declared (storage:app, read:jira-work, read:jira-user)

### Testing
- [x] Integration tests pass (tests/phase1_integration.test.ts)
- [x] Resolver registration verified
- [x] Fail-closed paths tested
- [x] Deterministic hashing validated
- [x] Log marker verification implemented
- [x] Error handling tests pass

---

## STEP 7: Production Deployment Commands

### Pre-Deployment Validation

#### 1. Verify All Code Commits Are in Place
```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Check recent commits
git log --oneline -10

# Expected commits (most recent first):
# 0a1e8d70 STEP 5: Add integration tests for Phase 1 resolvers
# 29864135 STEP 4: Add read:jira-user scope for Phase 1 engine
# 4d8327cd STEP 3: Update dashboard state to include Phase 1 governance snapshots
# aad0930e Phase 1: Wire access intelligence engine into dashboard gadget
```

#### 2. Verify Build Success
```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Run full build pipeline
npm run build 2>&1

# Expected output: "✅ Build succeeded"
# If fails, check:
# - npm run verify:no-unsafe-inline
# - npm run verify:manifest:diag-webtrigger
# - npm run verify:no-tracked-changes
```

#### 3. Verify TypeScript Compilation
```bash
npx tsc --noEmit 2>&1

# Expected: No errors
```

#### 4. Verify Resolver Registration
```bash
grep -n "ft_runAccessIntelligence_v1\|ft_exportAccessPack_v1" \
  atlassian/forge-app/src/gadget-resolver.ts

# Expected output:
# - Import statements: import { handler as ft_runAccessIntelligence_v1_handler }...
# - resolver.define() calls: resolver.define('ft_runAccessIntelligence_v1', ft_runAccessIntelligence_v1_handler);
```

#### 5. Verify Manifest Entries
```bash
grep -A2 "ft-run-access-intelligence-v1-fn\|ft-export-access-pack-v1-fn" \
  atlassian/forge-app/manifest.yml

# Expected output:
# - key: ft-run-access-intelligence-v1-fn
#   handler: gadget-resolver.handler
# - key: ft-export-access-pack-v1-fn
#   handler: gadget-resolver.handler
```

#### 6. Verify Scopes
```bash
grep -A5 "permissions:" atlassian/forge-app/manifest.yml

# Expected output:
# - storage:app
# - read:jira-work
# - read:jira-user
```

---

### Production Deployment

#### 1. Deploy to Production (Forge CLI)
```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Deploy to production environment
forge deploy -e production

# Expected output:
# ✓ Deployment complete
# Your deployment was successful
# Deployment descriptor: <descriptor-id>
```

#### 2. Install/Upgrade on Test Jira Instance
```bash
# Replace SITE_URL and PROJECT_KEY with actual values
# Example: site_url=firsttry.atlassian.net, project=jira

forge install -e production \
  --upgrade \
  -s <SITE_URL> \
  -p jira

# Expected: Installation successful
```

#### 3. Enable Phase 1 Resolvers on Dashboard
- Open Jira dashboard
- Open dashboard configuration
- Add "FirstTry: Audit Evidence for Jira" gadget if not present
- Gadget should show new buttons:
  - "Run Access Review (Phase 1)"
  - "Export Access Pack"

---

### Production Testing & Verification

#### 1. Trigger Phase 1 Access Scan
```bash
# From Jira dashboard UI:
# 1. Click "Run Access Review (Phase 1)" button
# 2. Wait for scan to complete (should show risk tier and counts)
# 3. Verify SUCCESS status is displayed
```

#### 2. Stream Production Logs (Phase 1 Markers)
```bash
# Monitor production logs for Phase 1 markers
forge logs -e production --limit 500 --follow 2>&1 | grep "\[FT_ACCESS_"

# Expected log markers (in order):
# [FT_ACCESS_SCAN_START] - Scan initiates
# [FT_ACCESS_FETCH_USERS] - User enumeration starts
# [FT_ACCESS_FETCH_PROJECTS] - Project enumeration starts
# [FT_ACCESS_DETECT_ADMIN_GROUP] - Admin detection
# [FT_ACCESS_DETECT_EXTERNAL] - External user detection
# [FT_ACCESS_DETECT_PUBLIC_PROJECTS] - Public project detection
# [FT_ACCESS_RULES_APPLIED] - Toxic rules evaluated
# [FT_ACCESS_RISK_COMPUTED] - Risk model computed
# [FT_ACCESS_SCAN_COMPLETE] - Scan finished
```

#### 3. Capture Full Phase 1 Scan Log
```bash
# Capture complete scan log to file
forge logs -e production --limit 300 2>&1 > /tmp/ft_phase1_prod_scan_$(date +%s).log

# Verify log contains Phase 1 markers
grep "\[FT_ACCESS_" /tmp/ft_phase1_prod_scan_*.log

# Expected: All stage markers present
echo "Phase 1 markers found. Log path: $(ls -t /tmp/ft_phase1_prod_scan_*.log | head -1)"
```

#### 4. Test Phase 1 Export (ZIP Generation)
```bash
# From dashboard UI:
# 1. Click "Export Access Pack" button (after successful Phase 1 scan)
# 2. Verify ZIP download starts with filename pattern: access-governance-<hash>.zip
# 3. Verify ZIP contains 7 files:
#    - manifest.json
#    - snapshot.json
#    - access-report.json
#    - risk-summary.json
#    - report-executive.pdf
#    - schema-version.txt
#    - verify.js
```

#### 5. Verify Determinism
```bash
# Run access scan twice (identical data)
# Capture hashes from logs:
# 1. First scan: canonicalHash=abc123def456
# 2. Second scan: canonicalHash=abc123def456 (should match if data unchanged)

# Verify using logs:
forge logs -e production --limit 200 2>&1 | grep "canonicalHash"

# Expected: Same hash for identical input
```

#### 6. Verify Dashboard State Response
```bash
# In browser console on dashboard gadget:
# Inspect network tab:
# Request to: /rest/atlassian/1.0/runtime/invoke/ft_getDashboardState_v1

# Expected response includes Phase 1 snapshot:
# {
#   status: "AVAILABLE",
#   snapshots: [
#     { snapshotKind: "SEED" or "GOVERNANCE", ... },
#     { 
#       snapshotId: "<canonical-hash>",
#       snapshotKind: "GOVERNANCE",
#       phase1: true,
#       scanType: "ACCESS_INTELLIGENCE",
#       riskTier: "HIGH|MEDIUM|LOW",
#       counts: { totalUsers, externalUsers, globalAdmins, ... },
#       exportEligible: true
#     }
#   ]
# }
```

---

### Post-Deployment Monitoring

#### 1. Monitor Error Rates
```bash
# Check for FAILED status Phase 1 scans
forge logs -e production --limit 500 2>&1 | grep "\[FT_ACCESS_SCAN_ERROR\|\[FT_ACCESS_EXPORT_ERROR\]"

# If errors detected, review logs for specific failure reasons
```

#### 2. Monitor Scan Duration
```bash
# Calculate Phase 1 scan duration (from START to COMPLETE markers)
forge logs -e production --limit 300 2>&1 > /tmp/phase1_perf.log

# Typical duration: 2-5 seconds (depends on Jira size)
# If significantly longer, check:
# - Jira API response times
# - User/project count in instance
# - Network latency
```

#### 3. Verify Log Marker Sequence
```bash
# Ensure markers appear in correct order
forge logs -e production --limit 300 2>&1 | grep -o "\[FT_ACCESS_[A-Z_]*\]" | uniq

# Expected order:
# [FT_ACCESS_SCAN_START]
# [FT_ACCESS_FETCH_USERS]
# [FT_ACCESS_FETCH_PROJECTS]
# [FT_ACCESS_DETECT_ADMIN_GROUP]
# [FT_ACCESS_DETECT_EXTERNAL]
# [FT_ACCESS_DETECT_PUBLIC_PROJECTS]
# [FT_ACCESS_RULES_APPLIED]
# [FT_ACCESS_RISK_COMPUTED]
# [FT_ACCESS_SCAN_COMPLETE]
```

---

## Troubleshooting Guide

### Issue: "No governance snapshot found" error
**Cause**: Phase 1 resolver hasn't been run yet or storage is empty
**Solution**: 
```bash
# Click "Run Access Review (Phase 1)" button in dashboard
# Wait for completion
# Then "Export Access Pack" button will work
```

### Issue: Export ZIP has wrong filename format
**Cause**: canonicalHash not computed correctly
**Solution**:
```bash
# Check logs for hash computation
forge logs -e production --limit 50 2>&1 | grep "canonicalHash"

# If missing, re-run access scan to regenerate snapshot
```

### Issue: API call fails with 403 Unauthorized
**Cause**: Scopes not sufficient or permission denied
**Solution**:
```bash
# Verify scopes in manifest
grep -A5 "permissions:" manifest.yml

# Should include: storage:app, read:jira-work, read:jira-user

# If scope was added, must redeploy:
forge deploy -e production
forge install -e production --upgrade -s <SITE_URL> -p jira
```

### Issue: Phase 1 buttons not visible in dashboard
**Cause**: UI not updated or gadget needs refresh
**Solution**:
```bash
# Hard refresh Jira dashboard (Cmd+Shift+R or Ctrl+Shift+R)
# Or reopen dashboard in new tab
# If still not visible, check dashboard gadget bundle:
forge logs -e production --limit 50 2>&1 | grep "gadget"
```

### Issue: ZIP export takes >10 seconds
**Cause**: Large snapshot or network latency
**Solution**:
```bash
# Check snapshot size
forge logs -e production --limit 50 2>&1 | grep "size"

# Typical ZIP size: 50-500KB
# If larger, may indicate snapshot bloat (too many users/projects)
```

---

## Rollback Procedure (if needed)

```bash
# Revert to previous version (before Phase 1 integration)
git revert HEAD~5  # Adjust based on how many commits to revert
git push origin main

# Redeploy previous version
forge deploy -e production

# Or restore from specific commit
git checkout <commit-hash> -- atlassian/forge-app/
npm run build
forge deploy -e production
```

---

## Success Criteria

Phase 1 production deployment is successful when:

✅ Build passes all verification gates
✅ Resolvers are registered and respond to gadget UI
✅ Phase 1 scan completes with [FT_ACCESS_*] markers in logs
✅ Dashboard shows Phase 1 snapshot with risk tier and counts
✅ Export generates deterministic ZIP with correct structure
✅ Same input produces same canonical hash (determinism verified)
✅ No unhandled exceptions (fail-closed semantics working)
✅ UI buttons visible and functional
✅ Scopes properly declared (read:jira-user added)

---

## Version Information

- **Phase 1 Commit**: View with `git log --oneline | grep "Phase 1"`
- **Build Date**: Check with `cat build/buildIdentityBackend.gen.ts`
- **UI Version**: Check browser console for version markers
- **Manifest Version**: Check with `grep "app:" manifest.yml`

---

## Support & Escalation

For production issues:
1. Check Phase 1 resolvers in logs: `forge logs -e production | grep "\[FT_ACCESS_"`
2. Verify dashboard gadget is loading: browser console for errors
3. Check Jira API connectivity: verify user/project enumeration works
4. Review manifest scopes: ensure read:jira-user is present
5. Contact FirstTry support: monitor production.txt for status

---

## Future Enhancements (Post-Phase 1)

- [ ] Add scheduled Phase 1 scans
- [ ] Store historical risk tier trends
- [ ] Create alerts for high-risk transitions
- [ ] Add remediation recommendations
- [ ] Integrate with Jira automation rules
- [ ] Create custom risk scoring rules
- [ ] Add batch export for multiple snapshots
- [ ] Create Phase 1 API endpoint for programmatic access

---

Generated: 2025-02-12 UTC
Phase 1 Integration: Complete ✅
