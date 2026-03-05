# Reviewer E2E Evidence Pack - Quick Reference

## One-Command Usage

### Build Evidence Pack
```bash
export JIRA_BASE_URL="https://firsttry-solutions.atlassian.net"
export JIRA_DASHBOARD_URL="https://firsttry-solutions.atlassian.net/jira/dashboards/10001"
./tools/reviewer_demo/proof_pack/build_reviewer_proof_pack.sh
```

### Verify Evidence Pack
```bash
./tools/reviewer_demo/proof_pack/verify_reviewer_proof_pack.sh /tmp/ft_reviewer_e2e_*
```

---

## Evidence Pack Structure
```
/tmp/ft_reviewer_e2e_YYYYMMDDTHHMMSSZ/
├── summary.json                   # Test verdict (PASS/FAIL)
├── gadget_verdict.json            # Gadget detection result
├── allowlists.json                # Console + network allowlists
├── reviewer_env.json              # Environment validation
├── manifest.sha256                # SHA256 of all files
├── PROOF_PACK_SHA256.txt          # Hash of manifest (tamper-evidence)
├── FINAL_VERDICT.txt              # PASS or FAIL
└── 04_playwright/
    ├── screenshots/               # 4 PNGs + HTML + metadata
    ├── logs/                      # Console + errors
    └── network/                   # Requests + domains
```

---

## PASS Criteria

Test passes if ALL of these are true:
- ✅ Dashboard loads (HTTP 200)
- ✅ Iframe detected (score ≥ 4)
- ✅ Gadget present (`gadget_present=true`)
- ✅ No page errors
- ✅ No non-allowlisted app console errors
- ✅ All network domains allowlisted
- ✅ All required artifacts present

Test fails if ANY of these are true:
- ❌ Missing `FT_REVIEWER_EVIDENCE_DIR` env var
- ❌ Dashboard doesn't load
- ❌ No iframe found
- ❌ Iframe score < 4
- ❌ `gadget_present=false`
- ❌ Page errors detected
- ❌ Non-allowlisted app console errors
- ❌ Unknown network domains
- ❌ Missing required artifacts

---

## Console Error Classification

| Origin | Blocking? | Description |
|--------|-----------|-------------|
| **HOST** | No | Atlassian Jira platform (`*.atlassian.net`) |
| **FORGE_RUNTIME** | No | Forge runtime (`*.atl-paas.net`) |
| **APP** | **Yes** | FirstTry app code (everything else) |
| **UNKNOWN** | **Yes** | No URL available |

**Allowlisted patterns:**
- `FT_PROOF_UI_BUNDLE_HASH_UNAVAILABLE` (dev-only)
- `UI_SERVE_MISMATCH` (Forge benign)
- `net::ERR_ABORTED` (expected 404s)
- `404 ()` (static assets)

---

## Gadget Verdict Rules (Non-Bypassable)

```typescript
gadget_present = iframe_score >= 4 && (frame_accessible || cross_origin_blocked)
```

**Iframe scoring:**
- +3 if src contains `"atl-paas.net"`
- +2 if src contains `"forge"`
- +2 if size > 200×120
- +1 if visible

**Typical Forge iframe:** 5 points (atl-paas.net + size)

---

## Tamper-Evidence

### How It Works
1. **Manifest:** SHA256 of all files → `manifest.sha256`
2. **Pack hash:** SHA256 of manifest → `PROOF_PACK_SHA256.txt`
3. **Verification:** Recompute manifest, compare → detect tampering

### Verify Offline
```bash
cd /tmp/ft_reviewer_e2e_20260304T172011Z
find . -type f ! -name "manifest.sha256" ! -name "PROOF_PACK_SHA256.txt" ! -name "FINAL_VERDICT.txt" | sort | xargs sha256sum > /tmp/recomputed.sha256
diff manifest.sha256 /tmp/recomputed.sha256
# No output = intact
```

---

## Troubleshooting

### "FT_REVIEWER_EVIDENCE_DIR environment variable is required"
**Fix:**
```bash
export FT_REVIEWER_EVIDENCE_DIR=/tmp/my_evidence_dir
mkdir -p "$FT_REVIEWER_EVIDENCE_DIR"
```

### "app console error(s) detected"
**Fix:** Check `04_playwright/logs/console_classified.json` for APP errors.
Add to `CONSOLE_ALLOWLIST` in test spec if benign.

### "Manifest mismatch (tampering detected)"
**Fix:** Do not modify evidence pack files. Regenerate fresh pack.

### "No iframes found on dashboard"
**Fix:** Dashboard may not have gadgets configured. Check Jira dashboard URL.

---

## Advanced Usage

### Custom Evidence Directory
```bash
export FT_REVIEWER_EVIDENCE_DIR=/mnt/nfs/evidence/run_12345
npx playwright test --config=playwright.reviewer.config.ts tests/playwright/reviewer_dashboard_e2e.spec.ts
```

### Archive Evidence Pack
```bash
cd /tmp
tar czf evidence.tar.gz ft_reviewer_e2e_20260304T172011Z/
# Verify after extraction
tar xzf evidence.tar.gz
./tools/reviewer_demo/proof_pack/verify_reviewer_proof_pack.sh ft_reviewer_e2e_20260304T172011Z/
```

### CI/CD Integration
See: [docs/reviewer/REVIEWER_E2E_PROOF_PACK.md](docs/reviewer/REVIEWER_E2E_PROOF_PACK.md#cicd-integration)

---

## File Reference

| File | Purpose |
|------|---------|
| `build_reviewer_proof_pack.sh` | Build evidence pack |
| `verify_reviewer_proof_pack.sh` | Verify evidence pack offline |
| `canonical_json.py` | Format JSON with sorted keys |
| `sha256_manifest.sh` | Generate deterministic manifest |
| `REVIEWER_E2E_PROOF_PACK.md` | Full documentation (683 lines) |

---

## Exit Codes

### Builder
- `0` = Test PASSED
- `1` = Test FAILED (evidence captured)
- `2` = Fatal error (missing env vars, etc.)

### Verifier
- `0` = Verification PASSED (intact + test PASSED)
- `1` = Verification FAILED (tamper or test FAILED)
- `2` = Fatal error (missing evidence dir)

---

## Key Metrics (Typical Run)

```
Test duration: ~6 seconds
Evidence pack size: ~2.7 MB
Files generated: 23 files (20 hashed)
Console errors (HOST): 4 (non-blocking)
Console errors (APP): 2 (allowlisted)
Network requests: ~180
Gadget iframe score: 5
Verdict: PASS ✅
```

---

For complete documentation, see: [docs/reviewer/REVIEWER_E2E_PROOF_PACK.md](docs/reviewer/REVIEWER_E2E_PROOF_PACK.md)
