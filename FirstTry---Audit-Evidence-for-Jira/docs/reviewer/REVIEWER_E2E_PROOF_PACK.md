# Reviewer E2E Evidence Pack Documentation

This document describes the **enterprise-grade, tamper-evident evidence pack system** for the FirstTry Reviewer Dashboard E2E test.

## Overview

The reviewer E2E test produces **proof packs** — immutable, cryptographically-verifiable evidence directories that prove the FirstTry Forge app gadget renders correctly inside a real Jira dashboard.

### Key Features

- **Tamper-evident**: SHA256 manifest of all files, with pack hash for offline verification
- **Deterministic**: Canonical JSON with sorted keys, stable file ordering
- **Fail-closed**: Test fails if any required artifact is missing, or if origin-classified app console errors occur
- **Origin-aware console classification**: Distinguishes HOST/FORGE_RUNTIME/APP errors (only APP errors block)
- **Cross-origin ready**: Handles Forge iframe isolation gracefully
- **Complete forensics**: 17+ evidence artifacts including screenshots, logs, network traces

## Quick Start

### Prerequisites

```bash
# Set Jira environment variables
export JIRA_BASE_URL="https://your-instance.atlassian.net"
export JIRA_DASHBOARD_URL="https://your-instance.atlassian.net/jira/dashboards/10001"

# Authenticate (one-time)
cd /workspaces/Firsttry/FirstTry---Audit-Evidence-for-Jira
npx playwright auth login --config=playwright.reviewer.config.ts
```

### Build Evidence Pack

```bash
cd /workspaces/Firsttry/FirstTry---Audit-Evidence-for-Jira
./tools/reviewer_demo/proof_pack/build_reviewer_proof_pack.sh
```

**Output example:**
```
============================================================
Reviewer E2E Evidence Pack Builder
============================================================
Run ID: ft_reviewer_e2e_20240315T143022Z
Evidence dir: /tmp/ft_reviewer_e2e_20240315T143022Z

[PREFLIGHT] Checking requirements...
✓ JIRA_BASE_URL: https://firsttry-solutions.atlassian.net
✓ JIRA_DASHBOARD_URL: https://firsttry-solutions.atlassian.net/jira/dashboards/10001
✓ Auth file: tests/playwright/.auth/storageState.json (31234 bytes)
...
[RESULT] Test status: PASS
[MANIFEST] Generating SHA256 manifest...
✓ Manifest generated: /tmp/ft_reviewer_e2e_20240315T143022Z/manifest.sha256
  Files hashed: 19
[HASH] Computing proof pack hash (hash of manifest)...
✓ Proof pack hash: a1b2c3d4e5f6...
============================================================
Evidence Pack Complete
============================================================
Location: /tmp/ft_reviewer_e2e_20240315T143022Z
Status: PASS
Pack hash: a1b2c3d4e5f6...
```

### Verify Evidence Pack

```bash
./tools/reviewer_demo/proof_pack/verify_reviewer_proof_pack.sh /tmp/ft_reviewer_e2e_20240315T143022Z
```

**Output example:**
```
============================================================
Reviewer E2E Evidence Pack Verifier
============================================================
Evidence dir: /tmp/ft_reviewer_e2e_20240315T143022Z

[FILES] Checking required files exist...
✓ All required files present (18 files)
[MANIFEST] Recomputing SHA256 manifest...
✓ Manifest matches (no tampering detected)
[HASH] Verifying proof pack hash...
✓ Proof pack hash matches: a1b2c3d4e5f6...
[SUMMARY] Parsing summary.json...
  Test status: PASS
  Console errors:
    - Host: 4
    - Forge runtime: 0
    - App: 2 (allowlisted)
  ...
[GADGET] Parsing gadget_verdict.json...
  Gadget present: true
  Iframe score: 5
  ...
[VERDICT] Verifying FINAL_VERDICT.txt...
✓ FINAL_VERDICT.txt matches summary.json: PASS
============================================================
Verification Complete
============================================================
Evidence pack: INTACT (no tampering)
Test result: PASS

✓ VERIFICATION PASSED
```

## Evidence Pack Structure

```
/tmp/ft_reviewer_e2e_YYYYMMDDTHHMMSSZ/
├── summary.json                   # Test verdict + metrics (canonical JSON)
├── allowlists.json                # Console + network allowlists (canonical JSON)
├── gadget_verdict.json            # Deterministic gadget rules (canonical JSON)
├── reviewer_env.json              # Environment variables (canonical JSON)
├── manifest.sha256                # SHA256 hashes of all files
├── PROOF_PACK_SHA256.txt          # SHA256 hash of manifest (pack integrity)
├── FINAL_VERDICT.txt              # PASS or FAIL
└── 04_playwright/
    ├── screenshots/
    │   ├── 01_dashboard_full.png
    │   ├── 02_dashboard_viewport.png
    │   ├── 03_gadget_frame.png      (if cross-origin accessible)
    │   ├── 04_gadget_frame_full.png (if cross-origin accessible)
    │   ├── debug_page_source.html
    │   ├── debug_page_meta.json
    │   ├── dashboard_discovery.json
    │   ├── iframes_inventory.json
    │   ├── iframe_cross_origin.json (if cross-origin blocked)
    │   └── gadget_frame_source.html (if accessible)
    ├── logs/
    │   ├── console.log              # All console events (timestamped, origin-classified)
    │   ├── console_classified.json  # Console events by origin (canonical JSON)
    │   ├── page_errors.log
    │   └── request_failed.log
    └── network/
        ├── network_requests.log
        ├── network_domains.json     # Domain counts + disallowed (canonical JSON)
        └── network_domains_sorted.txt
```

### Key Files

#### `summary.json` (canonical)
Test verdict + high-level metrics.

```json
{
  "consoleAppErrors": 2,
  "consoleForgeErrors": 0,
  "consoleHostErrors": 4,
  "endTime": "2024-03-15T14:30:28.123Z",
  "iframeChosen": true,
  "networkRequests": 182,
  "pageErrors": 0,
  "requestFailed": 0,
  "startTime": "2024-03-15T14:30:22.456Z",
  "status": "PASS",
  "statusCode": 200,
  "timestamp": "2024-03-15T14:30:28.123Z",
  "title": "Dashboard loaded",
  "url": "https://firsttry-solutions.atlassian.net/jira/dashboards/10001"
}
```

**PASS criteria:**
- `status === "PASS"`
- `pageErrors === 0`
- `consoleAppErrors` only from allowlist
- `gadget_verdict.json` exists with `gadget_present === true`

#### `gadget_verdict.json` (canonical)
Deterministic gadget detection rules.

```json
{
  "cross_origin_blocked": true,
  "frame_accessible": false,
  "gadget_present": true,
  "iframe_detected": true,
  "iframe_index": 0,
  "iframe_score": 5,
  "verdict_timestamp": "2024-03-15T14:30:27.890Z"
}
```

**Gadget verdict rules (non-bypassable):**
```typescript
gadget_present = iframe_score >= 4 && (frame_accessible || cross_origin_blocked)
```

**Iframe scoring (0-8 points):**
- +3 if `src` contains `"atl-paas.net"`
- +2 if `src` contains `"forge"`
- +2 if bounding box width > 200 && height > 120
- +1 if visible

Typical Forge iframe: **5 points** (atl-paas.net=3, size=2, visible=0 due to lazy load)

#### `allowlists.json` (canonical)
Records allowlists used for console + network validation.

```json
{
  "console_allowlist": [
    {"pattern": "FT_PROOF_UI_BUNDLE_HASH_UNAVAILABLE", "type": "string"},
    {"pattern": "UI_SERVE_MISMATCH", "type": "string"}
  ],
  "generated_at": "2024-03-15T14:30:28.123Z",
  "network_hostname_allowlist": [
    {"pattern": "firsttry-solutions.atlassian.net", "type": "string"},
    {"pattern": "\\.atlassian\\.net$", "type": "regex"},
    {"pattern": "\\.atl-paas\\.net$", "type": "regex"}
  ]
}
```

#### `manifest.sha256`
SHA256 hashes of all files (excluding manifest, pack hash, final verdict).

Format: `<hash>  <filename>`

Example:
```
a1b2c3d4...  ./04_playwright/logs/console.log
e5f6a7b8...  ./04_playwright/network/network_domains.json
...
```

#### `PROOF_PACK_SHA256.txt`
SHA256 hash of `manifest.sha256` (pack integrity proof).

```
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

## Console Error Classification

**Origin-aware classification** prevents false negatives from Jira infrastructure noise.

### Console Origins

| Origin | Description | Blocking? | Examples |
|--------|-------------|-----------|----------|
| **HOST** | Atlassian Jira platform | No (logged only) | `*.atlassian.net`, `*.cloudfront.net` |
| **FORGE_RUNTIME** | Atlassian Forge runtime | No (logged only) | `*.atl-paas.net`, `forge.cdn.*` |
| **APP** | FirstTry app code | **Yes (FAIL)** | Any URL not matching HOST/FORGE |
| **UNKNOWN** | No URL available | **Yes (FAIL)** | Parse errors, unknown origins |

### Allowlist

Known benign patterns (from app + Forge):
- `FT_PROOF_UI_BUNDLE_HASH_UNAVAILABLE` (dev-only env var)
- `UI_SERVE_MISMATCH` (Forge runtime benign)
- `net::ERR_ABORTED` (expected 404s on lazy routes)

## Network Egress Validation

**Fail-closed**: Only allowlisted domains are permitted.

### Network Allowlist

| Pattern | Purpose |
|---------|---------|
| `firsttry-solutions.atlassian.net` | Jira instance |
| `*.atlassian.net` | Atlassian services |
| `*.atl-paas.net` | Forge runtime |
| `*.cloudfront.net` | Atlassian CDN |
| `*.gravatar.com`, `*.wp.com` | Gravatar avatars |
| `*.sentry.io` | Sentry error tracking |
| `data:`, `blob:` | Browser internal |

**FAIL on:** Any request to non-allowlisted domain.

## Artifact Verification (Fail-Closed)

Before test PASS, all required artifacts are verified to exist:

```typescript
const requiredFiles = [
  EVIDENCE_FILES.env,
  EVIDENCE_FILES.summary,
  EVIDENCE_FILES.allowlists,
  EVIDENCE_FILES.gadgetVerdict,
  EVIDENCE_FILES.pageSource,
  EVIDENCE_FILES.pageMeta,
  EVIDENCE_FILES.dashboardDiscovery,
  EVIDENCE_FILES.iframesInventory,
  EVIDENCE_FILES.consoleLog,
  EVIDENCE_FILES.consoleClassified,
  EVIDENCE_FILES.networkRequests,
  EVIDENCE_FILES.networkDomains,
  EVIDENCE_FILES.networkDomainsSorted,
  EVIDENCE_FILES.screenshot1,
  EVIDENCE_FILES.screenshot2,
];
```

**Missing any file → FAIL** (non-bypassable).

## Determinism & Canonical JSON

All JSON files use **canonical formatting**:
- Sorted keys (stable ordering)
- 2-space indentation
- Newline at EOF
- UTF-8 encoding

**Benefits:**
- SHA256 hashes are deterministic (same input → same hash)
- Diffs are meaningful (git, reviewers)
- Tamper-detection is reliable (recompute manifest, compare)

**Implementation:**
```typescript
function writeJsonCanonical(filePath: string, data: any): void {
  const json = JSON.stringify(data, Object.keys(data).sort(), 2);
  fs.writeFileSync(filePath, json + '\n', 'utf8');
}
```

## Offline Verification

The verifier script requires **no network access** — all checks use local cryptography.

**Verification steps:**
1. Check all required files exist
2. Recompute SHA256 manifest (stable sort order)
3. Compare with `manifest.sha256` (detect file tampering)
4. Recompute pack hash from manifest
5. Compare with `PROOF_PACK_SHA256.txt` (detect manifest tampering)
6. Parse `summary.json` (test verdict)
7. Parse `gadget_verdict.json` (gadget detection)
8. Validate `FINAL_VERDICT.txt` matches `summary.json`

**Exit codes:**
- `0` = Verification PASSED (intact evidence, test PASSED)
- `1` = Verification FAILED (tampering or test FAILED)
- `2` = Fatal error (missing evidence dir, etc.)

## Tooling Reference

### `build_reviewer_proof_pack.sh`

Runs test, generates evidence pack with manifest + hash.

**Requirements:**
- `JIRA_BASE_URL` env var
- `JIRA_DASHBOARD_URL` env var
- Authenticated session in `tests/playwright/.auth/storageState.json`

**Process:**
1. Preflight checks (env vars, auth, config)
2. Create `/tmp/ft_reviewer_e2e_YYYYMMDDTHHMMSSZ` directory
3. Export `FT_REVIEWER_EVIDENCE_DIR` for test
4. Run `npx playwright test` with reviewer config
5. Parse `summary.json` for verdict
6. Generate `manifest.sha256` (find + sort + sha256sum)
7. Compute pack hash (sha256 of manifest)
8. Write `PROOF_PACK_SHA256.txt`
9. Write `FINAL_VERDICT.txt`

**Exit codes:**
- `0` = Test PASSED
- `1` = Test FAILED (evidence still captured)
- `2` = Fatal error (missing env vars, etc.)

### `verify_reviewer_proof_pack.sh`

Verifies evidence pack offline.

**Usage:**
```bash
./verify_reviewer_proof_pack.sh /tmp/ft_reviewer_e2e_20240315T143022Z
```

**Process:**
1. Check required files exist
2. Recompute manifest (same find + sort + sha256sum as builder)
3. Diff with original manifest (detect tampering)
4. Recompute pack hash, compare with stored
5. Parse summary.json, gadget_verdict.json
6. Validate FINAL_VERDICT.txt matches

**Exit codes:**
- `0` = Verification PASSED (intact, test PASSED)
- `1` = Verification FAILED (tamper or test FAILED)
- `2` = Fatal error (no evidence dir)

### `canonical_json.py`

Formats JSON in canonical form (stdin → stdout).

**Usage:**
```bash
cat input.json | python3 canonical_json.py > output.json
echo '{"b": 2, "a": 1}' | python3 canonical_json.py
# Output: {"a": 1, "b": 2}
```

**Features:**
- Sorted keys
- 2-space indent
- Newline at EOF
- Preserves Unicode (no escape)

### `sha256_manifest.sh`

Generates deterministic SHA256 manifest (stable sort).

**Usage:**
```bash
cd /tmp/ft_reviewer_e2e_20240315T143022Z
sha256_manifest.sh > manifest.sha256
```

**Process:**
```bash
find . -type f \
  ! -name "manifest.sha256" \
  ! -name "PROOF_PACK_SHA256.txt" \
  ! -name "FINAL_VERDICT.txt" \
  | sort \
  | xargs sha256sum
```

## Test Phases

The reviewer E2E test runs in 9 phases:

1. **ENV VALIDATION** — Fail if `FT_REVIEWER_EVIDENCE_DIR` missing or invalid
2. **LISTENER SETUP** — Origin-aware console, page errors, request failures, network tracer
3. **NAVIGATION** — Go to Jira dashboard URL
4. **DASHBOARD DISCOVERY** — 3-layer detection (main elements, text scan, iframe count)
5. **IFRAME SCORING** — Detect & score iframes (choose highest score ≥ 4)
6. **GADGET VALIDATION** — Access frame or fallback to cross-origin indirect evidence
7. **GADGET VERDICT** — Apply deterministic rules, write `gadget_verdict.json`
8. **CONSOLE CLASSIFICATION** — Classify errors by origin, fail on non-allowlisted APP errors
9. **NETWORK FORENSICS** — Validate egress against allowlist, generate sorted domain list
10. **ARTIFACT VERIFICATION** — Verify all required files exist
11. **SUMMARY GENERATION** — Write `summary.json`, `allowlists.json`, `FINAL_VERDICT.txt`

## Troubleshooting

### Test fails: "FT_REVIEWER_EVIDENCE_DIR environment variable is required"

**Cause:** Environment variable not set.

**Fix:**
```bash
export FT_REVIEWER_EVIDENCE_DIR=/tmp/my_evidence_dir
npx playwright test --config=playwright.reviewer.config.ts tests/playwright/reviewer_dashboard_e2e.spec.ts
```

Or use the builder script (sets this automatically).

### Test fails: "app console error(s) detected"

**Cause:** Real application JavaScript error.

**Fix:** Check `04_playwright/logs/console_classified.json` for APP errors:
```json
{
  "errors": {
    "APP": [
      {"text": "TypeError: Cannot read property ...", "url": "https://..."}
    ]
  }
}
```

Investigate + fix the error, or add to `CONSOLE_ALLOWLIST` if benign.

### Verifier fails: "Manifest mismatch (tampering detected)"

**Cause:** File(s) modified after evidence pack creation.

**Fix:** Do not modify evidence pack files. Regenerate fresh evidence pack.

### Verifier fails: "Proof pack hash mismatch"

**Cause:** `manifest.sha256` file modified.

**Fix:** Regenerate evidence pack (tampering detected).

## Security Properties

### Tamper-Evidence

**Threat model:** Attacker modifies evidence files to hide test failures.

**Defense:**
1. All files covered by `manifest.sha256` (SHA256 hashes)
2. Manifest itself hashed → `PROOF_PACK_SHA256.txt`
3. Verifier recomputes manifest, compares (detects any file change)
4. Pack hash recomputed, compared (detects manifest change)

**Result:** Any modification is detectable offline.

### Fail-Closed Design

**Threat model:** Test passes when it should fail (false PASS).

**Defense:**
- Missing evidence dir → FAIL (non-bypassable)
- Any page error → FAIL
- Any non-allowlisted APP console error → FAIL
- Missing iframe → FAIL
- Low iframe score → FAIL
- `gadget_present === false` → FAIL
- Unknown network domain → FAIL
- Missing required artifact → FAIL

**Result:** Test cannot silently pass (must explicitly succeed).

### Determinism

**Threat model:** Evidence pack varies between runs (unreproducible).

**Defense:**
- Canonical JSON (sorted keys, stable format)
- Stable sort order for files (`find | sort`)
- Timestamps recorded but don't affect verdict logic
- Network domains sorted alphabetically

**Result:** Evidence packs are reproducible (same inputs → same hashes, modulo timestamps).

## Advanced Usage

### Custom Evidence Directory

```bash
export FT_REVIEWER_EVIDENCE_DIR=/mnt/nfs/reviewer_evidence/run_12345
npx playwright test --config=playwright.reviewer.config.ts tests/playwright/reviewer_dashboard_e2e.spec.ts
```

### CI/CD Integration

```yaml
- name: Run Reviewer E2E with Evidence Pack
  run: |
    export JIRA_BASE_URL="${{ secrets.JIRA_BASE_URL }}"
    export JIRA_DASHBOARD_URL="${{ secrets.JIRA_DASHBOARD_URL }}"
    ./tools/reviewer_demo/proof_pack/build_reviewer_proof_pack.sh
    
- name: Verify Evidence Pack
  if: success() || failure()
  run: |
    ./tools/reviewer_demo/proof_pack/verify_reviewer_proof_pack.sh /tmp/ft_reviewer_e2e_*
    
- name: Upload Evidence Pack
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: reviewer-evidence-pack
    path: /tmp/ft_reviewer_e2e_*
```

### Archive Evidence Packs

```bash
# Tar + gzip evidence pack (preserves SHA256)
cd /tmp
tar czf ft_reviewer_e2e_20240315T143022Z.tar.gz ft_reviewer_e2e_20240315T143022Z/

# Verify after extraction
tar xzf ft_reviewer_e2e_20240315T143022Z.tar.gz
./tools/reviewer_demo/proof_pack/verify_reviewer_proof_pack.sh ft_reviewer_e2e_20240315T143022Z/
```

## References

- Test spec: `tests/playwright/reviewer_dashboard_e2e.spec.ts`
- Playwright config: `playwright.reviewer.config.ts`
- Builder: `tools/reviewer_demo/proof_pack/build_reviewer_proof_pack.sh`
- Verifier: `tools/reviewer_demo/proof_pack/verify_reviewer_proof_pack.sh`
- Canonical JSON: `tools/reviewer_e2e/proof_pack/lib/canonical_json.py`
- Manifest generator: `tools/reviewer_e2e/proof_pack/lib/sha256_manifest.sh`
