# Documentation Index

**Last Updated**: 2026-01-10  
**Purpose**: Master index of all FirstTry documentation

---

## For Jira Admins

Start here if you're installing or using FirstTry:

| Document | Purpose |
|----------|---------|
| [USER_GUIDE.md](USER_GUIDE.md) | Installation, dashboard features, troubleshooting |
| [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md) | What data FirstTry accesses and how it's protected |
| [DATA_RETENTION_POLICY.md](DATA_RETENTION_POLICY.md) | How long data is kept and when it's deleted |
| [PRODUCT_BOUNDARIES.md](PRODUCT_BOUNDARIES.md) | What FirstTry can and cannot do |

---

## For Atlassian Marketplace Reviewers

Use these documents to evaluate FirstTry for Marketplace listing:

| Document | Purpose |
|----------|---------|
| [REVIEWER_FAQ.md](REVIEWER_FAQ.md) | Common reviewer questions answered |
| [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md) | Scope justification, data handling, API calls |
| [EVIDENCE_INTEGRITY.md](EVIDENCE_INTEGRITY.md) | Determinism testing, hash verification |
| [../audit/CLAIMS_LEDGER.md](trust/generated/repo_refs.md) | Every factual claim with proof pointer |

---

## For Security Auditors

If you're conducting a security audit:

| Document | Purpose |
|----------|---------|
| [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md) | Scope declarations, API surface, data flows |
| [PRODUCT_BOUNDARIES.md](PRODUCT_BOUNDARIES.md) | What FirstTry does and doesn't do |
| [../legal/VULNERABILITY_DISCLOSURE.md](trust/generated/legal_mirror.md) | Responsible disclosure policy |
| [../audit/proof_runs/*/](trust/generated/repo_refs.md) | Automated proof artifacts (code scans, tests, manifests) |

---

## For Developers

If you're contributing or extending FirstTry:

| Document | Purpose |
|----------|---------|
| [../README.md](trust/generated/repo_refs.md) | Project overview and quick start |
| [Manifest Scopes](trust/generated/manifest_scopes.md) | App configuration and scopes declaration |

## For Legal & Compliance Teams

| Document | Purpose |
|----------|---------|
| [../legal/PRIVACY_POLICY.md](trust/generated/legal_mirror.md) | Privacy practices and data handling |
| [../legal/TERMS_OF_USE.md](trust/generated/legal_mirror.md) | Terms and conditions |
| [../legal/VULNERABILITY_DISCLOSURE.md](trust/generated/legal_mirror.md) | Security issue reporting |
| [../legal/SUPPORT_POLICY.md](trust/generated/legal_mirror.md) | Support SLAs and responsiveness |
| [../legal/INCIDENT_RESPONSE_OVERVIEW.md](trust/generated/legal_mirror.md) | Incident response procedures |
| [../legal/SUBPROCESSORS.md](trust/generated/legal_mirror.md) | Third-party data processors |

---

## Enterprise Documentation

| Document | Purpose |
|----------|---------|
| [../enterprise/SECURITY_WHITEPAPER.md](trust/generated/repo_refs.md) | In-depth security architecture (4+ pages) |
| [../enterprise/CUSTOMER_EXIT_PLAN.md](trust/generated/repo_refs.md) | Data export and uninstall procedures |
| [../enterprise/COMPLIANCE_MAPPING_NOTES.md](trust/generated/repo_refs.md) | Alignment with GDPR, SOC 2, and other standards |

---

## Marketplace Submission

| Document | Purpose |
|----------|---------|
| [../marketplace/LISTING_COPY.md](trust/generated/repo_refs.md) | App description and marketing copy |
| [../marketplace/SCREENSHOT_PLAN.md](trust/generated/repo_refs.md) | Screenshots and UX walkthrough |
| [../marketplace/badges/read_only_no_writes.svg](trust/generated/repo_refs.md) | Visual badge proving read-only guarantee |

---

## Proof & Audit Artifacts

**Location**: `../audit/proof_runs/run_20260110_121856/`

| Artifact | Contents |
|----------|----------|
| `00_RUN_CONTEXT.md` | Execution environment and toolchain versions |
| `manifest_numbered.txt` | Full manifest with line numbers |
| `manifest_parsed.md` | Parsed scopes, modules, egress tables |
| `jira_api_call_sites.txt` | All Jira API callsites (grepped) |
| `code_write_surface_scan.txt` | Search for write operations (POST/PUT/DELETE/PATCH) |
| `npm_ci.log` | npm clean install output |
| `npm_test_normal.log` | npm test results (normal mode, 1243 tests) |
| `npm_test_deterministic.log` | npm test results (deterministic mode, 1243 tests) |
| `npm_audit.json` | npm audit report (zero vulnerabilities) |
| `npm_audit_summary.md` | Parsed npm audit summary |
| `NPM_AUDIT_SUMMARY.md` | Vulnerability analysis |
| `DEPENDENCY_INVENTORY.md` | Top-level dependencies and versions |
| `forge_lint_production.log` | forge lint output (no issues) |

---

## Quick Reference

**Is FirstTry read-only?** → Yes, see [PRODUCT_BOUNDARIES.md](PRODUCT_BOUNDARIES.md)  
**What data does it access?** → See [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md)  
**How long is data kept?** → See [DATA_RETENTION_POLICY.md](DATA_RETENTION_POLICY.md)  
**Is there a security issue?** → Report via [../legal/VULNERABILITY_DISCLOSURE.md](trust/generated/legal_mirror.md)  
**Installation help?** → See [USER_GUIDE.md](USER_GUIDE.md)

---

**Need help?** Contact: `contact@firsttry.run`

