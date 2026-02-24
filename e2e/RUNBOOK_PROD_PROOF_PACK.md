# RUNBOOK_PROD_PROOF_PACK.md

## Prod Proof Pack Generator

**Status**: Operator runbook for fail-closed production proof evidence orchestration.

---

## 1. Purpose

The Prod Proof Pack generator is a single fail-closed command that orchestrates all three production proof runners and generates an immutable evidence bundle with:

- **Manifest** (MANIFEST.json): Complete record of all evidence with SHA256 hashes
- **Verifier** (VERIFY.sh): Offline integrity checker for the bundle
- **Artifact** (artifact.zip): Portable, auditable evidence package

**What it proves:**
- Jira production dashboard loads without mutations (POST/PUT/PATCH/DELETE)
- No critical console errors, page errors, or HTTP 4xx/5xx responses
- All network traffic respects allowlist policy (default + Atlassian-only modes)
- Network domain compliance: Atlassian suffixes + approved third-party exact hosts
- Dependency discovery: Third-party services actually required by the dashboard
- Evidence immutability (via manifest + SHA256 verification)
- Reproducible, deterministic evidence capture

**What it does NOT prove:**
- User authentication validity (auth is pre-captured in storageState)
- API response correctness (only HTTP status is verified)
- Visual rendering correctness (screenshots are best-effort evidence only)
- Real-world traffic patterns (laboratory conditions)

---

## 2. Preconditions

Before running, ensure:

### Required files exist and are executable:
```bash
e2e/scripts/run_prod_dashboard_smoke_failclosed.sh
e2e/scripts/run_prod_dashboard_stability_contract_failclosed.sh
e2e/scripts/run_prod_dashboard_network_nomutation_failclosed.sh
e2e/scripts/run_prod_dashboard_network_domain_allowlist_failclosed.sh
```

### Required configuration files exist:
```bash
e2e/policy/prod_proof_allowlist.json
e2e/.auth/storageState.json
```

### Network access:
- Connectivity to `https://firsttry.atlassian.net` (production Jira)
- No proxy/SSL interception that would break storageState authentication

### Docker/Linux environment:
- Playwright browsers installed and accessible
- `bash`, `sha256sum`, `zip`, `python3` available
- /tmp is writable and has ~500MB available

---

## 3. Single Command

```bash
bash e2e/scripts/run_prod_proof_pack_failclosed.sh
```

**Expected runtime:** ~60-90 seconds (three sequential runners + artifact creation)

### Output on success:
```
[INFO] Prod proof pack generation PASSED
[INFO] Pack directory: /tmp/ft_prod_proof_pack_20260224T073500Z
[INFO] Artifact: /tmp/ft_prod_proof_pack_20260224T073500Z/artifact.zip
PROOF_PACK_DIR=/tmp/ft_prod_proof_pack_20260224T073500Z
PROOF_PACK_ZIP=/tmp/ft_prod_proof_pack_20260224T073500Z/artifact.zip
```

**Exit code:**
- 0 = Success (all runners passed, bundle created)
- 1 = Failure (precondition failed, runner failed, or artifact creation failed)

---

## 3a. Optional strict mode (Atlassian-only)

To validate **only Atlassian-controlled domains** (blocking all third-party services), use:

```bash
FT_ATLASSIAN_ONLY=1 bash e2e/scripts/run_prod_dashboard_network_domain_allowlist_failclosed.sh
```

**Behavior in strict mode:**

- **PASS** = Dashboard loaded using only Atlassian-owned domains (.atlassian.net, .atl-paas.net, .atlassian.com, .atlassian-dev.net)
- **FAIL** = Third-party services were contacted (CloudFront CDN, Gravatar, Sentry, etc.). Evidence will show blocked hosts in `hosts_blocked.txt`

Evidence includes `mode.txt` indicating either `DEFAULT` or `ATLASSIAN_ONLY`.

**Use case:** Verify compliance with zero-external-dependency standards; detect unauthorized third-party integrations.

---

## 4. Output Structure

### Top-level directory: `/tmp/ft_prod_proof_pack_<UTC>/`

```
/tmp/ft_prod_proof_pack_20260224T073500Z/
├── RUN_DIR.txt                          # Full path to this directory
├── START_UTC.txt                        # Timestamp when run started
├── GIT_HEAD.txt                         # Commit hash at run time
├── GIT_STATUS.txt                       # Git dirty state (porcelain output)
├── GIT_DIRTY.txt                        # true/false
│
├── storageState.bytes.txt               # File size in bytes (NOT contents)
├── storageState.sha256.txt              # SHA256 hash (NOT contents)
├── storageState.shape.txt               # Schema only: {type, has_cookies, has_origins, counts}
│
├── child_smoke_dir.txt                  # Path to smoke runner evidence
├── child_stability_dir.txt              # Path to stability runner evidence
├── child_nomutation_dir.txt             # Path to nomutation runner evidence
│
├── RUN_LOG.txt                          # Combined stdout/stderr from all runners
│
├── MANIFEST.json                        # Evidence manifest with file hashes
├── MANIFEST.sha256.txt                  # Hash of MANIFEST.json
├── VERIFY.sh                            # Offline integrity verifier
│
├── evidence/
│   ├── smoke/                           # Sanitized evidence from smoke runner
│   │   ├── SUCCESS.txt
│   │   ├── final_url.txt
│   │   ├── host.txt
│   │   ├── path.txt
│   │   ├── RUN_DIR.txt
│   │   ├── *.png                        # Screenshots
│   │   └── *.txt                        # Test evidence
│   │
│   ├── stability/                       # Sanitized evidence from stability runner
│   │   ├── SUCCESS.txt
│   │   ├── timings.json
│   │   ├── allowlist.version.txt
│   │   ├── allowlist.hash.sha256.txt
│   │   ├── *.png
│   │   └── *.txt
│   │
│   └── nomutation/                      # Sanitized evidence from nomutation runner
│       ├── SUCCESS.txt
│       ├── methods_seen.txt
│       ├── mutation_hits.txt
│       ├── *.png
│       └── *.txt
│
│   ├── domain_allowlist_default/        # Domain allowlist in DEFAULT mode (must PASS)
│   │   ├── SUCCESS.txt
│   │   ├── hosts_seen.txt               # All contacted hostnames
│   │   ├── hosts_blocked.txt            # Empty (all allowed)
│   │   ├── mode.txt                     # "DEFAULT"
│   │   ├── allowlist.version.txt
│   │   ├── allowlist.hash.sha256.txt
│   │   └── *.txt                        # Evidence metadata
│   │
│   └── domain_allowlist_strict/         # Domain allowlist in ATLASSIAN_ONLY mode (expected to fail)
│       ├── FAIL.txt                     # Expected failure message
│       ├── hosts_seen.txt               # All contacted hostnames
│       ├── hosts_blocked.txt            # Third-party hosts (non empty)
│       ├── mode.txt                     # "ATLASSIAN_ONLY"
│       ├── allowlist.version.txt
│       ├── allowlist.hash.sha256.txt
│       └── *.txt                        # Evidence metadata
│
├── artifact.zip                         # Portable bundle (MANIFEST + evidence + VERIFY.sh)
│
├── DEPENDENCY_STATEMENT.txt             # Domain allowlist compliance proof summary
│
├── SUCCESS.txt                          # Indicates pack generation succeeded
└── FORBIDDEN_FOUND.txt                  # Only present if forbidden files were detected (FAIL)
```

### MANIFEST.json structure:

```json
{
  "version": 1,
  "created_utc": "2026-02-24T07:35:00Z",
  "git_head": "8349f39f...",
  "allowlist_sha256": "84b2606ab3b9c1027...",
  "storageState_sha256": "a1b2c3d4...",
  "storageState_bytes": 8192,
  "files": [
    {"sha256": "hash1", "path": "evidence/smoke/SUCCESS.txt"},
    {"sha256": "hash2", "path": "evidence/smoke/final_url.txt"},
    ...
  ]
}
```

---

## 5. Pass/Fail Criteria

**PASS:**
- All three runners (smoke, stability, nomutation) exit with code 0
- Each runner's evidence contains SUCCESS.txt (not FAIL.txt)
- No forbidden files (storageState*.json, *.har, trace*.zip) present
- MANIFEST.json and VERIFY.sh created successfully
- artifact.zip created and contains all files
- SUCCESS.txt written to top-level directory

**FAIL:**
- Any runner exits non-zero
- Any runner's evidence contains FAIL.txt
- Preconditions not met (runners missing, allowlist missing, storageState missing)
- Evidence directory detection fails
- Forbidden files detected (FORBIDDEN_FOUND.txt created)
- Manifest/verifier creation fails
- artifact.zip creation fails

---

## 6. Verification (Offline)

After downloading artifact.zip to any machine:

```bash
# Extract
unzip artifact.zip

# Verify integrity
bash VERIFY.sh

# Expected output:
# [VERIFY] Checking manifest integrity...
# [VERIFY] Manifest hash verified: 84b2606ab3b9c1027...
# [VERIFY] Checking file hashes...
# [OK] evidence/smoke/SUCCESS.txt
# [OK] evidence/stability/SUCCESS.txt
# ...
# SUCCESS: All files verified
```

---

## 7. Triage Steps

### If proof pack fails:

1. **Check preconditions:**
   ```bash
   ls -la e2e/scripts/run_prod_dashboard_*_failclosed.sh
   ls -la e2e/policy/prod_proof_allowlist.json
   ls -la e2e/.auth/storageState.json
   ```

2. **Check RUN_LOG.txt:**
   ```bash
   tail -100 /tmp/ft_prod_proof_pack_<UTC>/RUN_LOG.txt
   ```
   Look for which runner failed (smoke/stability/nomutation).

3. **Check child evidence directories:**
   ```bash
   cat /tmp/ft_prod_proof_pack_<UTC>/child_smoke_dir.txt
   cat /tmp/ft_prod_proof_pack_<UTC>/child_stability_dir.txt
   cat /tmp/ft_prod_proof_pack_<UTC>/child_nomutation_dir.txt
   ```

4. **Review individual runner evidence:**
   ```bash
   cd $(cat /tmp/ft_prod_proof_pack_<UTC>/child_smoke_dir.txt)
   cat FAIL.txt  # If FAIL.txt exists, shows failure reason
   cat SUCCESS.txt
   ```

5. **Check for forbidden files:**
   ```bash
   ls -la /tmp/ft_prod_proof_pack_<UTC>/
   # Look for FORBIDDEN_FOUND.txt (indicates sanitization failure)
   ```

---

## 8. Security Rules

### DO NOT:
- Share storageState.json (it contains authentication tokens)
- Share individual runner evidence directories
- Print storageState contents to logs
- Commit artifact.zip to version control if it contains auth

### DO:
- Keep artifact.zip as the source of truth
- Verify MANIFEST.sha256.txt before accepting evidence
- Run verifier (VERIFY.sh) to confirm integrity after transfer
- Treat MANIFEST.json + artifact.zip as legally equivalent to "witnessed evidence"

### Auth safety:
- storageState metadata (bytes/hash/shape) is recorded, NOT the file itself
- artifact.zip does NOT contain e2e/.auth/storageState.json
- Evidence inside artifact.zip contains only URLs, status codes, and screenshots
- No response bodies, headers, or cookies are included

---

## 9. Manifest Verification Contract

MANIFEST.json is the source of truth:
- Lists every file in bundle with SHA256 hash
- MANIFEST.sha256.txt proves MANIFEST integrity
- VERIFY.sh (offline, POSIX bash) validates all hashes without external dependencies
- If any file is modified post-creation, verification fails

---

## 10. Example: Full Workflow

```bash
# Step 1: Run locally
cd /workspaces/Firsttry
bash e2e/scripts/run_prod_proof_pack_failclosed.sh

# Step 2: Capture output directory
PACK_DIR=/tmp/ft_prod_proof_pack_20260224T073500Z

# Step 3: Check structure
ls -lah ${PACK_DIR}/
ls -lah ${PACK_DIR}/evidence/

# Step 4: Verify locally
cd ${PACK_DIR}
bash VERIFY.sh

# Step 5: Download artifact
scp user@machine:${PACK_DIR}/artifact.zip ./proof-2026-02-24.zip

# Step 6: Offline verification (on audit machine)
unzip proof-2026-02-24.zip
bash VERIFY.sh

# Step 7: Inspect evidence
unzip -l proof-2026-02-24.zip
```

---

## 11. Known Limitations

- Playwright timeout is 60s per test (may fail on slow networks)
- Screenshots are best-effort (may fail in headless environments)
- storageState must be fresh (auth tokens expire)
- No retry logic (single pass through each runner)
- Allowlist must be current (expired rules fail fast)

---

## 12. Support

For issues:
1. Check RUN_LOG.txt for runner-specific errors
2. Review individual runner runbooks:
   - RUNBOOK_PROD_SMOKE.md
   - RUNBOOK_PROD_STABILITY_CONTRACT.md (if exists)
   - RUNBOOK_PROD_PROOF_PACK.md (this file)
3. Verify network access to firsttry.atlassian.net
4. Ensure storageState.json is less than 24 hours old
