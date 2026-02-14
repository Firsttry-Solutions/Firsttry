# FirstTry Stability Contract
**Version**: 1.0  
**Date**: 2026-02-14  
**Status**: Locked (Non-Bypassable)

---

## Executive Summary

FirstTry Phase 3 follows a "boring, predictable" stability model:
- **Deterministic** exports (identical SHA-256 across runs with fixed inputs)
- **Fail-closed** gates (failures abort, never silent fallback)
- **Evidence-driven** testing (every change has proof logs)
- **No optional tests** (all contract tests must pass)
- **Controlled environment** (Node/npm versions pinned)

This document defines the stability guarantees and operational expectations.

---

## Core Definitions

### Fail-Closed
An operation that encounters an error **must** abort with explicit error state. No silent fallback. No "best effort." Marker: `[FT_FAIL_CLOSED]`.

### Deterministic
Output is **identical** across multiple runs given identical inputs (same snapshot, same decisions, same review ID). Enforced via:
- Stable key ordering (JSON keys sorted)
- Stable file ordering (ZIP entries lexicographic)
- Injected timestamps (FT_FIXED_UTC environment variable)
- No randomness in hashes or filenames

### Evidence Directory
Timestamped directory (`/tmp/ft_*_<timestamp>/`) containing:
- Log files from gate executions
- Hashes of generated files
- Compilation outputs
- Test results
- Used for incident triage

### Contract Tests
Mandatory test suite that MUST pass in all gates:
- `tests/access-review.test.ts` (17 tests)
- `tests/performance-phase3.test.ts` (7 tests)
- **Total**: 24/24 tests required
- Failure = gate failure (no bypass)

---

## What is Guaranteed

✅ **Export Determinism**  
Same snapshot + decisions + fixed UTC = identical SHA-256 pack hash

✅ **Fail-Closed Behavior**  
Any required call failure (lock acquire, API fetch, parse) → explicit [FT_FAIL_CLOSED] + abort

✅ **Test Repeatability**  
20 consecutive runs with fixed timestamp produce identical hashes

✅ **Environment Stability**  
Node and npm versions pinned; version mismatch detected before build

✅ **Error Observability**  
All errors include FTError code + evidence directory ID for triage

---

## What is NOT Guaranteed

❌ **Real-Time Performance**  
Execution time varies with system load; only relative regression matters

❌ **Infinite Backward Compatibility**  
Schema changes allowed if documented and gates updated

❌ **Recovery from Data Corruption**  
If lock/cache/snapshot corrupted, manual intervention required

❌ **Cross-Environment Compatibility**  
Only Node 20.x and npm 10.x tested; other versions may fail

---

## Supported Environments

| Tool | Version | Source | Required |
|------|---------|--------|----------|
| Node | 20.20.0+ | `.nvmrc` | YES |
| npm | 10.8.2+ | `package.json` engines | YES |
| TypeScript | 5.x | Strict mode | YES |
| Vitest | Latest in lock | Contract tests | YES |

**Setup**:
```bash
nvm use         # or: node --version must match .nvmrc
npm ci           # Exact installs from package-lock.json
```

**Verification**:
```bash
bash scripts/proof/guard_runtime_versions.sh
```

---

## Gate Scripts & Meaning

| Script | Markers | Failure Mode |
|--------|---------|--------------|
| `guard_runtime_versions.sh` | [FT_RUNTIME_OK] / ERROR | Node/npm mismatch |
| `verify_phase3_refinements.sh` | [FT_PROOF] / ERROR | Compilation or contract tests fail |
| `ship_phase3_gate.sh` | [FT_PHASE3_SHIP_GATE_PASS] | Any gate fails |
| `run_repeatability_20.sh` | [FT_REPEATABILITY_20_PASS] | Hash drift in 20 runs |
| `ship_stability_lock.sh` | [FT_STABILITY_LOCK_PASS] | Any hardening gate fails |

---

## "No Optional Tests" Pledge

### Policy
- **ZERO** `|| true` in test execution
- **ZERO** `skip()` or `todo()` in contract tests
- **ZERO** best-effort paths (fail-closed always)
- Test failure = gate failure = no merge

### Verification
```bash
rg "skip\(|todo\(|\|\| true" scripts/proof tests/
# Should return ZERO matches for contract tests

rg "optional|best.effort" scripts/proof/
# Should return ZERO matches
```

---

## Incident Triage Playbook

### Scenario: "Export hash differs between runs"

1. **Find evidence directory**
   ```bash
   ls -ltr /tmp/ft_*/ | tail -5
   cd /tmp/ft_repeatability_20_<timestamp>/
   ```

2. **Check for obvious issues**
   ```bash
   cat hashes.txt | sort | uniq -c
   # If count != 20: some runs had different hash
   ```

3. **Identify drift source**
   ```bash
   # Search for timestamps in pack
   unzip -l pack_run_*.zip | grep -i time
   
   # Check if timestamps injected
   echo $FT_FIXED_UTC
   
   # Review logs
   grep -i "timestamp\|random\|date" repeatability_20.log
   ```

4. **Check environment changed**
   ```bash
   node -v
   npm -v
   npm list | head -20  # Package drift?
   ```

### Scenario: "Test fails intermittently"

1. **Check test markers**
   ```bash
   grep "\[FT_REVIEW\]\|\[FT_COMPLIANCE\]" test_output.log
   ```

2. **Run repeatability test**
   ```bash
   bash scripts/proof/run_repeatability_20.sh
   # If this passes, it's likely flaky test not core logic
   ```

3. **Check for time-dependent assertions**
   ```bash
   grep -n "Date\|now\|setTimeout" tests/
   ```

### Scenario: "Runtime version mismatch in CI"

1. **Check .nvmrc and package.json**
   ```bash
   cat .nvmrc
   cat package.json | jq .engines
   ```

2. **Update both consistently**
   ```bash
   node -v  # Current version
   # Update .nvmrc and package.json engines to match
   git add .nvmrc package.json
   ```

3. **Verify gate**
   ```bash
   bash scripts/proof/guard_runtime_versions.sh
   ```

---

## Operational Runbook

### Daily Checks
```bash
# Morning: Verify environment hasn't drifted
bash scripts/proof/guard_runtime_versions.sh

# Before merge: Run full ship gate
bash scripts/proof/ship_stability_lock.sh 2>&1 | tee /tmp/daily_ship.log
tail -20 /tmp/daily_ship.log
```

### Adding New Features (Stability Impact)

1. **Update docs/STABILITY_CONTRACT.md** if:
   - New environment requirement added
   - New gate script created
   - Determinism assumption changed

2. **Add determinism test** if:
   - New export field added
   - New timestamp/random source introduced

3. **Run repeatability test**
   ```bash
   bash scripts/proof/run_repeatability_20.sh
   ```

4. **Include evidence** in commit message:
   ```
   [FT_STABILITY] Determinism test passed (run_repeatability_20.sh)
   [FT_EVIDENCE] /tmp/ft_repeatability_20_<timestamp>/
   ```

---

## Status

✅ **LOCKED** — All hardening gates in place  
✅ **NON-BYPASSABLE** — set -euo pipefail + trap enforcement  
✅ **AUDITABLE** — Evidence logs timestamped and archived  

### Last Lock Update
- **Commit**: 1b886c81
- **Date**: 2026-02-14 09:16:51 UTC
- **Gates Passing**: 5/5 (stability lock gates)

---

**Note**: This document is version-controlled. Changes require:
1. Update this file
2. Run all gates
3. Commit with evidence
4. Update README if user-visible change
