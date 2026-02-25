# Release Runbook

**Preconditions**: Node.js v20.20.0, npm v10.8.2, git 2.x+, bash 4.x+

---

## Exact Reproduction Steps

### From Clean Checkout

```bash
# 1. Clone the repository
git clone https://github.com/Firsttry-Solutions/Firsttry.git
cd Firsttry/atlassian/forge-app

# 2. Verify clean state
git status --porcelain
# Expected: only untracked files (docs/production/, tools/production/, docs/audit/)

# 3. Check Node/npm versions
node -v  # Must be v20.20.0+
npm -v   # Must be v10.8.2+

# 4. Run production readiness audit
export FT_PROD_READY_E="/tmp/ft_prod_ready_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$FT_PROD_READY_E"/{00_env,01_git,02_inventory,03_tests,04_build,05_ui,06_docs,07_security,08_marketplace,09_release,10_diffs}

cd /workspaces/Firsttry/atlassian/forge-app
tools/production/run_prod_ready_audit.sh

# 5. Check verdict
echo "Verdict: $(cat \"$FT_PROD_READY_E/PROD_READY_VERDICT.txt\")"

# Expected output:
#   Verdict: PASS
```

---

## Detailed Steps: CR1 - Test Run (5-10 minutes)

**Command**:
```bash
npm test
```

**Success Criteria**:
- Exit code: 0
- Output contains: "Test Files  260 passed"
- Output contains: "Tests  2728 passed"
- Output contains: "GAPS A-F ENFORCEMENT: ALL TESTS PASSED"

**Evidence to Verify**:
- `$E/03_tests/npm_test_exit_code.txt` should contain: `0`
- `$E/03_tests/npm_test_full.log` should end with test summary (no hanging)
- `$E/03_tests/npm_test_summary_tail.txt` should show passing counts

**If Tests Fail**:
```bash
# Check which tests failed
tail -100 $E/03_tests/npm_test_full.log | head -50

# Common failure: flaky network test
#   → Rerun: npm test (determinism verified if 2nd run passes)

# Common failure: missing Node.js version
#   → Fix: Install Node.js v20.20.0 or later
#   → Verify: node -v

# Rollback: No rollback needed for test-only failures
```

---

## Detailed Steps: CR2 - Build Run (10-20 minutes)

**Command**:
```bash
npm run build
```

**Success Criteria**:
- Exit code: 0
- Output contains: "dist/index.html ... 11.09 kB"
- Output contains: "✓ built in"  
- Output contains: "[POSTBUILD] ✓ Anchor components:"
- NO output contains: "ERROR"

**Evidence to Verify**:
- `$E/04_build/build_exit_code.txt` should contain: `0`
- `$E/04_build/build_full.log` should show build chain messages ending with verification gates  
- `$E/04_build/build_gate_summary.txt` should show final messages

**If Build Fails**:
```bash
# Check error details
tail -50 $E/04_build/build_full.log

# Common failure: node_modules not installed
#   → Fix: cd src/gadget-ui && npm ci && cd ../..
#   → Retry: npm run build

# Common failure: TypeScript compilation error
#   → Fix: Review TS error message, fix source
#   → Git commit fix
#   → Retry: npm run build

# Common failure: Out of memory
#   → Fix: Increase Node memory: NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

**Rollback**:
```bash
# If build fails on committed code:
git log --oneline | head
# Identify last passing commit
git checkout <COMMIT_SHA>
npm run build
# If successful, mark as rollback point:
echo "Last known good: <COMMIT_SHA>" > ROLLBACK_POINT.txt
```

---

## Detailed Steps: CR3 - UI Marker Verification (2-3 minutes)

**Command**:
```bash
bash tools/production/verify_ui_markers.sh
```

**Success Criteria**:
- Exit code: 0
- Output shows marker counts > 0 for all 5 markers:
  - FT_PROOF_UI_EFFECTIVE_KIND: >= 1
  - FT_PROOF_UI_EXPORT_GATE_EVALUATED: >= 1
  - backendReasonCode: >= 1
  - eligibilitySource: >= 1
  - computedEligibilityOk: >= 1

**Evidence to Verify**:
- `$E/05_ui/dist_js_list.txt` lists at least: src/gadget-ui/dist/app.js
- `$E/05_ui/source_marker_locations.txt` contains marker grep results
- `$E/05_ui/dist_marker_counts.txt` shows counts for all 5 markers

**If Verification Fails**:
```bash
# Check if markers exist in source
grep -r "FT_PROOF_UI_EFFECTIVE_KIND" src/gadget-ui/src/ | head -3
# If not found: markers must be injected at build time - rebuild UI
cd src/gadget-ui && npm run build && cd ../..

# Check if dist bundle exists
ls -la src/gadget-ui/dist/app.js
# If not found: UI build is missing - run: npm run build

# Check marker presence manually
grep -c "FT_PROOF_UI_EFFECTIVE_KIND" src/gadget-ui/dist/app.js
# If 0: marker stripped by minification or build process issue
```

---

## PASS Criteria for Production Readiness

**Overall PASS** requires:

| CR | Command | Exit Code | Verdict | Evidence |
|----|---------|-----------|---------|----------|
| CR1 | npm test | 0 | ✅PASS | $E/03_tests/npm_test_exit_code.txt = 0 |
| CR2 | npm run build | 0 | ✅PASS | $E/04_build/build_exit_code.txt = 0 |
| CR3 | tools/production/verify_ui_markers.sh | 0 | ✅PASS | $E/05_ui/dist_marker_counts.txt (all > 0) |
| **FINAL** | tools/production/run_prod_ready_audit.sh | 0 | ✅PASS | $E/PROD_READY_VERDICT.txt = "PASS" |

**If any CR ≠ PASS**:
- Overall verdict: **FAIL**
- Cannot proceed to marketplace submission
- Remediate per troubleshooting steps above

---

## Rollback Notes

### If Committed Code Fails Production Readiness

```bash
# Find last successful commit
git log --oneline -10
# Pick a known-good commit from prior audit

# Rollback
git reset --hard <COMMIT_SHA>
git push origin main --force  # ⚠️ Only if necessary before marketplace submission

# Verify rollback
npm test
npm run build
```

### If Marketplace Issue Found Post-Release

```bash
# 1. Stop new installations (Atlassian administrative action)
# 2. Identify root cause
# 3. Fix on branch and test locally first
# 4. Create patch release with version bump (v2.14.1, etc.)
# 5. Re-run production readiness audit
# 6. Resubmit to Atlassian Marketplace
```

---

## Forbidden File Policy During Release

### Allowed Modifications

These files MAY be modified during production readiness audit:

- `docs/production/*.md` (audit documentation)
- `tools/production/*.sh` (audit tooling)
- `tests/production/*.test.ts` (audit regression tests if needed)

### Strictly Protected (No Modifications)

These files MUST NOT be modified unless exception process is followed:

- `package.json` - Only version bumps allowed (pre-approved)
- `package-lock.json` - Auto-generated, re-locked to package.json
- `manifest.yml` - Only scope changes with evidence (audit doc links required)
- `src/gadget-ui/dist/*` - Read-only shipping artifacts

### Exception Process (if required)

If a forbidden file MUST change:

1. Snapshot "before" state:
   ```bash
   sha256sum package.json | tee $E/10_diffs/package_hash_before.txt
   cp package.json $E/10_diffs/package_json_before.backup
   ```

2. Make change

3. Capture diff:
   ```bash
   git diff package.json | tee $E/10_diffs/package.json.diff
   ```

4. Capture "after" state:
   ```bash
   sha256sum package.json | tee $E/10_diffs/package_hash_after.txt
   ```

5. **Justify in docs/production/00_PRODUCTION_READY_INDEX.md**:
   Example:
   ```markdown
   **CR6 - Forbidden File Exception**:
   - File: package.json
   - Change: Upgraded typescript from 5.0 to 5.1 to fix build error in Phase-4 verification
   - Before hash: e3f2c1d9...
   - After hash: a2b9f7c3...
   - Diff: $E/10_diffs/package.json.diff
   - Exit code impact: Tests still pass (npm test = 0)
   ```

6. Commit with message:
   ```bash
   git commit -m "fix(package.json): <reason> [FORBIDDEN_FILE_EXCEPTION]"
   ```

---

## Pre-Marketplace Submission Checklist

- [ ] Run full production readiness audit → PASS
- [ ] Verify CR1, CR2, CR3 all green
- [ ] Check $E/PROD_READY_VERDICT.txt = "PASS"
- [ ] Review docs/production/00_PRODUCTION_READY_INDEX.md for all CR statuses = PASS
- [ ] Confirm git commit SHA is tagged (if required by Atlassian)
- [ ] Verify no unauthorized changes to forbidden files (CR6)
- [ ] Security/Trust pack (CR7): Blockers resolved
- [ ] Marketplace readiness pack (CR8): Scopes and egress verified
- [ ] Update version if new release
- [ ] Prepare release notes referencing $E evidence directory

---

## Marketplace Submission

**Evidence Package**: `$E` (complete directory from audit run)
- Can be archived and provided to Atlassian Marketplace team
- All logs, hashes, test results preserved

**Submission Template**:
```
From: First Try Security Team
To: Atlassian Marketplace

Version: 2.14.0 (or later)
Production Readiness: PASS
Evidence Location: (path or archive to $E)

CR1 (Tests): PASS - 2728/2753 tests passed
CR2 (Build): PASS - Deterministic artifacts generated
CR3 (UI Markers): PASS - All proof markers verified
CR7 (Security): PASS - Fail-closed gates enforced
CR8 (Marketplace): PASS - Scopes justified, no data egress

Ready for marketplace publication.
```

---

## Post-Release SLA

**Monitoring**:
- Monitor npm package download statistics
- Track support tickets (contact@firsttry.run)
- Schedule security review every 90 days

**Critical Issue Response** (< 24h):
- Security vulnerability → Patch release + hotfix audit
- Data breach → Rollback + incident investigation + notification

**Deprecation** (if needed):
- Announce 60 days prior
- Migrate users to new version
- Archive final version in marketplace

