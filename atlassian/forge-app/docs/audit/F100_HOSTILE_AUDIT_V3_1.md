# F100 Hostile Enterprise Audit v3.1

## Overview

The F100 Hostile Enterprise Audit (v3.1) is a Fortune-50 grade, zero-trust, fail-closed security audit framework for Atlassian Forge applications. It simulates the adversarial evaluation a hostile procurement security team would perform before approving a Forge app for enterprise deployment.

**Design principles:**
- **Zero Trust**: No assumption of goodness. Every claim is verified from source.
- **Fail-Closed**: Ambiguity results in failure, not permission.
- **Reproducible**: Same repo state ⟹ same audit outcome (modulo evidence directory timestamp).
- **Adversarial**: The repo is assumed to be attempting to evade checks.

---

## Architecture

```
tools/audit/v3_1/
├── run_f100_hostile_audit_v3_1.sh    # Main orchestrator
├── lib/
│   ├── common.sh           # Shared utilities (need_cmd, phase_*, write_json_result)
│   ├── scoring.sh          # Hardened scoring model
│   ├── supply_chain.sh     # Phase 1: Dependency lockdown
│   ├── secrets.sh          # Phase 2: Secrets forensics
│   ├── manifest.sh         # Phase 3: Manifest binding
│   ├── exfiltration.sh     # Phase 4: Outbound network/telemetry
│   ├── forge_specific.sh   # Phase 5: Forge storage key audit
│   ├── determinism.sh      # Phase 6: Determinism proof
│   ├── runtime.sh          # Phase 7: Runtime execution gates
│   ├── sast.sh             # Phase 8: SAST (Semgrep)
│   ├── quota.sh            # Phase 9: Quota/DoS simulation
│   ├── silent_failures.sh  # Phase 10: Silent failure detection
│   └── legal.sh            # Phase 11: Legal/governance
└── semgrep/
    └── forge.yml           # Local Forge-specific Semgrep rules
```

---

## Phases

| Phase | Name | Fail Mode |
|-------|------|-----------|
| GATE  | Clean Git Tree | Hard FAIL if dirty |
| 00    | Cleanroom Baseline | Hard FAIL if npm ci fails |
| 01    | Supply Chain Enforcement | Hard FAIL: non-exact versions, vulns, critical-pkg dupes |
| 02    | Secrets Forensics v3.1 | Hard FAIL if any secret found |
| 03    | Manifest ↔ Entrypoint Binding | Hard FAIL: write scopes, any egress |
| 04    | Outbound Network / Telemetry | Hard FAIL: any non-Forge-sanctioned call |
| 05    | Forge-Specific Risks | Hard FAIL: unscoped storage keys |
| 06    | Determinism Hard Proof | Hard FAIL: entropy or non-deterministic runs |
| 07    | Runtime Execution Gates | Hard FAIL: test failures or warnings |
| 08    | SAST | Hard FAIL: ERROR-severity semgrep findings |
| 09    | Quota / DoS Simulation | Hard FAIL: memory growth, 429 not handled |
| 10    | Silent Failures | Hard FAIL: catch-without-rethrow in export path |
| 11    | Legal / Governance | High FLAG: missing docs (not hard FAIL) |
| 12    | Risk Matrix | High FLAG if >5 risks score ≥40 |
| 13    | Evidence Packaging | Always runs; creates ZIP + SHA256 manifest |

---

## Scoring Model

```
Start:  100 points

CRITICAL FAIL  → score = min(score, 30);  decision = REJECT

HIGH FLAG penalties:
  1 HIGH  → score -= 15
  2 HIGH  → score = min(score, 65)
  3+ HIGH → score = min(score, 45);  decision = REJECT

MEDIUM FLAG: -5 each (max -25 total)
LOW FLAG:    -1 each (max -10 total)

Decisions:
  ≥85, no FAIL, <3 HIGH   → CONDITIONAL_ACCEPT     (exit 0)
  70–84                    → CONDITIONAL_REMEDIATION_REQUIRED (exit 1)
  50–69                    → HIGH_RISK              (exit 1)
  <50 or any FAIL          → REJECT                 (exit 1)
```

---

## Required Tools

| Tool | Required | Fallback |
|------|----------|---------|
| bash, git, node, npm | Hard FAIL if missing | — |
| jq, rg (ripgrep), grep, sha256sum, zip | Hard FAIL if missing | — |
| forge (CLI) | Hard FAIL if missing | — |
| semgrep | Auto-install via pip | FAIL if install fails |
| trufflehog | Best-effort install | High FLAG + regex fallback |
| curl | HIGH FLAG if missing | Link validation skipped |

---

## Constraints

- **Read-only on `src/**`**: The audit never modifies product source files.
- **Audit tooling only under `tools/audit/v3_1/**`**.
- **Docs only under `docs/audit/**`**.
- **No commits of `/tmp` artifacts**.
- Do **not** modify `package.json`, `package-lock.json`, or `manifest.yml`.

---

## Duplicate Dependency Policy (Enterprise-Grade Rationale)

### Problem
The npm ecosystem commonly produces dependency trees with multiple versions of the same package (e.g., `lodash@4.17.23` and `lodash@3.10.1` coexisting as transitive deps). A blanket FAIL on all duplicates creates false-positive REJECTs for standard npm behavior.

### Policy
**Phase 01 Supply Chain Enforcement** implements a **critical-list-based duplicate gate**:

1. **FAIL trigger**: If ANY package in the **critical list** has >1 distinct version installed.
2. **HIGH FLAG**: If non-critical packages have duplicates (visibility for supply-chain review).

### Critical Package List (25 packages)
Duplicates of these packages trigger hard FAIL:

```
minimatch       glob            semver          tar             ws              
undici          node-fetch      axios           got             follow-redirects
qs              jsonwebtoken    jose            yaml            lodash          
handlebars      ejs             mustache        tough-cookie    tough-cookie-file-store
ip              crypto-js       uuid            request         @forge/api      
```

**Rationale**: These packages have high blast radius for:
- **Security vulnerabilities** (history of CVEs: `minimatch`, `lodash`, `qs`, `axios`, `jsonwebtoken`)
- **Cryptographic operations** (`crypto-js`, `jose`, `jsonwebtoken`)
- **Filesystem/archive handling** (`tar`, `glob`)
- **Network/HTTP libraries** (`undici`, `axios`, `node-fetch`, `got`, `follow-redirects`)
- **Forge runtime surface** (`@forge/api`)

### Evidence
- **JSON**: `PHASE_01_duplicate_versions.json` — structured duplicate map
- **Human**: `PHASE_01_dupes.txt` — summary + critical-list + top-20 duplicates

### Determinism
Duplicate detection is **lockfile-based** (`package-lock.json` "packages" object). It does NOT depend on `npm ls` runtime output, ensuring reproducibility across CI environments.

---

## Runtime UUID Support

This application uses Node.js built-in `crypto.randomUUID()` for generating unique identifiers (e.g., `drift_event_id`, `correlationId`). This approach eliminates the need for the `uuid` npm package as a direct dependency, reducing the supply-chain attack surface.

### Compatibility
- **Forge Runtime**: `nodejs20.x` (as declared in `manifest.yml`)
- **Minimum Requirement**: Node.js v14.17.0 (when `crypto.randomUUID()` was introduced)
- **Current Target**: Node.js 20.20.0 (declared in `package.json` engines)
- **Compatibility Margin**: 6+ major versions above minimum requirement

### Determinism Guarantee
The `crypto.randomUUID()` function is used exclusively for **non-canonical purposes**:
- **drift_event_id**: Primary key for storage/retrieval (excluded from `canonical_hash`)
- **correlationId**: Request tracing/logging only (not part of export packs)

All deterministic outputs (snapshot `canonical_hash`, export packs, evidence ledgers) explicitly exclude random UUID fields. See Phase 06 (Determinism Hard Proof) for byte-identical reproduction verification.

### Taint Gates (Phase 06)
Two hardened gates prevent random UUIDs from leaking into deterministic code paths:

1. **correlationId Scan**: Prevents accidental metadata leakage by blocking `correlationId` usage in export/canonical/hash paths. Fails if found in `src/export`, `src/evidence`, `src/zip`, `src/phase6`, or any `*canonical*.ts`, `*hash*.ts`, `*export*.ts` files.

2. **randomUUID Scan**: Prevents bypass via renaming by directly blocking `randomUUID()` calls in deterministic paths. Fails if found in `src/export`, `src/evidence`, `src/zip`, `src/pack`, `src/audit`, `src/phase6`, or any `*canonical*.ts`, `*hash*.ts`, `*export*.ts` files.

Both gates produce evidence artifacts: `PHASE_06_correlationId_taint_scan.txt` and `PHASE_06_randomUUID_taint_scan.txt`.

### Source
Node.js v14.17.0 Release Notes (2021-05-11): Introduction of `crypto.randomUUID()` as per Web Crypto API standard.

---

## Running the Audit

```bash
cd atlassian/forge-app
bash tools/audit/v3_1/run_f100_hostile_audit_v3_1.sh
```

**Exit codes:**
- `0` → CONDITIONAL_ACCEPT (score ≥ 85, no FAIL, < 3 HIGH flags)
- `1` → Any other decision
- `2` → Git tree dirty (pre-condition failure)

**Evidence:**

All evidence is written to `/tmp/ft_f100_hostile_audit_v3_1_<ISO8601>/` and archived to `/tmp/ft_f100_hostile_audit_v3_1_<ISO8601>.zip`.

---

## Evidence Structure

```
/tmp/ft_f100_hostile_audit_v3_1_<timestamp>/
├── PHASE_00_environment.txt       # Tool versions, git state
├── PHASE_00_npm_ci.txt            # npm ci output
├── PHASE_01_version_check.txt     # Dependency version audit
├── PHASE_01_npm_audit.json        # npm audit JSON
├── PHASE_01_npm_ls.json           # Full dependency tree
├── PHASE_01_dupes.txt             # Duplicate version report
├── PHASE_01_outdated.json         # Outdated security-sensitive packages
├── PHASE_02_secrets_findings.txt  # Secrets scan narrative
├── PHASE_02_secrets_findings.json # Structured secret findings
├── PHASE_02_trufflehog.json       # Trufflehog findings (if available)
├── PHASE_03_manifest_summary.txt  # Manifest parse + scope/egress gates
├── PHASE_03_entrypoint_binding.txt # Export handler binding proof
├── PHASE_04_exfil_findings.json   # Network/telemetry findings
├── PHASE_04_exfil_summary.txt     # Exfiltration audit narrative
├── PHASE_05_storage_key_audit.json # Storage key audit
├── PHASE_05_forge_specific_summary.txt
├── PHASE_06_determinism.txt       # Entropy scan + double-run proof
├── run1/, run2/                   # Double-run artifacts
├── PHASE_07_test.txt              # npm test output
├── PHASE_07_eslint.txt            # ESLint output
├── PHASE_07_forge_lint.txt        # forge lint output
├── PHASE_07_forge_deploy_dry.txt  # forge deploy --dry-run output
├── PHASE_08_semgrep.json          # Semgrep JSON results
├── PHASE_08_semgrep_summary.txt   # Semgrep narrative
├── PHASE_09_quota_simulation.txt  # DoS/quota simulation log
├── PHASE_09_memory_samples.csv    # Memory usage per iteration
├── PHASE_10_silent_failures.txt   # Silent failure findings
├── PHASE_10_silent_failures.json  # Structured silent failure findings
├── PHASE_11_legal_inventory.json  # Governance document inventory
├── PHASE_11_external_link_validation.txt
├── PHASE_12_risk_matrix.csv       # Risk matrix (L, I, D, Score)
├── PHASE_12_risk_matrix.md        # Risk matrix Markdown table
├── SCORING_SUMMARY.json           # Final score breakdown
├── results.json                   # All phase results (incremental)
├── FINAL_REPORT.md                # Human-readable final report
├── 00_sbom.json                   # Software Bill of Materials
└── EVIDENCE_MANIFEST.SHA256       # SHA256 of all evidence files
```

---

## Local Forge Semgrep Rules (`semgrep/forge.yml`)

| Rule ID | Severity | Description |
|---------|----------|-------------|
| `forge-unsanctioned-fetch` | ERROR | `fetch()` not from `@forge/api` |
| `forge-no-eval` | ERROR | `eval()` usage |
| `forge-no-new-function` | ERROR | `new Function()` usage |
| `forge-no-child-process` | ERROR | `child_process` import |
| `forge-ssrf-url-construction` | ERROR | URL from user-controlled data |
| `forge-process-env-in-canonical` | WARNING | `process.env` in canonical paths |
| `forge-no-console-log-in-prod` | WARNING | `console.log` in prod source |
| `forge-hardcoded-credentials` | ERROR | Hardcoded tokens |
| `forge-storage-static-key-no-tenant` | WARNING | Storage keys without tenant binding |

---

## Limitations & Caveats

1. **Offline audit**: Cannot verify live Forge runtime behaviour on Atlassian infrastructure.
2. **Semgrep heuristics**: Pattern matching is not full data-flow analysis; false negatives possible.
3. **Network-blocked environments**: External link validation and trufflehog updates require outbound access.
4. **Forge runtime quota**: Memory simulation uses a mock harness; actual Forge memory limits differ.
5. **History scan bound**: Repositories with >10,000 commits are scanned for recent 10,000 + tags only.
6. **Managed secrets**: Secrets in Forge's environment variable store are not accessible for scanning.

---

## Commit Convention

Audit tooling changes should be committed with:

```
audit: add F100 hostile enterprise audit v3.1 (safe history scan + isolated mocks + forge rules)
```

---

*F100 Hostile Audit v3.1 — FirstTry Governance*
