# Changelog

All notable changes to documentation and release artifacts are recorded here.

## v4.2.7 — 2026-02-26 — Move Pages workflow to repo root so Actions actually runs

- CREATED: `.github/workflows/docs.yml` at repo root — GitHub Actions only reads workflows from repo root
- ADDED: "Smoke proof" step (find + assert 3 required files: SECURITY_OVERVIEW.md, SLA.md, ENTERPRISE_SECURITY_PACK_INDEX.md)
- DELETED: `atlassian/forge-app/.github/workflows/docs.yml` (was never executed by Actions)
- Landing page updated to v4.2.7
- Verification: all 4 gates pass

## v4.2.6 — 2026-02-26 — Fix GitHub Pages publishing to deploy enterprise pack from forge-app/site

- UPDATED: `docs.yml` — deterministic site/ build: `rm -rf site` first, then selective copy of enterprise pack
- NEW STEP: "Verify Pages output shape (fail-closed)" — asserts required files, forbidden dirs, placeholder scan, strict email allowlist check (sorted output)
- REMOVED: old "Scan Pages output for placeholder emails" step (replaced by new fail-closed step)
- Landing page updated to v4.2.6 with full pack navigation (all required files linked)
- Verification: all 4 gates pass; site shape dry-run: 10/10 required files OK, 0 placeholders, 5 approved emails

## v4.2.5 — 2026-02-26 — Pages content alignment + email integrity + placeholder purge

- UPDATED: `docs.yml` — selective site/ build (trust/ operations/ procurement/ evidence/ only)
- UPDATED: `tools/email_integrity_gate.mjs` — expanded placeholder patterns, narrowed scope, SUBPROCESSORS.md in privacy@ required presence
- NEW: `enterprise_docs_gate.sh` step 2c — fail-closed placeholder purge scan
- UPDATED: `docs/trust/SUBPROCESSORS.md` — added privacy@firsttry.run contact section
- UPDATED: `docs/trust/CLAIMS_REGISTER.md` — added SECURITY_OVERVIEW.md to proof inventory (12 EVIDENCE entries)
- Verification: all 4 tools pass (md_link_check ✅ truth_claims_gate ✅ email_integrity_gate ✅ enterprise_docs_gate ✅)



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
