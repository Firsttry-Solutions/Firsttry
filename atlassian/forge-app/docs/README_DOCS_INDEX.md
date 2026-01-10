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
| [../audit/CLAIMS_LEDGER.md](../audit/CLAIMS_LEDGER.md) | Every factual claim with proof pointer |

---

## For Security Auditors

If you're conducting a security audit:

| Document | Purpose |
|----------|---------|
| [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md) | Scope declarations, API surface, data flows |
| [PRODUCT_BOUNDARIES.md](PRODUCT_BOUNDARIES.md) | What FirstTry does and doesn't do |
| [../legal/VULNERABILITY_DISCLOSURE.md](../legal/VULNERABILITY_DISCLOSURE.md) | Responsible disclosure policy |
| [../audit/proof_runs/*/](../audit/proof_runs/) | Automated proof artifacts (code scans, tests, manifests) |

---

## For Developers

If you're contributing or extending FirstTry:

| Document | Purpose |
|----------|---------|
| [../README.md](../README.md) | Project overview and quick start |
| [../manifest.yml](../manifest.yml) | App configuration and scopes declaration |
| [../SCOPES_JUSTIFICATION.md](../SCOPES_JUSTIFICATION.md) | Why each scope is needed |

---

## For Legal & Compliance Teams

| Document | Purpose |
|----------|---------|
| [../legal/PRIVACY_POLICY.md](../legal/PRIVACY_POLICY.md) | Privacy practices and data handling |
| [../legal/TERMS_OF_USE.md](../legal/TERMS_OF_USE.md) | Terms and conditions |
| [../legal/VULNERABILITY_DISCLOSURE.md](../legal/VULNERABILITY_DISCLOSURE.md) | Security issue reporting |
| [../legal/SUPPORT_POLICY.md](../legal/SUPPORT_POLICY.md) | Support SLAs and responsiveness |
| [../legal/INCIDENT_RESPONSE_OVERVIEW.md](../legal/INCIDENT_RESPONSE_OVERVIEW.md) | Incident response procedures |
| [../legal/SUBPROCESSORS.md](../legal/SUBPROCESSORS.md) | Third-party data processors |

---

## Enterprise Documentation

| Document | Purpose |
|----------|---------|
| [../enterprise/SECURITY_WHITEPAPER.md](../enterprise/SECURITY_WHITEPAPER.md) | In-depth security architecture (4+ pages) |
| [../enterprise/CUSTOMER_EXIT_PLAN.md](../enterprise/CUSTOMER_EXIT_PLAN.md) | Data export and uninstall procedures |
| [../enterprise/COMPLIANCE_MAPPING_NOTES.md](../enterprise/COMPLIANCE_MAPPING_NOTES.md) | Alignment with GDPR, SOC 2, and other standards |

---

## Marketplace Submission

| Document | Purpose |
|----------|---------|
| [../marketplace/LISTING_COPY.md](../marketplace/LISTING_COPY.md) | App description and marketing copy |
| [../marketplace/SCREENSHOT_PLAN.md](../marketplace/SCREENSHOT_PLAN.md) | Screenshots and UX walkthrough |
| [../marketplace/badges/read_only_no_writes.svg](../marketplace/badges/read_only_no_writes.svg) | Visual badge proving read-only guarantee |

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
**Is there a security issue?** → Report via [../legal/VULNERABILITY_DISCLOSURE.md](../legal/VULNERABILITY_DISCLOSURE.md)  
**Installation help?** → See [USER_GUIDE.md](USER_GUIDE.md)

---

**Need help?** Contact: `contact@firsttry.run`

