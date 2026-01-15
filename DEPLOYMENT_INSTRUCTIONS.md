# Deployment Instructions — Option A Fix

**Status:** Code ready for production deployment  
**Last Verified:** January 15, 2026  
**Build Status:** ✅ Clean (437ms, no errors)  
**Test Status:** ✅ 1299/1299 passing  
**Git Commit:** 78190a50 (main branch)

---

## Prerequisites

Before deploying, ensure:

1. **Atlassian API Token Available**
   ```bash
   export FORGE_USER_TOKEN=<your-atlassian-api-token>
   export FORGE_USER_NAME=<your-atlassian-email>
   ```
   (See: https://go.atlassian.com/dac/platform/forge/getting-started/#log-in-with-an-atlassian-api-token)

2. **Forge CLI Logged In**
   ```bash
   forge login
   ```
   Or login via environment variables (above)

3. **Working Directory**
   ```bash
   cd /workspaces/Firsttry/atlassian/forge-app
   ```

---

## Deployment Steps

### Step 1: Deploy to Production

```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Deploy to production environment
forge deploy -e production
```

**Expected Output:**
```
Deploying to environment production...
✓ Deployment complete
```

**What This Does:**
- Bundles the gadget (Vite build)
- Uploads JavaScript, CSS, HTML to Forge platform
- Registers new app version
- Makes available to all Jira Cloud instances using this app

### Step 2: Upgrade All Installations

```bash
forge install --upgrade -e production
```

**Expected Output:**
```
Installing app in production...
✓ Installation complete
```

**What This Does:**
- Updates all Jira Cloud instances to use new version
- Gadget becomes immediately available
- Users will see operational status with correct data (no silent zeros)

---

## Verification After Deployment

### 1. **Open Jira Dashboard**
   - Navigate to your Jira Cloud instance
   - Open dashboard with Operational Governance Status gadget
   - Expected: Status renders without UNEXPECTED_ERROR crash

### 2. **Test Export Function**
   - Open Governance Status gadget
   - Click "Export Status" button
   - Save exported JSON
   - Verify export contains:
     - `operationalMetrics` object with values or nulls
     - `unknownMetrics` array (if any fields are missing)
     - `boundaries` object with values or nulls
     - `unknownBoundaries` array (if any fields are missing)

### 3. **Verify No Silent Zeros**
   ```json
   // Expected (GOOD): null for unknown, explicit marking
   {
     "operationalMetrics": {
       "checksCompletedLifetime": null,
       "snapshotCountRetained": null,
       "daysContinuousOperation": null
     },
     "unknownMetrics": ["checksCompletedLifetime", "snapshotCountRetained", "daysContinuousOperation"]
   }
   
   // NOT Expected (BAD - would be silent data loss)
   {
     "operationalMetrics": {
       "checksCompletedLifetime": 0,
       "snapshotCountRetained": 0,
       "daysContinuousOperation": 0
     }
   }
   ```

### 4. **Verify Metrics When Available**
   If operational data is available, export should show real values:
   ```json
   {
     "operationalMetrics": {
       "checksCompletedLifetime": 42,
       "snapshotCountRetained": 15,
       "daysContinuousOperation": 90
     },
     "unknownMetrics": []  // or omitted if all known
   }
   ```

---

## Rollback Plan

If issues occur after deployment:

```bash
# Identify previous version
forge list-environments

# Deploy previous working version (if tag exists)
git checkout <previous-tag>
cd atlassian/forge-app
forge deploy -e production
```

**Note:** Keep previous successful version tags for quick rollback:
```bash
git tag -a v1.0.0-export-contract-fix -m "Option A: Silent data loss fix"
git push origin v1.0.0-export-contract-fix
```

---

## Monitoring

### Check Logs After Deployment

```bash
# View recent logs
forge logs -e production --limit 50
```

### Monitor for Errors

Expected to see NO more of:
- `UNEXPECTED_ERROR` in gadget rendering
- Silent zeros in operational metrics exports
- Unhandled null reference errors

Expected to see:
- Clean exports with explicit unknown marking
- Successful gadget renders on all dashboard instances

---

## Success Criteria

✅ **Deployment Successful When:**

1. `forge deploy -e production` completes without error
2. `forge install --upgrade -e production` completes without error
3. Gadget renders on Jira dashboard without UNEXPECTED_ERROR
4. Export function outputs `null` for unknown fields (not 0/false)
5. Export payloads include `unknownMetrics`/`unknownBoundaries` arrays
6. No regression in other dashboard features

✅ **All Verified Locally:**

- ✓ Build: 437ms, clean, no warnings
- ✓ Tests: 1299/1299 passing
- ✓ Code review: TypeScript strict mode, no "as any"
- ✓ Type safety: Full contract enforcement
- ✓ Backward compat: Legacy fields still supported
- ✓ Documentation: DASHBOARD_EXPORT_CONTRACT_PROOF.md

---

## Troubleshooting

### Issue: "Not logged in" error

**Solution:**
```bash
# Option 1: Interactive login
forge login

# Option 2: Use environment variables
export FORGE_USER_TOKEN=<api-token>
export FORGE_USER_NAME=<email>
forge deploy -e production
```

### Issue: Gadget still shows old behavior after upgrade

**Possible causes:**
1. Browser cache not cleared
   - Clear browser cache or open in private/incognito window
2. Installation not updated
   - Run `forge install --upgrade -e production` again
3. Deployment incomplete
   - Check `forge logs -e production` for errors

### Issue: Export shows new format in some instances, old in others

**Expected for time period after deployment** (eventual consistency)
- Wait 5-10 minutes for all Forge CDN caches to update
- All instances should converge to new format

---

## Deployment Timeline

| Step | Duration | Status |
|------|----------|--------|
| Code changes | ✅ Complete | Ready |
| Testing | ✅ Complete | 1299/1299 pass |
| Build | ✅ Complete | 437ms, clean |
| Commit | ✅ Complete | 78190a50 on main |
| Documentation | ✅ Complete | DASHBOARD_EXPORT_CONTRACT_PROOF.md |
| Deploy to prod | ⏳ Pending | Requires API token |
| Verify in live | ⏳ Pending | Post-deployment |
| Generate proof | ⏳ Pending | Final report |

---

## Support

If deployment issues occur:

1. Check forge logs: `forge logs -e production --limit 100`
2. Review DASHBOARD_EXPORT_CONTRACT_PROOF.md for design rationale
3. Check TypeScript errors: `npm run build`
4. Run tests locally: `npm test`

All tests and build are verified working in pre-deployment validation.

---

**Ready to deploy!** 🚀

Run:
```bash
cd /workspaces/Firsttry/atlassian/forge-app
forge deploy -e production && forge install --upgrade -e production
```
