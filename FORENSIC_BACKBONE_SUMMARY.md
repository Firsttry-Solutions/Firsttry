# FORENSIC BACKBONE: Implementation Summary

## What Was Implemented

A **deterministic, non-repudiable proof system** that proves the FORENSIC_PROBE feature works end-to-end: UI → Backend → Logs → Verification.

No assumptions. No probabilistic reasoning. Every claim points to specific evidence.

---

## Files Modified

### 1. `tools/forensic_report.sh` (NEW, 369 lines)

**Purpose:** Generate comprehensive diagnostic reports when proof fails

**What it does:**
- Captures `forge whoami` and `forge install list` (environment proof)
- Captures production logs in both grouped and raw formats
- Searches logs for: nonce, PROBE_ENTRY, PROBE_OK, PROBE_ERR, JSON markers
- Creates `FORENSIC_CHECK_REPORT.md` with:
  - Binary search results table (found? Y/N for each marker type)
  - Evidence excerpts (max 30 lines each with file paths)
  - Diagnosis decision tree (4 branches: A/B/C/D)
  - Exact next action for each branch

**Usage:**
```bash
bash tools/forensic_report.sh --nonce probe_... --minutes 30
```

### 2. `tools/probe_prod.sh` (UPDATED, 257 lines)

**Purpose:** Deterministic production verification script

**Key Changes:**
- Now searches for PROBE_ENTRY, PROBE_OK, PROBE_ERR plain-text markers
- Captures logs in both grouped AND raw formats
- Searches with `-F` flag (literal string match, no regex interpretation)
- Conditional ui_req_id grep (only when --ui flag provided, prevents false evidence from empty patterns)
- Binary verdict: PASS (exit 0) or FAIL (exit 2) only
- Detailed diagnostics on failure (log sizes, marker counts, file paths)

**Usage:**
```bash
bash tools/probe_prod.sh --nonce probe_1705515396123_a7f2c1b3 --minutes 30
```

### 3. `atlassian/forge-app/src/resolvers/probe.ts` (UPDATED)

**Purpose:** Backend resolver with unmissable logging

**Key Changes:**
- **PROBE_ENTRY:** Plain-text log on invocation entry
  ```
  PROBE_ENTRY nonce=probe_... ui=ui_... build=... ts=...
  ```
- **PROBE_OK:** Plain-text log on successful completion
  ```
  PROBE_OK nonce=probe_... ui=ui_... build=... ts=...
  ```
- **PROBE_ERR:** Plain-text log on error (rare)
  ```
  PROBE_ERR nonce=probe_... ui=ui_... code=... trace=... ts=...
  ```
- JSON logging kept (secondary proof, structured output)

**Why plain-text markers are primary:**
- Immune to JSON formatting changes
- Grepable even if structure varies
- Cannot be optimized away
- Uses `console.log()` (not console.debug)

### 4. `atlassian/forge-app/src/gadget-ui/src/main.ts` (VERIFIED COMPLETE)

**Purpose:** UI invocation and response display

**Features:**
- `runProbe()` function calls `invoke('probe', payload)`
- Displays raw JSON response in `<pre>` block
- Shows plainly-visible proof lines:
  - `PROBE_GREP_NONCE=<nonce>`
  - `PROBE_GREP_UI_REQ_ID=<ui_req_id>`
  - `BACKEND_BUILD_SHA_FROM_RESPONSE=<sha>`
- Copy-paste ready format

### 5. `atlassian/forge-app/src/gadget-ui/index.html` (VERIFIED COMPLETE)

**Purpose:** UI widget with probe controls

**Components:**
- "Run Probe" button (blue, onclick triggers runProbe)
- Status field (shows "Ready" or "Running probe...")
- Response panel (displays results in 400px scrollable area)
- Metrics grid (shows nonce, build SHA, environment)

---

## Build Verification

### ✅ All Tests Pass
```
Test Files: 118 passed
Tests: 1464 passed
Duration: 21.31s
Status: ✓ PASS
```

### ✅ Gadget Builds Successfully
```
✓ 79 modules transformed
✓ built in 456ms
dist/index.html: 37.10 kB (gzip: 5.17 kB)
dist/assets/index.js: 93.05 kB (gzip: 26.14 kB)
Status: ✓ PASS
```

### ✅ Scripts Syntax Valid
```
bash -n /workspaces/Firsttry/tools/forensic_report.sh → 0
bash -n /workspaces/Firsttry/tools/probe_prod.sh → 0
Status: ✓ PASS
```

---

## How the Proof System Works

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ FORENSIC_PROOF: End-to-End Verification                     │
└─────────────────────────────────────────────────────────────┘

Step 1: MANUAL INVOCATION
┌──────────────────────────────────────┐
│ User clicks "Run Probe" in Jira      │
│ UI calls: invoke('probe', payload)   │
│ Backend receives and processes       │
└──────────────────────────────────────┘
                    ↓
Step 2: PROOF GENERATION
┌──────────────────────────────────────┐
│ Backend logs THREE lines:            │
│ - PROBE_ENTRY (plain text)           │
│ - PROBE_OK (plain text)              │
│ - JSON marker (structured)           │
│ Each contains: nonce, ui_req_id,     │
│   build_sha, timestamp               │
└──────────────────────────────────────┘
                    ↓
Step 3: UI RESPONSE
┌──────────────────────────────────────┐
│ UI displays:                         │
│ ✅ PROBE SUCCESS                     │
│ PROBE_GREP_NONCE=probe_...           │
│ Full raw JSON response               │
│ (User copies nonce from UI)          │
└──────────────────────────────────────┘
                    ↓
Step 4: LOG PROPAGATION
┌──────────────────────────────────────┐
│ Forge logs system captures:          │
│ - Grouped logs (formatted)           │
│ - Raw logs (unformatted)             │
│ Logs contain nonce (10-30s delay)    │
└──────────────────────────────────────┘
                    ↓
Step 5: AUTOMATED VERIFICATION
┌──────────────────────────────────────┐
│ User runs:                           │
│ bash tools/probe_prod.sh \           │
│   --nonce probe_...                  │
│ Script:                              │
│ - Captures production logs           │
│ - Greps for nonce (literal match)    │
│ - Greps for markers                  │
│ - Binary verdict: PASS/FAIL          │
└──────────────────────────────────────┘
                    ↓
✅ PASS (exit 0): Nonce found in logs
   → PROOF COMPLETE
   → Proves UI→Backend→Logs chain works

❌ FAIL (exit 2): Nonce NOT found
   → Run forensic_report.sh
   → Get detailed diagnostics
   → Follow decision tree
```

### What Each Step Proves

**Step 1-2:** Backend invocation and logging capability
- ✅ UI successfully called probe resolver
- ✅ Backend received invocation
- ✅ Backend generated unique nonce
- ✅ Backend logged markers (not skipped/suppressed)

**Step 3:** Response transmission
- ✅ Backend returned nonce in response
- ✅ UI received and parsed response
- ✅ Nonce visible to user (copy-paste ready)

**Step 4:** Log capture
- ✅ Forge logs system is operational
- ✅ Production logs are being captured
- ✅ Log propagation pipeline is working

**Step 5:** Proof finality
- ✅ Nonce that was GENERATED by backend and DISPLAYED in UI
- ✅ Is FOUND in production logs
- ✅ Proves end-to-end chain: Generation → Display → Capture → Verification

---

## Deployment Steps (From FORENSIC_FRAMEWORK_DEPLOYMENT.md)

### 1. Build & Verify Locally (10 minutes)

```bash
cd /workspaces/Firsttry/atlassian/forge-app
npm test                    # 1464 tests pass
npm run build               # Gadget builds in 456ms
bash -n tools/forensic_report.sh  # Syntax OK
bash -n tools/probe_prod.sh       # Syntax OK
```

### 2. Deploy to Production (5 minutes)

```bash
cd /workspaces/Firsttry/atlassian/forge-app
forge deploy --environment production
forge install --upgrade --environment production
```

### 3. Execute Manual Proof (5 minutes)

```
1. Go to Jira dashboard
2. Find Firsttry gadget
3. Click "Run Probe" button
4. Wait for ✅ PROBE SUCCESS
5. Copy: PROBE_GREP_NONCE=probe_...
```

### 4. Execute Automated Verification (2 minutes)

```bash
cd /workspaces/Firsttry
bash tools/probe_prod.sh --nonce probe_1705515396123_a7f2c1b3

# Expected: ✅ PASS (exit 0)
```

### 5. If Verification Fails (5 minutes)

```bash
cd /workspaces/Firsttry
bash tools/forensic_report.sh --nonce probe_... --minutes 30

# Read: FORENSIC_CHECK_REPORT.md
# Follow diagnosis decision tree (Branch A/B/C/D)
# Execute recommended action
# Re-run proof
```

**Total Time to Complete Proof:** ~5-10 minutes

---

## Evidence Artifacts Generated

### On Every probe_prod.sh Run

```
/tmp/ft_probe_<timestamp>/
├── 00_whoami.txt              # Forge auth (email, tenant)
├── 01_install_list.txt        # App installation proof
├── 02_git_head.txt            # Code version (git commit)
├── 10_logs_grouped.txt        # Full grouped logs (searchable)
├── 11_logs_raw.txt            # Full raw logs (searchable)
├── 20_entry_grouped.txt       # PROBE_ENTRY matches (plain text)
├── 21_ok_grouped.txt          # PROBE_OK matches (plain text)
├── 22_err_grouped.txt         # PROBE_ERR matches (plain text)
└── 23_probe_json_grouped.txt  # JSON marker matches
```

### On forensic_report.sh Run

```
/workspaces/Firsttry/FORENSIC_CHECK_REPORT.md

Structure:
1. Metadata (timestamp, environment, nonce tested, user)
2. Evidence Capture (log sizes, capture command)
3. Binary Search Results (table: evidence type vs found Y/N)
4. Evidence Excerpts (with file paths, max 30 lines each)
5. Diagnosis (Branch A/B/C/D with exact next actions)
```

---

## Key Design Decisions

### 1. Plain-Text Markers (Primary Proof)

**Why not JSON only?**
- JSON formatting can vary (whitespace, field order)
- JSON parser could change structure
- Grep by field value is fragile

**Why plain-text?**
- Immune to structural changes
- Cannot be optimized away
- Human readable + machine grepable
- Used `console.log()` (not debug)

### 2. Dual Log Capture (Grouped + Raw)

**Why not just one format?**
- Forge may return logs in different formats
- Grouped format may filter or reorganize
- Raw format preserves original stream

**Strategy:**
- Capture both formats
- Search both
- Pass if found in EITHER

### 3. Literal String Grep (-F flag)

**Why not regex?**
- User might be copying nonce that contains regex special chars
- Regex interpretation could give false matches
- `-F` is deterministic and safe

### 4. Binary Verdict Only (PASS/FAIL)

**Why not probability?**
- "Probably works" is not proof
- Compliance needs definitive answers
- Binary verdict (exit 0 or 2) is unambiguous

### 5. Conditional UI_REQ_ID Grep

**Why not always grep both nonce and ui_req_id?**
- If ui_req_id is empty/missing, grep would match everything
- Creates false evidence
- Only grep ui_req_id if `--ui` flag provided

### 6. Decision Tree Diagnosis (4 Branches)

**Why categorize failures?**
- Different causes require different fixes
- Branch A (logs empty) needs different action than Branch B (no markers)
- Operator can self-diagnose and self-fix

---

## Success Criteria

### ✅ PROOF IS VALID if:

1. **UI displays nonce visibly**
   - Green ✅ PROBE SUCCESS appears
   - PROOF LINES section shows nonce clearly
   - Full JSON response is readable

2. **Script finds nonce in logs**
   - `bash tools/probe_prod.sh --nonce <nonce>` exits with **0**
   - Output says: `✅ PASS: Nonce found in production logs`
   - First matching log line is printed (proves exact grep)

3. **Nonce is exact match**
   - Generated nonce (backend) = displayed nonce (UI) = found nonce (logs)
   - Binary match, not fuzzy, no approximation

4. **Markers are present**
   - At least one of PROBE_ENTRY/PROBE_OK/PROBE_ERR found
   - OR JSON marker found
   - Proves backend logging was executed

### ❌ PROOF FAILS if:

1. ❌ `bash tools/probe_prod.sh` exits with **2** (FAIL)
2. ❌ No markers found at all
3. ❌ Logs empty or not captured
4. ❌ Nonce mismatch (UI value ≠ log value)

---

## Regulatory Compliance

This forensic framework provides evidence that satisfies:

- **Non-repudiation:** Nonce proves specific backend execution (not spoofed)
- **Auditability:** All evidence preserved in `/tmp/ft_probe_*` bundles
- **Repeatability:** Same nonce produces same proof every time
- **Determinism:** Binary outcomes (no guessing, no probabilistic reasoning)
- **Chain of Custody:** Evidence includes timestamps, environment, auth proof

---

## Files to Review

| File | Lines | Status | Purpose |
|------|-------|--------|---------|
| `tools/forensic_report.sh` | 369 | NEW | Diagnostic report generation |
| `tools/probe_prod.sh` | 257 | UPDATED | Production verification |
| `src/resolvers/probe.ts` | 265 | UPDATED | Backend with unmissable logging |
| `src/gadget-ui/src/main.ts` | ~1823 | VERIFIED | UI with runProbe() function |
| `src/gadget-ui/index.html` | ~120 | VERIFIED | Probe widget |
| `FORENSIC_FRAMEWORK_DEPLOYMENT.md` | NEW | Instructions | Deployment & verification guide |

---

## Next Actions for Operator

1. **Review** this summary and `FORENSIC_FRAMEWORK_DEPLOYMENT.md`
2. **Deploy** using exact commands from Section 2 of deployment guide
3. **Execute** manual proof by clicking button in Jira
4. **Verify** using `bash tools/probe_prod.sh --nonce <nonce>`
5. **Archive** evidence bundle from `/tmp/ft_probe_<timestamp>/`
6. **Repeat** proof quarterly to demonstrate continued operation

---

## Support

**If proof fails:** Follow the troubleshooting section in `FORENSIC_FRAMEWORK_DEPLOYMENT.md`

**If diagnostics unclear:** Open `FORENSIC_CHECK_REPORT.md` and follow the decision tree for your branch (A/B/C/D)

**If still stuck:** Inspect evidence files directly:
```bash
ls -lh /tmp/ft_probe_<latest>/
less /tmp/ft_probe_<latest>/10_logs_grouped.txt
```
