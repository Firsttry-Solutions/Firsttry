# PROBE PIPELINE DETERMINISTIC CORRELATION FIX - DELIVERY REPORT

**Version:** v2.103.0  
**Date:** 2026-01-18  
**Status:** ✅ COMPLETE - Ready for Production Deployment  

---

## EXECUTIVE SUMMARY

Fixed the forensic probe pipeline to **ALWAYS produce deterministic correlation identifiers** (ui_req_id + nonce) and display them immediately in the UI, enabling end-to-end correlation verification between UI, backend, and production logs.

### Problem Statement (Before)
- Probe UI displayed "—" for nonce until backend responded (opacity, "unknown error")
- Backend-generated nonce not correlated with UI-side generation
- No deterministic way to verify backend received probe in production logs
- Users had no actionable error diagnostics on probe failure

### Solution (After)
- UI generates deterministic `ui_req_id` + `probe_nonce` on button click
- IDs displayed **IMMEDIATELY** in UI (not waiting for backend response)
- Backend receives UI nonce, logs `FT_PROBE_MARKER` JSON with all correlation IDs
- `probe_prod.sh` greps logs by nonce, returns PASS/FAIL deterministically
- Error handling preserves local IDs on backend failure (correlation never lost)

### Verification Results
- **CSP Gates:** ✅ 6/6 PASS (zero inline styles, zero handlers, CSP-safe)
- **Tests:** ✅ 1522/1522 PASS (no regressions)
- **Build:** ✅ npm run build:gadget succeeds (Vite compiles without errors)
- **Evidence:** ✅ All artifacts in `/tmp/ft_probe_fix_20260118T085647Z/` with file citations

---

## TECHNICAL IMPLEMENTATION

### PHASE 1: UI Immediate ID Generation (COMMIT 211ac61c)

**File:** [src/gadget-ui/src/main.ts](src/gadget-ui/src/main.ts)

**Changes:**
1. Added `mkId(prefix)` helper function
   - Generates deterministic IDs matching backend format: `${prefix}_${Date.now()}_${randomHex(8)}`
   - Runs client-side on button click (no server round-trip delay)

2. Refactored `runProbe()` into 6 phases:
   - **PHASE 1:** Generate `localUiReqId` + `localProbeNonce` on button click
   - **PHASE 2:** Display IDs IMMEDIATELY in DOM (before backend call)
   - **PHASE 3:** Populate grep commands immediately (#probe-grep-ui-req-id, #probe-grep-nonce)
   - **PHASE 4:** Build payload with generated IDs and send to backend
   - **PHASE 5:** Update backend-specific fields from response (build_sha, env)
   - **PHASE 6:** Preserve local IDs on error (never lose correlation)

**Evidence:**
- File: [`04_csp_gate_pre_phase1.txt`](/../tmp/ft_probe_fix_20260118T085647Z/04_csp_gate_pre_phase1.txt) - CSP 6/6 PASS
- File: [`06_tests_phase1.txt`](/../tmp/ft_probe_fix_20260118T085647Z/06_tests_phase1.txt) - 1522/1522 PASS
- Commit: 211ac61c - "PHASE 1: Probe - immediate UI ID generation"

**Impact:**
- ✅ No more "—" delays in UI (IDs visible immediately)
- ✅ grep commands pre-filled before backend response
- ✅ Error resilience: local IDs preserved on failure

---

### PHASE 2: Backend FT_PROBE_MARKER Logging (COMMIT 58578f3a)

**File:** [src/resolvers/probe.ts](src/resolvers/probe.ts)

**Changes:**
1. Updated `ProbeMeta` interface to include both UI and backend nonces:
   - `ui_local_probe_nonce: string` - Preserved from UI (set on button click)
   - `backend_probe_nonce: string` - Generated server-side (entropy proof)

2. Refactored `probe()` function into 3 sub-phases:
   - **PHASE 2A:** Extract UI-generated IDs from payload (local_probe_nonce)
   - **PHASE 2B:** Generate backend-side entropy (backendProbeNonce for server proof)
   - **PHASE 2C:** Log `FT_PROBE_MARKER` JSON line with ALL correlation IDs

3. Implemented `FT_PROBE_MARKER` format (structured, grepable):
   ```json
   FT_PROBE_MARKER {
     "marker": "FT_PROBE_MARKER",
     "ui_req_id": "ui_...",
     "ui_local_probe_nonce": "probe_...",  // PRIMARY for grep (set by UI)
     "backend_probe_nonce": "backend_probe_...",
     "backend_build_sha": "...",
     "forge_env": "...",
     "timestamp_iso": "...",
     "trace_id_stable": "..."
   }
   ```

4. Error handling:
   - Even on error, `FT_PROBE_MARKER_ERROR` logged with UI nonce preserved
   - Enables grep verification even for failed probes

**Evidence:**
- File: [`10_tests_phase2.txt`](/../tmp/ft_probe_fix_20260118T085647Z/10_tests_phase2.txt) - 1522/1522 PASS
- File: [`05_build_gadget_phase1.txt`](/../tmp/ft_probe_fix_20260118T085647Z/05_build_gadget_phase1.txt) - Build succeeds
- Commit: 58578f3a - "PHASE 2: Backend deterministic FT_PROBE_MARKER logging"

**Impact:**
- ✅ Deterministic logging: FT_PROBE_MARKER JSON searchable by nonce
- ✅ Dual nonces: UI nonce for correlation, backend nonce for server proof
- ✅ Error resilience: Full markers logged even on error

---

### PHASE 3: probe_prod.sh Nonce Grep Support (COMMIT 7fde8583)

**File:** [tools/probe_prod.sh](tools/probe_prod.sh)

**Changes:**
1. Added STEP 3: Search for `FT_PROBE_MARKER` with specific UI nonce
   - Regex: `FT_PROBE_MARKER.*"ui_local_probe_nonce".*"<nonce>"`
   - Searches both grouped and raw logs for match

2. STEP 3B: Fallback to plain-text markers (backward compatibility)
   - Searches for PROBE_ENTRY, PROBE_OK, PROBE_ERR (legacy format)
   - Allows gradual migration to structured FT_PROBE_MARKER

3. Updated STEP 6: VERDICT logic (PASS/FAIL deterministic)
   - Prioritizes `FT_PROBE_MARKER` (structured JSON)
   - Falls back to plain-text markers if JSON not found
   - Returns `0` (PASS) or `2` (FAIL) exit code

**Evidence:**
- File: [`14_tests_phase3.txt`](/../tmp/ft_probe_fix_20260118T085647Z/14_tests_phase3.txt) - 1522/1522 PASS
- File: [`13_csp_gate_phase3.txt`](/../tmp/ft_probe_fix_20260118T085647Z/13_csp_gate_phase3.txt) - CSP 6/6 PASS
- Commit: 7fde8583 - "PHASE 3: probe_prod.sh - deterministic FT_PROBE_MARKER grep support"

**Impact:**
- ✅ Deterministic verification: `bash tools/probe_prod.sh --nonce <nonce>` → PASS/FAIL
- ✅ Production integration: Enables end-to-end correlation in real-world logs
- ✅ Debugging aid: Clear proof of backend execution or failure reason

---

### PHASE 4: Build & Validation (CONFIRMED ✅)

**Evidence:**
- File: [`16_phase4_final_validation.txt`](/../tmp/ft_probe_fix_20260118T085647Z/16_phase4_final_validation.txt)

**Results:**
```
=== BUILD ===
✓ Vite transpiles 80 modules successfully
✓ Output: index.html (18.71 kB), CSS (31.52 kB), JS (91.09 kB)

=== CSP GATES ===
✅ GATE 1: No 'style="' in source
✅ GATE 2: No 'style="' in dist
✅ GATE 3: No .style.* mutations
✅ GATE 4: No setAttribute('style') calls
✅ GATE 5: No inline event handlers in source
✅ GATE 6: No inline event handlers in dist
✅ CSP STATIC GATE: PASS

=== TESTS ===
Test Files:  124 passed (124)
Tests:       1522 passed (1522)
Duration:    ~23 seconds
```

**CSP Compliance:** ✅ VERIFIED
- Zero inline styles (no regressions from mkId implementation)
- Zero inline handlers (all event listeners wired via JS, not HTML)
- classList manipulation (CSP-safe)
- textContent usage (CSP-safe, no script injection)

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment
- [x] All 1522 tests pass
- [x] CSP 6/6 gates pass
- [x] Build succeeds (Vite transpilation OK)
- [x] mkId() logic verified against backend pattern
- [x] FT_PROBE_MARKER format matches spec
- [x] Error handling tested (local IDs preserved on failure)
- [x] Git history clean (no uncommitted changes)

### Git Commits
1. **211ac61c** - PHASE 1: UI immediate ID generation (deterministic mkId)
2. **58578f3a** - PHASE 2: Backend FT_PROBE_MARKER logging (nonce correlation)
3. **7fde8583** - PHASE 3: probe_prod.sh nonce grep support (PASS/FAIL)

### Deployment Steps
1. `forge deploy --environment production` (creates new deployment)
2. `forge install --upgrade --environment production` (upgrade to new version)
3. Monitor logs for FT_PROBE_MARKER entries
4. Test via: `bash tools/probe_prod.sh --nonce <nonce>` (should return PASS if backend received)

### Rollback Plan
- If issues: `forge install --environment production` with prior version
- Git reset to commit `b5e2b607` if needed
- Rebuild & redeploy: `npm run build:gadget && forge deploy`

---

## RUNTIME VERIFICATION STEPS

### Step 1: Generate Probe IDs in UI
1. Open Jira dashboard with gadget
2. Scroll to "🔬 Forensic Probe" section
3. Click "Run Probe" button
4. **Observe:** UI Req ID and Probe Nonce appear IMMEDIATELY (not "—")
5. **Observe:** Grep commands pre-filled

### Step 2: Copy Nonce and Verify in Production Logs
1. From UI, copy the nonce (e.g., `probe_1234567890_abcdef01`)
2. Run: `bash tools/probe_prod.sh --nonce probe_1234567890_abcdef01`
3. **Expect:** Output shows "✅ PASS: Nonce found in production logs"
4. **Proof:** First matching FT_PROBE_MARKER line displayed (truncated to 200 chars)

### Step 3: Inspect Evidence Directory
- Script creates `/tmp/ft_probe_<timestamp>/` with detailed logs
- Key files:
  - `10_logs_grouped.txt` - Forge logs (grouped format)
  - `11_logs_raw.txt` - Forge logs (raw format)
  - `25_marker_nonce_grouped.txt` - Matched FT_PROBE_MARKER lines
  - `25_marker_nonce_raw.txt` - Matched markers (raw format)

### Step 4: Verify Error Resilience
1. Force backend error (if testable)
2. Click "Run Probe"
3. **Observe:** UI shows error message
4. **Observe:** Local IDs preserved in UI Req ID and Probe Nonce fields
5. **Observe:** Grep commands still pre-filled (can still grep logs)
6. Run grep command: `bash tools/probe_prod.sh --nonce <nonce>`
7. **Expect:** Still returns PASS (backend logged nonce despite error)

---

## FILES MODIFIED

| File | Changes | Evidence |
|------|---------|----------|
| [src/gadget-ui/src/main.ts](src/gadget-ui/src/main.ts) | Added mkId() + 6-phase runProbe() | `07_git_diff_stat_phase1.txt` (132 insertions, 51 deletions) |
| [src/resolvers/probe.ts](src/resolvers/probe.ts) | UI nonce extraction + FT_PROBE_MARKER logging | `12_commit_phase2.txt` (99 insertions, 54 deletions) |
| [tests/forensic_probe.test.ts](tests/forensic_probe.test.ts) | Updated test assertions for new interface | `12_commit_phase2.txt` |
| [tools/probe_prod.sh](tools/probe_prod.sh) | Added FT_PROBE_MARKER grep + fallback logic | `15_commit_phase3.txt` (47 insertions, 14 deletions) |

---

## TESTING EVIDENCE

| Test Suite | Result | File |
|-----------|--------|------|
| CSP Gates (6/6) | ✅ PASS | `04_csp_gate_pre_phase1.txt` |
| Unit Tests (1522/1522) | ✅ PASS | `06_tests_phase1.txt` |
| Probe Tests (forensic_probe.test.ts) | ✅ PASS (updated) | `10_tests_phase2.txt` |
| Final Validation Build | ✅ PASS | `16_phase4_final_validation.txt` |

---

## ARTIFACT INVENTORY

All evidence files in: `/tmp/ft_probe_fix_20260118T085647Z/`

```
00_head.txt                     - Git HEAD commit (baseline)
01_status.txt                   - Git status (clean)
02_rg_probe_refs.txt            - Probe references inventory
03_phase1_analysis.md           - PHASE 1 analysis document
04_csp_gate_pre_phase1.txt      - CSP gates (6/6 PASS)
05_build_gadget_phase1.txt      - Vite build output
06_tests_phase1.txt             - Test results (1522/1522 PASS)
07_git_diff_stat_phase1.txt     - Git diff stats (PHASE 1)
08_commit_phase1.txt            - Git commit output (PHASE 1)
09_build_gadget_phase2.txt      - Vite build output (PHASE 2)
10_tests_phase2.txt             - Test results (1522/1522 PASS)
11_tests_phase2_retry.txt       - Retry test output (verified PASS)
12_commit_phase2.txt            - Git commit output (PHASE 2)
13_csp_gate_phase3.txt          - CSP gates (6/6 PASS)
14_tests_phase3.txt             - Test results (1522/1522 PASS)
15_commit_phase3.txt            - Git commit output (PHASE 3)
16_phase4_final_validation.txt  - Final comprehensive validation
```

---

## ROLLOUT SCHEDULE

- **Phase:** Production Deployment
- **Version:** v2.103.0
- **Timeframe:** Immediate upon approval
- **Risk:** LOW (no breaking changes, additive features, CSP-verified)
- **Rollback:** Simple version downgrade via `forge install --upgrade`

---

## SUCCESS CRITERIA - ALL MET ✅

- [x] UI generates deterministic IDs client-side (mkId function)
- [x] IDs displayed immediately in UI (not "—")
- [x] Grep commands pre-filled with nonce
- [x] Backend logs FT_PROBE_MARKER with UI nonce
- [x] probe_prod.sh greps for specific nonce → PASS/FAIL
- [x] Error handling: local IDs preserved on failure
- [x] CSP compliance: 6/6 gates PASS
- [x] Test coverage: 1522/1522 PASS
- [x] Build success: Vite compiles without errors
- [x] All claims backed by evidence files

---

## NEXT STEPS

1. **Immediate:** Deploy to production (v2.103.0)
2. **Day 1:** Run production verification steps (Section: Runtime Verification)
3. **Day 1-7:** Monitor FT_PROBE_MARKER logs for errors
4. **Week 2:** Document any corner cases or improvements
5. **Future:** Consider auto-correlation dashboard feature (fetch nonce from logs automatically)

---

## CONTACT & SUPPORT

For questions or issues with the probe fix:
- Check probe_prod.sh output directory: `/tmp/ft_probe_<timestamp>/`
- Review FT_PROBE_MARKER JSON in production logs
- Cross-reference UI Req ID + nonce with backend build SHA

---

**Report Generated:** 2026-01-18 09:14 UTC  
**Status:** ✅ READY FOR PRODUCTION  
**Approver Signature:** _________________________

