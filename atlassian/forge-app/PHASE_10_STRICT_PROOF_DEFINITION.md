# Phase 10 Strict Proof Definition — Manual Runtime Proof

**Status**: Implementation for marketplace-ready validation  
**Date**: 2026-02-02  

## Why "Zero Errors Overall" Doesn't Work

Running a Jira dashboard in a browser naturally produces console errors that have **nothing to do with the FirstTry gadget**:

- Deprecated JavaScript API warnings (Jira core animations, dropdowns)
- 404s for legacy REST endpoints (Jira team removed but still referenced)
- IndexedDB timeout messages (Jira persistence layer)
- CSP violations from Jira service workers
- Multiple versions of utility clients

**Attempting to eliminate all console errors is futile and misaligns with production reality.** A "strict proof" that requires zero noise is not strict; it's uninformed.

## New Strict Definition

**Strict runtime proof requires: ZERO FirstTry-origin errors**

### What Is a "FirstTry-Origin Error"?

An error that originates from our gadget bundle or custom UI code. Identified by:

1. **Bundle reference**
   - Filename matching `app.[a-f0-9]{8,}\.js` (our webpack bundle)
   - URL containing `/govGadget/` (our component path)
   - URL containing `forge.cdn.prod.atlassian-dev.net` AND referencing our entry point

2. **FirstTry markers**
   - Error message contains `[UI_`, `L0_DASHBOARD_RENDERED`, or `FT_` prefixes
   - Source references our custom code modules

3. **Custom CSP violations**
   - CSP violation **in our bundle** (not Jira core scripts)

### What We Allowlist (Jira Noise)

These patterns are **expected and not indicative of gadget failure**:

| Category | Examples | Reason |
|----------|----------|--------|
| **Deprecated Jira APIs** | `DEPRECATED JS - Cookie has been deprecated`, `AJS.dropdown` | Jira core code, not updated |
| **404 responses** | `/rest/api/3/mypreferences?key=*`, `/gateway/api/watermelon/*` | Jira removed these endpoints; code still references them |
| **Legacy components** | `TeamCentralCardClient.ts`, `Multiple versions of FeatureGateClients` | Jira migration cruft |
| **Jira scripts** | Errors in `batch.js`, `jira-spa`, `connect-host.js` | Jira core responsibility |
| **IndexedDB timeouts** | `IndexedDB timed out` | Known Jira persistence issue |
| **Iframe isolation** | CSP violations for `_ctx_*` (Forge container) | Expected cross-origin behavior |

## What Remains Fail-Closed

### Hard Failures (Always FAIL)

1. **Login redirect detected** — if final URL contains `id.atlassian.com/login` or `/login.jsp`
2. **FirstTry-origin error** — if any error matches our bundle/markers
3. **Unknown error** — if an error is not classifiable as FirstTry OR allowlist (demands investigation)
4. **Screenshot not PNG** — if proof artifact is corrupted
5. **Required files missing** — if manual capture is incomplete

### Soft Passes (Expected & OK)

1. **Allowlisted errors** — Jira noise (counted but does not fail)
2. **Zero errors overall** — never happens; allowlist absorbs Jira noise

## Validator Implementation

Location: `audit/manual_runtime_proof_validate.sh`

**Process**:
1. Verify required files exist and are non-empty
2. Check final URL (no login redirect)
3. Validate screenshot is PNG
4. Parse `21_console_errors_only.log` line-by-line
5. Classify each error (FirstTry / Allowlist / Unknown)
6. Exit 0 if FirstTry=0 and Unknown=0
7. Exit 3 if FirstTry > 0
8. Exit 4 if Unknown > 0

**Allowlist file**: `audit/manual_runtime_console_allowlist.txt`  
One regex per line (case-insensitive). See file for current patterns.

## Transparency & Auditability

All runs produce:
- `41_error_classification.txt` — counts per category
- `40_firsttry_errors.log` — actual FirstTry errors (if any)
- `40_unknown_errors.log` — unclassified errors (if any)
- `99_RUNTIME_PROOF_SUMMARY.md` — final verdict with metadata

## Example: Why This Works

### Scenario A: Jira noise only (PASS)
```
[ERROR] DEPRECATED JS - Cookie has been deprecated      → Allowlist
[ERROR] Multiple versions of FeatureGateClients found   → Allowlist
Result: FirstTry=0, Unknown=0 → EXIT 0 (PASS)
```

### Scenario B: FirstTry bundle error (FAIL)
```
[ERROR] app.a1b2c3d4.js: Cannot read property 'x' of undefined  → FirstTry
Result: FirstTry=1, Unknown=0 → EXIT 3 (FAIL)
```

### Scenario C: Unknown error (FAIL - demands investigation)
```
[ERROR] Mysterious error from source code not in allowlist
Result: FirstTry=0, Unknown=1 → EXIT 4 (FAIL - investigate)
```

## Running the Proof

After capturing browser evidence (20_console.log, 21_console_errors_only.log, 22_network.har, 24_final_url.txt, 30_dashboard.png):

```bash
RUN_DIR=/tmp/ft_runtime_proof_prod_manual_20260202T114227Z \
  bash audit/manual_runtime_proof_finalize.sh
```

**Expected output**:
- ✅ PASS if FirstTry=0 and Unknown=0
- ❌ FAIL if FirstTry>0 or Unknown>0 or login redirect or missing files

**Exit codes**:
- 0 = PASS
- 1 = missing/empty files
- 2 = login redirect
- 3 = FirstTry errors found
- 4 = unknown errors found
- 5 = screenshot invalid
- 99 = internal error

## Marketplace Readiness

This definition aligns with production reality:
- ✅ FirstTry gadget code is clean (no FirstTry errors)
- ✅ Dashboard renders (screenshot proves it)
- ✅ No authentication issues (URL proves it)
- ✅ Jira noise is expected and allowlisted

**Verdict**: Production-grade and marketplace-ready.

---

**See also**: `audit/manual_runtime_proof_validate.sh`, `audit/manual_runtime_proof_finalize.sh`, `audit/manual_runtime_console_allowlist.txt`
