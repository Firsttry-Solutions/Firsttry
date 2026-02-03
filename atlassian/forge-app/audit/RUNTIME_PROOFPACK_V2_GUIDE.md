#!/usr/bin/env bash
# audit/runtime_proofpack_v2.md
# 
# Runtime Evidence Collector v2 - Documentation & User Guide

## Overview

`audit/runtime_proofpack_v2.sh` is a non-bypassable, fail-closed runtime evidence collector
that gathers cryptographically-verified proof that Phase 9 Dashboard is real and operational
in production Jira.

**Key Properties:**
- ✅ NO simulated evidence (all real Forge CLI + browser outputs only)
- ✅ Fail-closed execution (STOP immediately on any validation failure)
- ✅ SHA-256 integrity verification on all artifacts
- ✅ Auto-generated reports (no manual text blocks, purely mechanical)
- ✅ 7-phase evidence collection with clear pass/fail criteria

---

## Usage

### Basic Execution

```bash
bash audit/runtime_proofpack_v2.sh
```

### With Environment Variables

```bash
# Specify production environment (default)
FORGE_ENV=production bash audit/runtime_proofpack_v2.sh

# Specify log window (default: 20m)
LOG_SINCE=30m bash audit/runtime_proofpack_v2.sh

# Specify custom output directory (default: /tmp/ft_proofpack_v2_<timestamp>)
RUN_DIR=/custom/path bash audit/runtime_proofpack_v2.sh
```

### Combined

```bash
FORGE_ENV=production LOG_SINCE=20m RUN_DIR=/tmp/my_proof bash audit/runtime_proofpack_v2.sh
```

---

## Execution Flow

### PHASE 0: Baseline Establishment

**Actions:**
- Capture git HEAD commit SHA
- Verify git working tree is clean (no uncommitted changes)
- Capture RUN_DIR path and timestamp

**Validation:**
- ✓ `git status --porcelain=v1` must be empty
- Fails if: any uncommitted files exist

**Artifacts:**
- `00_run_dir.txt` - RUN_DIR path (for reference)
- `01_head.txt` - git HEAD commit SHA
- `02_git_status.txt` - git status (should be empty)

---

### PHASE 1: Real Forge Authentication

**Actions:**
- Execute: `forge whoami` (authenticate with Forge CLI)
- Capture output and exit code

**Validation:**
- ✓ Command must exit with code 0
- ✓ Must be real authentication (requires FORGE_EMAIL + FORGE_API_TOKEN env vars)

**Artifacts:**
- `10_forge_whoami.txt` - Real Forge CLI output (account info)
- `10_forge_whoami_exit.txt` - Exit code (must be 0)

**STOP Reason:** Exit code ≠ 0 or authentication failed

---

### PHASE 2: Production Logs BEFORE User Refresh

**Actions:**
- Execute: `forge logs --environment $FORGE_ENV --since $LOG_SINCE`
- Capture real production logs from Forge backend

**Validation:**
- ✓ Command must exit with code 0
- ✓ Output must be non-empty (at least 1 log line)

**Artifacts:**
- `20_logs_before.txt` - Real production logs (before manual refresh)
- `20_logs_before_exit.txt` - Exit code (must be 0)

**STOP Reason:** Empty logs or exit code ≠ 0

---

### PHASE 3: Manual Evidence Collection Instructions

**Actions:**
- Generate `30_MANUAL_STEPS.txt` with 5-step user instructions
- NO simulated data (only instructions for human action)
- Instructions enforce real browser collection (hard refresh, console, screenshot)

**Validation:**
- ✓ File created (purely instructional, no executable code)

**Artifacts:**
- `30_MANUAL_STEPS.txt` - 5-step manual protocol (read-only instructions)

**Note:** This is the only file in the proof pack that can be manually authored.
All other evidence must come from real command outputs.

---

### PHASE 3B: Manual Artifacts Validation

**User Actions (before continuing):**
1. Open https://firsttry.atlassian.net/jira/dashboards/10102
2. Hard refresh browser (Ctrl+Shift+R)
3. Open DevTools → Console
4. Copy console output → save as `31_browser_console.txt`
5. Screenshot dashboard → save as `32_dashboard.png`
6. Place both files in the RUN_DIR (printed by script)

**Validation:**
- ✓ `31_browser_console.txt` must exist and size > 0 bytes
- ✓ `32_dashboard.png` must exist and size > 0 bytes

**STOP Reason:** Either file missing or empty

**Artifacts:**
- `31_browser_console.txt` - Real browser console (captured by user)
- `32_dashboard.png` - Real screenshot (captured by user)

---

### PHASE 4: Production Logs AFTER User Refresh

**Actions:**
- Execute: `forge logs --environment $FORGE_ENV --since $LOG_SINCE` (second time)
- Capture logs AFTER user refreshed dashboard
- Should contain new resolver invocations triggered by the refresh

**Validation:**
- ✓ Command must exit with code 0
- ✓ Output must be non-empty

**Artifacts:**
- `40_logs_after.txt` - Real production logs (after manual refresh)
- `40_logs_after_exit.txt` - Exit code (must be 0)

**STOP Reason:** Empty logs or exit code ≠ 0

---

### PHASE 5: Resolver Marker Extraction

**Actions:**
- Extract resolver invocation markers from `40_logs_after.txt`
- Pattern: `[FT_RESOLVER_ENTRY]` AND `ft_getDashboardState_v1`
- Use grep (mechanical extraction only, no simulation)

**Validation:**
- ✓ Must find at least 1 line matching both patterns
- ✓ Extraction must produce non-empty output file

**Artifacts:**
- `50_resolver_extract.txt` - Real resolver invocations (extracted via grep)

**STOP Reason:** No matches found

**Example Output:**
```
INFO    2026-02-03T14:56:20.410Z 4ed20a2a-d0c7-4e49-b1db-d38eeb4170fd {"marker":"[FT_RESOLVER_ENTRY]","resolver":"ft_getDashboardState_v1","correlationId":"unknown","uiReqId":"unknown","ts":"2026-02-03T14:56:20.410Z"}
```

---

### PHASE 5B: Console Marker Extraction

**Actions:**
- Extract UI build identity markers from `31_browser_console.txt` (user-captured)
- Pattern: `[UI_BUILD_IDENTITY_CONFIRMED]` OR `[UI_ENTRY_RUNTIME_PROOF]`
- Use grep (mechanical extraction only)

**Validation:**
- ✓ Must find at least 1 line matching either pattern
- ✓ Extraction must produce non-empty output file

**Artifacts:**
- `51_console_extract.txt` - Real console markers (extracted via grep)

**STOP Reason:** No matches found

**Example Output:**
```
[UI_BUILD_IDENTITY_CONFIRMED] git_sha=91884ff67c435497b5456501df540bd7f920c1a4 | bundle_hash=91884ff | time=2026-02-03T13:13:16Z
```

---

### PHASE 6: SHA-256 Integrity Hashing

**Actions:**
- Hash all 14 evidence artifacts with SHA-256
- Use `sha256sum` (no manual hash computation)
- Output to `HASHES.txt` in canonical format

**Validation:**
- ✓ All hashes must be 64 hex characters
- ✓ One hash per artifact, one artifact per line

**Artifacts:**
- `HASHES.txt` - Master hash file (cryptographic chain of custody)

**Example:**
```
aa441ddea5518efc6d56e4eb4c1874ce0b0357446c5271f2a7926cb747e1bd7c  31_browser_console.txt
aa873e893f0711a38640ead1c2bfe730a66c5e367b1b5023a8fb926d178257b9  32_dashboard.png
```

---

### PHASE 7: Final Report Generation

**Actions:**
- Auto-generate `60_FINAL_REPORT.md` from:
  - Artifact hashes (verbatim from HASHES.txt)
  - First 20 lines of resolver extract
  - First 50 lines of console extract
  - Resolver count (computed from extract)
  - HEAD commit SHA
  - Timestamps
- NO manual text blocks (purely mechanical)

**Validation:**
- ✓ Report must be generated successfully
- ✓ Report hash added to HASHES.txt

**Artifacts:**
- `60_FINAL_REPORT.md` - Auto-generated comprehensive report

---

## Artifact Inventory

**Total Files:** 15 (14 evidence + 1 optional STOP_REASON)

| # | Artifact | Size | Source | Verification |
|---|----------|------|--------|--------------|
| 1 | `00_run_dir.txt` | <1KB | RUN_DIR path | Baseline |
| 2 | `01_head.txt` | 41B | `git rev-parse HEAD` | Git baseline |
| 3 | `02_git_status.txt` | 0B | `git status --porcelain` | Must be empty |
| 4 | `10_forge_whoami.txt` | ~500B | `forge whoami` | Real auth |
| 5 | `10_forge_whoami_exit.txt` | 1B | Exit code capture | Must be 0 |
| 6 | `20_logs_before.txt` | 1-10KB | `forge logs` (before) | Real logs |
| 7 | `20_logs_before_exit.txt` | 1B | Exit code capture | Must be 0 |
| 8 | `30_MANUAL_STEPS.txt` | ~2KB | Manual instructions | Human action guide |
| 9 | `31_browser_console.txt` | 10-50KB | User captures from browser | Real console output |
| 10 | `32_dashboard.png` | 50-200KB | User screenshot | Real UI rendering |
| 11 | `40_logs_after.txt` | 1-10KB | `forge logs` (after) | Real logs |
| 12 | `40_logs_after_exit.txt` | 1B | Exit code capture | Must be 0 |
| 13 | `50_resolver_extract.txt` | 0.5-5KB | grep from 40_logs_after.txt | Real resolver calls |
| 14 | `51_console_extract.txt` | 0.5-2KB | grep from 31_browser_console.txt | Real UI markers |
| 15 | `HASHES.txt` | ~0.5KB | `sha256sum` (all above) | Cryptographic chain |
| **FINAL** | `60_FINAL_REPORT.md` | ~10-15KB | Auto-generated from artifacts | Comprehensive report |

**Optional:** `STOP_REASON.txt` (only if script fails before completion)

---

## Fail-Closed Execution Rules

The script enforces strict STOP conditions at every phase:

1. **PHASE 0 STOP:** Git working tree has uncommitted changes
2. **PHASE 1 STOP:** `forge whoami` exit code ≠ 0
3. **PHASE 2 STOP:** `forge logs` exit code ≠ 0 or empty output
4. **PHASE 3B STOP:** `31_browser_console.txt` missing or empty
5. **PHASE 3B STOP:** `32_dashboard.png` missing or empty
6. **PHASE 4 STOP:** `forge logs` (after) exit code ≠ 0 or empty
7. **PHASE 5 STOP:** No resolver markers found (grep returns 0 matches)
8. **PHASE 5B STOP:** No console markers found (grep returns 0 matches)

**Effect:** If ANY validation fails, script exits immediately and creates `STOP_REASON.txt`
with exact failure reason. No partial or incomplete proof packs.

---

## Verification & Quality

### Cryptographic Integrity

All 15 artifacts are SHA-256 hashed. The hash file `HASHES.txt` serves as:
- Integrity proof (detect tampering)
- Chain of custody (timestamp + hash)
- Reproducibility (verify same outputs again)

To verify hashes later:
```bash
cd /path/to/RUN_DIR
sha256sum -c HASHES.txt
```

### Report Authenticity

The final report `60_FINAL_REPORT.md` is **purely mechanical** and **never fabricated**:
- All evidence snippets extracted from real hashed artifacts
- Resolver count computed from extract file
- No manually-written sample logs or fabricated outputs
- Report itself is hashed and included in HASHES.txt

### No Simulation

Throughout the entire 7-phase collection:
- ✗ NO `echo` > fake logs
- ✗ NO `cat <<EOF` simulated console output
- ✗ NO template-based report blocks
- ✓ ONLY real `forge` CLI outputs
- ✓ ONLY real browser artifacts (user-captured)
- ✓ ONLY mechanical grep extraction
- ✓ ONLY sha256sum for hashing

---

## Example Success Output

```
=== PHASE 0: Baseline Establishment ===
✓ PHASE 0 complete (baseline established)

=== PHASE 1: Real Forge Authentication ===
✓ PHASE 1 complete (forge authenticated)

=== PHASE 2: Production Logs BEFORE ===
✓ PHASE 2 complete (pre-refresh logs captured)

=== PHASE 3: Manual Evidence Collection Instructions ===
✓ PHASE 3 complete (manual instructions created)

=== PHASE 3B: Validate Manual Artifacts ===
✓ Manual artifacts validated (both exist and non-empty)

=== PHASE 4: Production Logs AFTER ===
✓ PHASE 4 complete (post-refresh logs captured)

=== PHASE 5: Resolver Marker Extraction ===
✓ PHASE 5 complete (2 resolver invocations extracted)

=== PHASE 5B: Console Marker Extraction ===
✓ PHASE 5B complete (console markers extracted)

=== PHASE 6: Artifact Integrity Hashing ===
✓ PHASE 6 complete (14 artifacts hashed)

=== PHASE 7: Final Report Generation ===
✓ PHASE 7 complete (report auto-generated)

=======================================================================
✅ ALL PHASES COMPLETE (Fail-Closed Protocol Enforced)
=======================================================================

RUN_DIR: /tmp/ft_proofpack_v2_20260203T145048Z
Report:  /tmp/ft_proofpack_v2_20260203T145048Z/60_FINAL_REPORT.md
Hashes:  /tmp/ft_proofpack_v2_20260203T145048Z/HASHES.txt

Total artifacts collected: 15
All hashes verified in: HASHES.txt
```

---

## Example STOP Output

```
=== PHASE 0: Baseline Establishment ===
STOP: Git working tree has uncommitted changes

STOP: Git working tree has uncommitted changes >&2
```

The script will also create:
```
cat $RUN_DIR/STOP_REASON.txt
> STOP: Git working tree has uncommitted changes
```

---

## Integration with CI/CD

The script can be integrated into CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Collect Runtime Evidence
  env:
    FORGE_ENV: production
    LOG_SINCE: 20m
  run: bash audit/runtime_proofpack_v2.sh
```

The script will:
- Exit code 0 on success (all phases complete)
- Exit code 1 on failure (any validation fails)
- Create STOP_REASON.txt with failure details for CI logging

---

## Troubleshooting

### "forge whoami exit code ≠ 0"

**Cause:** Forge CLI not authenticated
**Solution:**
```bash
export FORGE_EMAIL="your-email@example.com"
export FORGE_API_TOKEN="your-api-token"
bash audit/runtime_proofpack_v2.sh
```

### "31_browser_console.txt does not exist"

**Cause:** Manual evidence collection not performed
**Solution:**
1. Run script (will pause at PHASE 3B)
2. Check RUN_DIR printed by script
3. Follow 30_MANUAL_STEPS.txt instructions
4. Place files in RUN_DIR
5. Re-run script

### "No resolver markers found"

**Cause:** Dashboard not invoked or resolver logs not captured
**Solution:**
- Ensure you actually loaded the dashboard in browser (PHASE 3B instructions)
- Verify LOG_SINCE window is large enough to capture the refresh
- Try increasing LOG_SINCE: `LOG_SINCE=30m bash audit/runtime_proofpack_v2.sh`

### "No console markers found"

**Cause:** Browser console output doesn't contain UI identity markers
**Solution:**
- Verify hard refresh was performed (Ctrl+Shift+R, not just F5)
- Ensure console was open DURING refresh to capture markers
- Check that copied text is complete (no truncation)

---

## Security & Privacy

The script:
- ✅ Never logs credentials (FORGE_API_TOKEN never printed)
- ✅ Never modifies Jira data (read-only collection only)
- ✅ Never sends data externally (local file collection only)
- ✅ Respects Forge CLI authentication (uses existing auth)
- ✅ No personal data stored (only operational evidence)

---

## Next Steps

After successful completion:

1. **Review Report:** Read `60_FINAL_REPORT.md` for full summary
2. **Verify Hashes:** `cd $RUN_DIR && sha256sum -c HASHES.txt`
3. **Archive Proof:** Compress and store `$RUN_DIR` for audit trail
4. **Share Evidence:** Provide proof pack to reviewers/stakeholders

---

**Created:** 2026-02-03
**Version:** 2.0 (Fail-Closed Enterprise Protocol)
**Status:** Production Ready

