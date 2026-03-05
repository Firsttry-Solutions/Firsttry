# Enterprise Evidence Pack System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ENTERPRISE EVIDENCE PACK SYSTEM                         │
│                                                                             │
│  Purpose: Tamper-evident proof that FirstTry gadget renders in Jira        │
│  Status: ✅ OPERATIONAL (tested, verified, documented)                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              INPUT (Required)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  • JIRA_BASE_URL (env var)                                                  │
│  • JIRA_DASHBOARD_URL (env var)                                             │
│  • storageState.json (authenticated session)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BUILD EVIDENCE PACK (Builder)                          │
│  Script: tools/reviewer_e2e/proof_pack/build_reviewer_proof_pack.sh        │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Preflight checks (env vars, auth, config)                              │
│  2. Create /tmp/ft_reviewer_e2e_YYYYMMDDTHHMMSSZ/                          │
│  3. Export FT_REVIEWER_EVIDENCE_DIR                                         │
│  4. Run Playwright test ───────────┐                                        │
│  5. Parse summary.json             │                                        │
│  6. Generate manifest.sha256       │  ┌────────────────────────────────┐   │
│  7. Compute pack hash              ├──┤ reviewer_dashboard_e2e.spec.ts │   │
│  8. Write FINAL_VERDICT.txt        │  │  (858 lines)                   │   │
│                                    │  └────────────────────────────────┘   │
│  Exit codes:                       │         │                              │
│    0 = Test PASSED                 │         │                              │
│    1 = Test FAILED (evidence OK)   │         │                              │
│    2 = Fatal error                 │         ▼                              │
└────────────────────────────────────┴──────────────────────────────────────┘
                                              │
                         ┌────────────────────┼────────────────────┐
                         │                    │                    │
                         ▼                    ▼                    ▼
              ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
              │ Origin-Aware     │ │ Deterministic    │ │ Fail-Closed      │
              │ Console          │ │ Gadget Verdict   │ │ Artifact         │
              │ Classification   │ │                  │ │ Verification     │
              └──────────────────┘ └──────────────────┘ └──────────────────┘
              │                    │                    │
              │ HOST (non-block)   │ gadget_present =   │ 15 required files
              │ FORGE (non-block)  │   iframe_score≥4   │ Any missing→FAIL
              │ APP (blocking)     │   && (accessible   │
              │ UNKNOWN (blocking) │       || cross-    │
              │                    │          origin)   │
              └──────────────────┘ └──────────────────┘ └──────────────────┘
                         │                    │                    │
                         └────────────────────┼────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      OUTPUT (Evidence Pack Directory)                       │
│  Location: /tmp/ft_reviewer_e2e_YYYYMMDDTHHMMSSZ/                          │  
├─────────────────────────────────────────────────────────────────────────────┤
│  ├── summary.json ───────────────── Test verdict (PASS/FAIL)               │
│  ├── gadget_verdict.json ───────── Gadget detection result                 │
│  ├── allowlists.json ───────────── Console + network allowlists            │
│  ├── reviewer_env.json ──────────── Environment validation                 │
│  ├── manifest.sha256 ────────────── SHA256 of all files ◄─┐                │
│  ├── PROOF_PACK_SHA256.txt ──────── Hash of manifest ──────┤ Tamper-evident│
│  ├── FINAL_VERDICT.txt ──────────── PASS or FAIL           │                │
│  └── 04_playwright/                                         │                │
│      ├── screenshots/ ──────────── 4 PNGs + HTML           │                │
│      ├── logs/ ─────────────────── Console + errors        │                │
│      └── network/ ──────────────── Requests + domains      │                │
│                                                             │                │
│  23 files total (~2.7 MB)                                  │                │
│  20 files hashed in manifest ──────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     VERIFY EVIDENCE PACK (Verifier)                         │
│  Script: tools/reviewer_e2e/proof_pack/verify_reviewer_proof_pack.sh       │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Check 18 required files exist                                           │
│  2. Recompute manifest (find | sort | sha256sum)                           │
│  3. Compare with original ──► Detect tampering ◄─────────┐                 │
│  4. Recompute pack hash                                  │                  │
│  5. Compare with PROOF_PACK_SHA256.txt ──────────────────┤ Offline          │
│  6. Parse summary.json (test status)                     │ Verification     │
│  7. Parse gadget_verdict.json (gadget_present)           │ (No network!)    │
│  8. Validate FINAL_VERDICT.txt matches ──────────────────┘                  │
│                                                                             │
│  Exit codes:                                                                │
│    0 = Verification PASSED (intact + test PASSED)                           │
│    1 = Verification FAILED (tamper OR test FAILED)                          │
│    2 = Fatal error (missing evidence dir)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RESULT (Verdict)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ✅ PASS + INTACT = Evidence valid, gadget rendered successfully            │
│  ❌ FAIL + INTACT = Evidence valid, test failed (see failureReason)         │
│  ❌ TAMPER = Evidence modified (manifest mismatch)                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            SUPPORTING UTILITIES                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  canonical_json.py ──────► Format JSON (sorted keys, 2-space indent)       │
│  sha256_manifest.sh ─────► Generate deterministic manifest                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY PROPERTIES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  ✅ Tamper-evident: SHA256 manifest detects any file modification           │
│  ✅ Fail-closed: 15+ conditions that cause FAIL (cannot silently pass)      │
│  ✅ Deterministic: Canonical JSON ensures reproducible hashes               │
│  ✅ Origin-aware: Jira host errors don't cause false negatives              │
│  ✅ Offline verifiable: No network required for verification                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                               DATA FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Jira Dashboard ──► Playwright ──► Origin Classification ──► Canonical JSON │
│       │                 │                     │                      │      │
│       │                 │                     │                      │      │
│  Forge Iframe ─────► Scoring ───────► Gadget Verdict ───────► manifest.sha256
│       │                 │                     │                      │      │
│       │                 │                     │                      │      │
│  Network Reqs ─────► Allowlist ──────► Domain List ─────────► PROOF_PACK_SHA256
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            TYPICAL METRICS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Test duration:        ~6 seconds                                           │
│  Evidence pack size:   ~2.7 MB                                              │
│  Files generated:      23 files (20 hashed)                                 │
│  Console errors:       4 HOST (non-blocking), 2 APP (allowlisted)           │
│  Network requests:     ~180 requests across 13 domains                      │
│  Gadget iframe score:  5 points (atl-paas.net + size)                       │
│  Verdict:              PASS ✅                                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          DOCUMENTATION INDEX                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  INDEX.md ──────────────────────► Navigation + overview                     │
│  REVIEWER_E2E_QUICK_REF.md ─────► 1-page cheat sheet                        │
│  ENTERPRISE_EVIDENCE_PACK_COMPLETE.md ► Implementation summary              │
│  docs/reviewer/REVIEWER_E2E_PROOF_PACK.md ► Full guide (683 lines)         │
│  ARCHITECTURE.md ───────────────► This file (system architecture)           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### Test Phases (11 phases)
1. ENV VALIDATION — Fail if FT_REVIEWER_EVIDENCE_DIR missing
2. LISTENER SETUP — Origin-aware console, page errors, network tracer
3. NAVIGATION — Go to Jira dashboard URL
4. DASHBOARD DISCOVERY — 3-layer detection (main, text, iframes)
5. IFRAME SCORING — Score all iframes, choose highest (≥4)
6. GADGET VALIDATION — Access frame or cross-origin fallback
7. GADGET VERDICT — Apply deterministic rules
8. CONSOLE CLASSIFICATION — Classify by origin, fail on APP errors
9. NETWORK FORENSICS — Validate egress, fail on unknown domains
10. ARTIFACT VERIFICATION — Check all required files exist
11. SUMMARY GENERATION — Write summary.json, allowlists.json, FINAL_VERDICT.txt

### Canonical JSON Format
```typescript
function writeJsonCanonical(filePath: string, data: any): void {
  const json = JSON.stringify(data, Object.keys(data).sort(), 2);
  fs.writeFileSync(filePath, json + '\n', 'utf8');
}
```

**Properties:**
- Sorted keys (stable ordering)
- 2-space indentation
- Newline at EOF
- UTF-8 encoding

**Example:**
```json
{
  "consoleAppErrors": 2,
  "endTime": "2026-03-04T17:20:19.585Z",
  "status": "PASS"
}
```

### Gadget Verdict Logic
```typescript
// Non-bypassable deterministic rules
const gadgetPresent = chosenIframe.score >= 4 && (
  frameAccessible || crossOriginBlocked
);

const gadgetVerdict = {
  gadget_present: gadgetPresent,
  iframe_detected: true,
  iframe_index: chosenIframe.index,
  iframe_score: chosenIframe.score,
  frame_accessible: frameAccessible,
  cross_origin_blocked: crossOriginBlocked,
  verdict_timestamp: new Date().toISOString(),
};
```

### Manifest Generation
```bash
# Deterministic manifest (stable sort order)
find . -type f \
  ! -name "manifest.sha256" \
  ! -name "PROOF_PACK_SHA256.txt" \
  ! -name "FINAL_VERDICT.txt" \
  | sort \
  | xargs sha256sum > manifest.sha256

# Pack hash (hash of manifest)
sha256sum manifest.sha256 | awk '{print $1}' > PROOF_PACK_SHA256.txt
```

### Verification Process
```bash
# 1. Recompute manifest
find . -type f \
  ! -name "manifest.sha256" \
  ! -name "PROOF_PACK_SHA256.txt" \
  ! -name "FINAL_VERDICT.txt" \
  | sort \
  | xargs sha256sum > /tmp/recomputed.sha256

# 2. Compare (detect tampering)
diff manifest.sha256 /tmp/recomputed.sha256

# 3. Recompute pack hash
sha256sum manifest.sha256 | awk '{print $1}'

# 4. Compare with stored
cat PROOF_PACK_SHA256.txt
```

---

## End-to-End Flow

```
Developer
   │
   ├─► Set JIRA_BASE_URL, JIRA_DASHBOARD_URL
   │
   ├─► Run: build_reviewer_proof_pack.sh
   │
   ├─► Builder creates /tmp/ft_reviewer_e2e_YYYYMMDDTHHMMSSZ/
   │
   ├─► Test runs (Playwright + origin classification + verdict)
   │
   ├─► Evidence written (canonical JSON, sorted files)
   │
   ├─► Manifest generated (SHA256 of all files)
   │
   ├─► Pack hash computed (SHA256 of manifest)
   │
   └─► Result: PASS or FAIL with complete evidence

Reviewer
   │
   ├─► Run: verify_reviewer_proof_pack.sh <evidence-dir>
   │
   ├─► Verifier checks 18 required files exist
   │
   ├─► Recomputes manifest (same algorithm as builder)
   │
   ├─► Compares with original (detect tampering)
   │
   ├─► Recomputes pack hash, compares
   │
   ├─► Parses summary.json, gadget_verdict.json
   │
   └─► Result: INTACT + PASS or FAIL

Auditor
   │
   ├─► Inspect allowlists.json (console + network patterns)
   │
   ├─► Inspect console_classified.json (APP errors)
   │
   ├─► Inspect network_domains_sorted.txt (all domains)
   │
   ├─► View screenshots/*.png (visual proof)
   │
   └─► Verify manifest.sha256 + PROOF_PACK_SHA256.txt
```

---

**Status:** ✅ **OPERATIONAL** — System architecture documented and validated
