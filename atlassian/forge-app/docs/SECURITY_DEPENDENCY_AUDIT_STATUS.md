# Security Dependency Audit Status

## Overview

This document describes how npm dependency vulnerabilities are deterministically captured, evaluated, and reported for the Firsttry Forge App.

The audit process is designed to be:
- **Deterministic**: Same results on every run from the same state
- **Evidence-backed**: All findings are captured and reproducible
- **Fail-closed**: Policies reject unsafe production states, warn on dev-only issues
- **Enterprise-safe**: Claims are factual, not aspirational

---

## Current Production Audit Status (Automated)

**Last Verified:** 2026-02-18 07:23:42 UTC  
**Git Commit:** 51dde89b (chore: add deterministic npm audit...)  
**Command:** `npm audit --omit=dev`  
**Result:** **0 vulnerabilities**

### Remediation Applied

Production vulnerabilities from prior audit were fixed using npm "overrides" mechanism (no new dependencies, no version changes to declared dependencies):

```json
"overrides": {
  "@isaacs/brace-expansion": "5.0.1",
  "ajv": "8.18.0",
  "markdown-it": "14.1.1"
}
```

These overrides:
- ✓ Pin vulnerable transitive dependencies to patched versions
- ✓ Preserve `npm ci --include=dev` determinism (via package-lock.json)
- ✓ Do not require changes to manifest.yml
- ✓ Do not add new root dependencies
- ✓ Pass all build verification gates (15/15)
- ✓ Audit policy gate: PASS (prod audit clean)

**Verification:**
```
$ npm ls @isaacs/brace-expansion ajv markdown-it --all
@isaacs/brace-expansion@5.0.1 overridden
ajv@8.18.0 overridden
markdown-it@14.1.1 overridden
```

---

## Audit Methodology

### 1. Deterministic Installation (npm ci)

All audit assessments start with a clean, deterministic install:

```bash
rm -rf node_modules
npm ci --include=dev
```

This ensures:
- Exact versions from `package-lock.json` are installed
- No automatic upgrades or substitutions
- Reproducible results across machines and CI systems

### 2. Audit Capture

Two audit scans are performed:

**Full Dependency Audit** (all + devDependencies):
```bash
npm audit --json
```

**Production-Only Audit** (excluding devDependencies):
```bash
npm audit --omit=dev --json
```

Results are captured as both text and JSON for:
- Human readability (text outputs)
- Deterministic parsing (JSON, no regex fragility)

### 3. Policy Evaluation

A policy gate classifies vulnerabilities by production risk:

| Rule | Condition | Action |
|------|-----------|--------|
| **P1 (PROD HIGH)** | Production-only audit contains HIGH or CRITICAL | **FAIL** (blocks release) |
| **P2 (PROD MODERATE)** | Production-only audit contains MODERATE | **FAIL** (blocks release) |
| **D1 (DEV HIGH)** | All-deps has HIGH/CRITICAL that are NOT in production | **WARN** (allows release, recorded) |
| **D2 (DEV MODERATE)** | All-deps has MODERATE that are NOT in production | **WARN** (allows release, recorded) |

---

## Audit Policy

### What Blocks Release (FAIL)

The policy fails the build if:

1. **Production has a HIGH or CRITICAL vulnerability** (must be fixed before release)
2. **Production has a MODERATE vulnerability** (must be addressed for enterprise posture)

### What Does NOT Block Release (WARN)

The policy allows release but records warnings if:

1. **Dev-only dependencies have HIGH/CRITICAL vulnerabilities** (do not ship to end-users)
2. **Dev-only dependencies have MODERATE vulnerabilities** (do not ship to end-users)

### Rationale

- **Production vulnerabilities** directly affect users and must be mitigated.
- **Dev-only vulnerabilities** (build tools, testing, CI) do not reach production and are acceptable with warning.
- The threshold for production (HIGH/CRITICAL+MODERATE) is stricter than industry baseline to support enterprise compliance posture.

---

## Running Audits Manually

### Capture Evidence

```bash
bash tools/proof/capture_audit_evidence.sh
# Output: /tmp/ft_audit_YYYYMMDDTHHMMSSZ/
```

This creates:
- `10_ci.txt` – npm ci output
- `20_audit_all.txt` – npm audit (all deps, text)
- `21_audit_all.json` – npm audit (all deps, JSON)
- `30_audit_prod.txt` – npm audit --omit=dev (text)
- `31_audit_prod.json` – npm audit --omit=dev (JSON)
- `40_ls_depth0.txt` – npm ls --depth=0 output

### Evaluate Policy

```bash
bash tools/verify_audit_policy.sh
# Outputs: FT_AUDIT_POLICY_RESULT status=PASS|FAIL prod_high=N prod_mod=N dev_high=N dev_mod=N
# Exit code: 0 (PASS/WARN), 1 (FAIL)
```

### CI Integration

The policy gate is wired into the build verification pipeline and runs on every `npm run build`:

```bash
npm run build  # includes verify:audit:policy gate
```

---

## Current Audit Status

**Last Verified:** [Updated by evidence capture script with git SHA and UTC timestamp]

The current state is documented in evidence directories under `/tmp/ft_audit_*/`:

- Production vulnerabilities counted in `audit_prod.json` per severity
- Dev-only vulnerabilities counted as difference between `audit_all.json` and `audit_prod.json`
- Policy result: **PASS** or **FAIL** determined by rules P1-P2
- Dev warnings: Recorded in gate output, do not block release

---

## Vulnerability Management

### What We Do NOT Do

- ✗ Run `npm audit fix` automatically (can break compatibility)
- ✗ Claim security posture without evidence
- ✗ Hide vulnerabilities or misreport counts

### What We Do

- ✓ Capture audit state deterministically on every build
- ✓ Distinguish production-only from dev-only vulnerabilities
- ✓ Enforce policy: FAIL on prod risk, WARN on dev-only
- ✓ Provide evidence trail for enterprise review

---

## Reproduction Instructions

To verify audit status independently:

```bash
cd /workspaces/Firsttry/atlassian/forge-app

# Clean install
rm -rf node_modules
npm ci --include=dev

# Full audit
npm audit --json | jq '.vulnerabilities'

# Production-only audit
npm audit --omit=dev --json | jq '.vulnerabilities'

# Policy gate (deterministic evaluation)
bash tools/verify_audit_policy.sh
```

---

## Constraints

This audit system **does not**:
- Modify `manifest.yml` (Forge app configuration)
- Modify `package.json` (declared dependencies)
- Modify `package-lock.json` (fix vulnerabilities by upgrading)
- Add new dependencies (only works with existing tree)
- Automatically fix vulnerabilities (requires manual security review)

These constraints ensure:
- Transparency (no invisible changes)
- Determinism (same code = same audit results)
- Traceability (all decisions are documented and reproducible)

---

## References

- **npm audit documentation**: https://docs.npmjs.com/cli-commands/audit
- **Vulnerability severity definitions**: https://docs.npmjs.com/about-npm/security-notice
- **Deterministic builds**: tools/proof/capture_audit_evidence.sh
- **Policy gate**: tools/verify_audit_policy.sh

---

*Last Updated: 2026-02-18*
*This document describes the mechanism for deterministic, evidence-backed audit reporting.*
