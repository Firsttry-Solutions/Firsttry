# Changelog

All notable changes to documentation and release artifacts are recorded here.

## v4.2.4 — 2026-02-27 — Truth audit hardening + email integrity + Pages output scan

- NEW: `tools/email_allowlist.txt` — 5 approved email addresses (single source of truth)
- NEW: `tools/email_integrity_gate.mjs` — scans 35 enterprise docs, enforces allowlist + required presences
- UPDATED: `tools/truth_claims_gate.mjs` — enterprise-docs-only scan, excludes CLAIMS_REGISTER meta-doc
- UPDATED: `tools/md_link_check.mjs` — scoped to enterprise dirs, skips mailto: links
- UPDATED: `tools/enterprise_docs_gate.sh` — email gate (step 2b), header pattern fix, path-prefix fix
- UPDATED: `.github/workflows/docs.yml` — email gate step + pages output scan step
- FIXED: All disallowed emails (`security@`, `legal@`, `example.com`) replaced across enterprise docs
- FIXED: 5 broken relative links across operations/procurement/trust docs
- FIXED: SLA.md uptime percentage claims removed (gate compliance)
- Verification: all 4 tools pass

## 2025-12-30
- Initial documentation bundle assembled for Marketplace submission: added PRIVACY.md, TERMS.md, README.md, DATA_FLOW.md, SCOPES_JUSTIFICATION.md, UNINSTALL.md, LIMITATIONS.md, EXPORT_FORMAT.md, EVIDENCE_INTEGRITY.md, CHANGELOG.md, MARKETPLACE_SUBMISSION_INDEX.md.
