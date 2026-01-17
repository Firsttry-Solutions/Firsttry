# FORENSIC BACKBONE: Quick Deployment Reference

> **Status:** ✅ Ready for Production  
> **Tests:** 1464 passing  
> **Build:** 456ms, 79 modules, 0 errors  
> **Deployment Time:** ~15-20 minutes total

---

## PRE-DEPLOYMENT CHECKLIST (Local)

- [x] All 1464 tests pass (`npm test`)
- [x] Gadget builds in 456ms (79 modules)
- [x] forensic_report.sh syntax valid
- [x] probe_prod.sh syntax valid
- [x] probe.ts contains PROBE_ENTRY/PROBE_OK/PROBE_ERR markers
- [x] UI runProbe() function properly wired
- [x] HTML widget has probe button and response panel

---

## DEPLOYMENT COMMANDS (Copy-Paste Ready)

### Phase 1: Verify Forge Authentication (2 minutes)

```bash
cd /workspaces/Firsttry/atlassian/forge-app
forge whoami
# Expected: Email, Tenant, other fields (verify you see YOUR email)

forge install list --environment production
# Expected: App is listed with version 2.14.0
```

### Phase 2: Build & Deploy (5 minutes)

```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Final local build (should be instant, already done)
npm test
npm run build

# Deploy to Forge production
forge deploy --environment production

# Upgrade installation to new version
forge install --upgrade --environment production

# Verify deployment succeeded
forge install list --environment production
# Expected: Version updated, Status: installed
```

### Phase 3: Test in Jira (5 minutes)

```
1. Open browser: https://<your-site>.atlassian.net
2. Go to dashboard where Firsttry gadget is installed
3. Hard refresh: Ctrl+F5 (or Cmd+Shift+R on Mac)
4. Scroll to "FORENSIC_PROBE" section
5. Click blue "Run Probe" button
6. Wait for ✅ PROBE SUCCESS (< 2 seconds)
7. Copy value from: PROBE_GREP_NONCE=probe_...
   (Save this in a text file for next step)
```

### Phase 4: Execute Proof Verification (2 minutes)

```bash
cd /workspaces/Firsttry

# Wait 30 seconds for logs to propagate, then:
bash tools/probe_prod.sh --nonce probe_1705515396123_a7f2c1b3

# Expected output:
# ✅ PASS: Nonce found in production logs
# First matching line: {"marker":"PROBE",...}
# Exit code: 0
```

### Phase 5: If Verification Fails (5-10 minutes)

```bash
cd /workspaces/Firsttry

# Generate diagnostic report
bash tools/forensic_report.sh --nonce probe_... --minutes 30

# Read diagnosis
open FORENSIC_CHECK_REPORT.md

# Follow the "Diagnosis" section to your branch (A/B/C/D)
# Execute the recommended action
# Re-run proof
```

---

## TOTAL DEPLOYMENT TIME

| Phase | Action | Time |
|-------|--------|------|
| 1 | Verify Forge auth | 2 min |
| 2 | Build & deploy | 5 min |
| 3 | Test in Jira | 5 min |
| 4 | Verify proof | 2 min |
| 5 | Archive evidence | 1 min |
| | **TOTAL** | **~15 min** |

*(If verification fails, add 5-10 min for diagnosis & retry)*

---

## SUCCESS INDICATORS

### ✅ Build Succeeded
```
✓ 79 modules transformed
✓ built in 456ms
```

### ✅ Deployment Succeeded
```
✓ App deployed successfully
✓ Installation upgraded
```

### ✅ Manual Proof Succeeded
```
✅ PROBE SUCCESS
PROBE_GREP_NONCE=probe_...
(nonce displayed in green box)
```

### ✅ Automated Verification Succeeded
```
✅ PASS: Nonce found in production logs
First matching line: {"marker":"PROBE",...}
(exit code 0)
```

---

## FAILURE MODES & QUICK FIXES

| Symptom | Cause | Fix |
|---------|-------|-----|
| Build fails (npm test) | Code error in test | Check test output, fix code, re-run `npm test` |
| Build fails (npm run build) | TypeScript error | Check dist/errors, fix code, re-run build |
| Forge whoami fails | Not authenticated | Run `forge login`, then retry |
| forge install list empty | App not installed in prod | Run `forge install --environment production` |
| Probe button click shows error | Backend exception | Check UI error message, check logs with forensic_report.sh |
| probe_prod.sh exits 2 (FAIL) | Nonce not in logs | Run `bash tools/forensic_report.sh --nonce ...` and read diagnosis |

---

## FILES DEPLOYED

When you run `forge deploy`, these are the files being deployed:

| File | Lines | Change |
|------|-------|--------|
| `src/resolvers/probe.ts` | 265 | ✅ PROBE_ENTRY/PROBE_OK/PROBE_ERR added |
| `src/gadget-ui/src/main.ts` | 1823 | ✅ runProbe() already present (verified) |
| `src/gadget-ui/index.html` | ~120 | ✅ Probe widget already present (verified) |

---

## EVIDENCE GENERATED

**After Manual Proof (Jira button click):**
- Nonce displayed in UI (copy-paste from browser)
- Logs begin capturing (10-30s propagation delay)

**After Running probe_prod.sh:**
- Artifact bundle created: `/tmp/ft_probe_<timestamp>/`
- Contains: whoami, install list, git commit, logs (grouped + raw), grep matches

**After Running forensic_report.sh (if needed):**
- Report created: `/workspaces/Firsttry/FORENSIC_CHECK_REPORT.md`
- Contains: diagnostics, evidence excerpts, decision tree

---

## ROLLBACK (If Needed)

If something goes wrong in production, you can roll back to previous version:

```bash
cd /workspaces/Firsttry/atlassian/forge-app

# List all deployed versions
forge deploy list --environment production

# Deploy previous version
forge deploy --version <previous-version> --environment production

# Upgrade installation
forge install --upgrade --environment production
```

---

## VALIDATION PROOF

### Pre-Deployment Validation (Already Completed)

```bash
# Test results
✓ Test Files: 118 passed
✓ Tests: 1464 passed
✓ Duration: 21.31s

# Build results
✓ 79 modules transformed
✓ built in 456ms
✓ No errors

# Script syntax
✓ forensic_report.sh: syntax valid
✓ probe_prod.sh: syntax valid
```

### Post-Deployment Validation (To Be Completed)

```bash
# Step 1: Manual proof
1. Click "Run Probe" button
2. See: ✅ PROBE SUCCESS
3. See: PROBE_GREP_NONCE=...
4. Copy nonce value

# Step 2: Automated verification
bash tools/probe_prod.sh --nonce <nonce>
Expected: ✅ PASS (exit 0)
```

---

## NEXT STEPS

1. **NOW:** Review this document and FORENSIC_FRAMEWORK_DEPLOYMENT.md
2. **NEXT:** Execute Phase 1 (Verify Forge auth)
3. **THEN:** Execute Phase 2 (Build & Deploy)
4. **THEN:** Execute Phase 3 (Test in Jira)
5. **THEN:** Execute Phase 4 (Verify proof)
6. **FINALLY:** Archive evidence, document completion

---

## CONTACTS & SUPPORT

| Issue | Where | Action |
|-------|-------|--------|
| Build fails | Terminal output | Check syntax errors in src/*.ts |
| Forge auth fails | Terminal | Run `forge login` |
| Proof verification fails | probe_prod.sh output | Run `forensic_report.sh` and read diagnosis |
| Still stuck | FORENSIC_CHECK_REPORT.md | Follow decision tree for your branch |

---

## KEY REFERENCES

- **Deployment Guide:** `FORENSIC_FRAMEWORK_DEPLOYMENT.md`
- **Implementation Summary:** `FORENSIC_BACKBONE_SUMMARY.md`
- **Probe Script:** `tools/probe_prod.sh`
- **Diagnostic Script:** `tools/forensic_report.sh`
- **Backend Proof:** `src/resolvers/probe.ts`
- **UI Proof:** `src/gadget-ui/src/main.ts`

---

## PROOF STATEMENT

> After completing this deployment, you will have **non-repudiable evidence** that the FORENSIC_PROBE feature works deterministically: UI invokes backend, backend generates unique nonce, backend logs nonce in plain-text + JSON formats, Forge captures logs, verification script finds nonce in logs and outputs binary PASS verdict (exit 0).
>
> **This proves:** UI → Backend → Logs → Verification chain is operational and auditable.
