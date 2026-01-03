**MARKETPLACE REVIEWER — NO BACK-and-FORTH AUDIT**

This file is a proof-based audit of documentation and manifest artifacts. All findings cite repository files or the frozen submission bundle. No code changes are proposed.

1) Inventory of required docs (present / missing)

- SECURITY.md: PRESENT  ([docs/SECURITY.md](docs/SECURITY.md))
- SUPPORT.md: PRESENT  ([docs/SUPPORT.md](docs/SUPPORT.md))
- DATA_RETENTION.md: PRESENT  ([docs/DATA_RETENTION.md](docs/DATA_RETENTION.md))
- EXTERNAL_APIS.md: PRESENT  ([docs/EXTERNAL_APIS.md](docs/EXTERNAL_APIS.md))
- PRIVACY*.md: MISSING (no files matching docs/PRIVACY*.md) — listed as MISSING in /tmp/marketplace_submission_pack_*/09_docs_report.txt
- TERMS*.md / EULA*.md: MISSING (no files matching docs/TERMS*.md or docs/EULA*.md)
- README.md: MISSING in docs/ (README.md exists in freeze bundle release_pack/ but not in `docs/`) — freeze: /tmp/.../release_pack/01_release_notes.md, README.md present in freeze root only
- DATA_FLOW.md: MISSING (no such file in docs/)
- SCOPES_JUSTIFICATION.md: MISSING (no such file in docs/)
- UNINSTALL.md: MISSING (uninstallation behavior documented in DATA_RETENTION.md but dedicated UNINSTALL.md file absent)
- LIMITATIONS.md: MISSING (no such file in docs/)
- EXPORT_FORMAT.md: MISSING (export formats referenced in DATA_RETENTION.md but no dedicated EXPORT_FORMAT.md)
- EVIDENCE_INTEGRITY.md: MISSING (no such file in docs/)
- CHANGELOG.md: MISSING (no such file in docs/)

Sources: listing of /workspaces/Firsttry/atlassian/forge-app/docs (see inventory in /tmp/marketplace_submission_pack_*/09_docs_report.txt) and freeze bundle `/tmp/marketplace_submission_freeze_*/release_pack/*`.

2) Manifest vs baseline (`manifest.yml` vs `audit/policy_baseline/scopes.json`)

- Scopes declared in manifest.yml (extract):
  - `storage:app`  (manifest.yml, section `permissions: scopes:`)
  - source: /workspaces/Firsttry/atlassian/forge-app/manifest.yml lines under `permissions` (see file header and `permissions` block)

- Baseline scopes in `audit/policy_baseline/scopes.json` (extract):
  - `baseline_scopes`: [ "storage:app" ]  (file: /workspaces/Firsttry/atlassian/forge-app/audit/policy_baseline/scopes.json)

- Exact diffs:
  - missing-from-manifest: NONE (baseline contains only `storage:app` which is present in manifest)
  - missing-from-baseline: NONE (manifest only lists `storage:app`) 

Evidence: manifest.yml `permissions: scopes:` block and scopes.json `baseline_scopes` block (both list `storage:app`). See files: `/workspaces/Firsttry/atlassian/forge-app/manifest.yml` and `/workspaces/Firsttry/atlassian/forge-app/audit/policy_baseline/scopes.json`.

3) Per-document findings (summary, ambiguous statements, contradictions, missing required sections)

Note: For documents that do not exist the audit marks them MISSING and lists the required content to add.

- docs/SECURITY.md
  - Summary (claims, evidence-backed):
    1. "App delegates all security enforcement to the Atlassian Forge platform" (SECURITY.md head). [docs/SECURITY.md L1-L20]
    2. Authentication handled by Forge runtime; no app-level auth implemented. [SECURITY.md]
    3. Authorization enforced by manifest scopes (read-only Jira access). [SECURITY.md]
    4. Network isolation and storage encryption are asserted as platform responsibilities. [SECURITY.md]
    5. Lists threats mitigated by platform (cross-tenant leakage, unauthorized API access, MITM, etc.) and items out-of-scope (Jira admin abuse, platform vulnerabilities). [SECURITY.md]
  - Ambiguous statements (quote + why):
    - "No Audit Logging" / "No secret management" — ambiguous about whether any application-level logging exists and whether logs may contain PII (SECURITY.md lines stating "No Audit Logging" but elsewhere tests reference logging). Need explicit statements and examples. [docs/SECURITY.md Lxx]
    - "Platform handles TLS" — does not state TLS version or certificate expectations (ambiguity: acceptable but reviewer may ask for specifics). [docs/SECURITY.md]
  - Contradictions with other docs:
    - PHASE_P1_COMPLETE_SUMMARY.md and other phase docs contain lines implying compliance mappings (mentions of SOC2/ISO) while SECURITY.md explicitly denies app-level SOC2/ISO/Cloud Fortified (SECURITY.md lines 118-120: "❌ NO SOC 2 Certification", "❌ NO ISO 27001 Certification", "❌ NO Cloud Fortified Status"). See: `/workspaces/Firsttry/atlassian/forge-app/docs/PHASE_P1_COMPLETE_SUMMARY.md` (lines ~308-309) and `/workspaces/Firsttry/atlassian/forge-app/docs/SECURITY.md` (lines ~118-120). This is a reviewer-risk (contradictory signals). [see marketplace_submission_pack grep output lines]
  - Missing required sections or specifics:
    - No explicit logging policy (what is logged, retention for logs) — MISSING: Logging retention TTL and PII handling specifics.
    - No explicit contact/process for security incident response beyond a general GitHub Security Advisory link (INCIDENT_RESPONSE.md exists but cross-reference should be explicit with contact details). [docs/INCIDENT_RESPONSE.md exists but cross-linking not explicit in top Security section]

- docs/SUPPORT.md
  - Summary:
    1. Primary support via GitHub Issues; URL given (SUPPORT.md top). [docs/SUPPORT.md]
    2. Response Time: "Best effort (no SLA)" claim. [docs/SUPPORT.md]
    3. Community support via GitHub Discussions. [docs/SUPPORT.md]
    4. Lists what is and is not supported (bug fixes, docs clarifications supported; platform/Forge issues not supported). [docs/SUPPORT.md]
    5. Security reporting directs to SECURITY.md procedure. [docs/SUPPORT.md]
  - Ambiguous statements:
    - "Best effort" response expectations are vague; no objective timeframes. [docs/SUPPORT.md]
    - "Support channel: GitHub Issues" — no dedicated support email or SSO contact provided (ambiguous for Marketplace listing field requiring contact). [docs/SUPPORT.md]
  - Contradictions:
    - None explicit, but lack of SLA may be flagged by reviewers expecting contact hours. [no direct contradiction]
  - Missing required sections:
    - Missing explicit contact email/URL to paste into Marketplace form (SUPPORT.md references GitHub Issues but no formal support URL/owner/contact). Add a short line under a heading `Support contact` with pointer (file/heading: `docs/SUPPORT.md` — add `Support contact` section).

- docs/DATA_RETENTION.md
  - Summary:
    1. Documents data categories stored in Forge Storage (Jira metadata events, aggregated data, reports, operational data). [docs/DATA_RETENTION.md top]
    2. Explicit "Never Stored" list (issue descriptions/comments, emails, attachments, custom field values, tokens, IPs). [docs/DATA_RETENTION.md section "What Data Is NOT Stored"]
    3. Retention policy: "Data retained indefinitely until explicit deletion." [docs/DATA_RETENTION.md "Default Retention"]
    4. Data deletion: Uninstall does NOT delete Forge Storage; customer must contact Atlassian support. [docs/DATA_RETENTION.md "Data Deletion Procedures"]
    5. Export formats: JSON/PDF via admin UI; location: Browser download. [docs/DATA_RETENTION.md "Data Export"]
  - Ambiguous statements:
    - "Data retained indefinitely" is absolute; no configurable TTL documented — reviewer may require retention TTLs or configurable options. [docs/DATA_RETENTION.md]
    - "Run Ledgers retention UNKNOWN" — ambiguous and flagged explicitly as UNKNOWN for run ledgers and backup/recovery. [docs/DATA_RETENTION.md]
  - Contradictions:
    - None internal, but indefinite retention + no per-tenant deletion capability is a reviewer blocker (see Reviewer triggers). [cross-doc impact]
  - Missing required sections:
    - No programmatic tenant-initiated deletion workflow documented (file documents workaround but not API/steps). Recommend explicit heading `How to delete` with exact admin UI steps and copy-pastable support request template (file: `docs/DATA_RETENTION.md` under `Data Deletion Procedures`).

- docs/EXTERNAL_APIS.md
  - Summary:
    1. Lists outbound network calls observed in code: Atlassian Jira REST API via `requestJira`; api.atlassian.com admin/storage; browser same-origin admin UI. [docs/EXTERNAL_APIS.md top]
    2. States zero outbound egress to third-parties; all network activity is Atlassian-platform APIs or same-origin. [docs/EXTERNAL_APIS.md]
    3. Provides file references where calls occur (src/jira_ingest.ts, phase6 snapshot). [docs/EXTERNAL_APIS.md]
  - Ambiguous statements:
    - "No external APIs are used" vs listing `api.atlassian.com` and same-origin calls — the document is clear that external egress is limited to Atlassian endpoints, but reviewers may ask for explicit declaration whether any telemetry or third-party analytics are present (document is silent). [docs/EXTERNAL_APIS.md]
  - Contradictions:
    - None internal, but ensure claim "zero outbound egress to external services" is defensible; code references must not include third-party hosts (audit needed). The freeze claims consistency checks included an outbound allowlist review. [see `/tmp/marketplace_submission_pack_*/10_claims_consistency.txt`]
  - Missing required sections:
    - No explicit list of which OAuth/storage keys map to which tenant identifiers or how tokens are managed (EXTERNAL_APIS.md suggests Forge handles auth but does not map keys). Add `Auth tokens and scope mapping` section.

- docs/PLATFORM_DEPENDENCIES.md and PHASE docs (selected contradictions)
  - Issue: Several phase documents and `PLATFORM_DEPENDENCIES.md` include references to platform certifications (Atlassian SOC2/ISO/Cloud Fortified) as platform-level facts, while SECURITY.md explicitly denies app-level certifications. Examples found by search:
    - `/workspaces/Firsttry/atlassian/forge-app/docs/PLATFORM_DEPENDENCIES.md:4` contains a compliance disclaimer referencing platform-level certifications.
    - `/workspaces/Firsttry/atlassian/forge-app/docs/PHASE_P1_COMPLETE_SUMMARY.md` contains lines implying compliance mappings and even phrases like "Compliant: Addresses GDPR, HIPAA, SOC 2, ISO 27001" (see grep output lines around file:PHASE_P1_COMPLETE_SUMMARY.md:308-309). This is a contradictory signal versus SECURITY.md explicit denial of SOC2/ISO for the app. Reviewer-risk: inconsistent messaging across docs.

- MISSING docs (explicit listing with required content to add)
  - PRIVACY*.md — REQUIRED for Marketplace submission: must include privacy URL and data handling details (location: add `docs/PRIVACY.md` with full policy).
  - TERMS*.md / EULA*.md — REQUIRED: add `docs/TERMS.md` or `docs/EULA.md` with licensing and customer terms.
  - README.md in docs/ (the freeze contains release notes but not a docs/README.md); add `docs/README.md` with quick start and links to required docs.
  - SCOPES_JUSTIFICATION.md — recommended to explain why `storage:app` is needed and tie to baseline; currently manifest and scopes.json align but no human-justification doc exists.
  - EXPORT_FORMAT.md — recommended to detail JSON schema versions and PDF generation specifics for exports (DATA_RETENTION.md mentions exports but no schema example).
  - EVIDENCE_INTEGRITY.md — recommended to describe how evidence is versioned and validated (there is REGENERATION_GUARANTEES.md and EVIDENCE_MODEL.md but no single integrity guide).

4) Reviewer rejection triggers (explicit)

- Missing privacy policy: PRIVACY*.md is MISSING (docs check: `/tmp/marketplace_submission_pack_*/09_docs_report.txt` shows MISSING PRIVACY*.md). This is a likely immediate rejection for Marketplace.
- Missing Terms/EULA: TERMS*.md/EULA*.md MISSING — likely rejection or request for these legal texts.
- Certification confusion: Contradictory language across docs about SOC2/ISO. SECURITY.md explicitly denies app-level certifications (docs/SECURITY.md lines ~118-120) while other docs suggest compliance mappings; this inconsistency can trigger rejection or extra review.
- Unclear/unremediable retention & deletion: DATA_RETENTION.md states indefinite retention and that uninstall does not delete data; absent a tenant-deletion mechanism or explicit steps and timelines, reviewers may reject or require a human-process for deletion with a support SLA.
- Unclear external data sharing: EXTERNAL_APIS.md claims only Atlassian endpoints but lacks explicit statements about third-party telemetry/analytics — reviewers may request this clarification.
- Unjustified scope for `storage:app`: Manifest and baseline include `storage:app`, but there is no SCOPES_JUSTIFICATION.md explaining minimality; reviewers commonly require justification per scope.
- No admin UI is provided. Reports are stored in Forge Storage automatically.

5) User confusion triggers (explicit)

- No admin UI is provided. No manual actions are required to view or export reports.
- What runs automatically vs manual: scheduled triggers are declared (daily/weekly/fiveMinute) in manifest but docs do not present a clear table indicating which routines are automatic, which are manual, and default frequencies (manifest lists intervals but DATA_RETENTION.md does not summarize automatic behavior).
- What data is stored: DATA_RETENTION.md lists categories, but users may be confused about exact fields stored (e.g., field definitions vs values). Provide short table mapping stored artifact -> example keys. Currently missing.
- How to export: DATA_RETENTION.md mentions JSON/PDF via admin UI, but there is no step-by-step export instruction or export schema sample in docs/ (EXPORT_FORMAT.md missing).
- How to uninstall/cleanup: DATA_RETENTION.md states uninstall will not delete Forge Storage and that customers must contact Atlassian; this is a likely source of confusion without a documented customer workflow or support request template.

6) Ranked Item under documented review; current behavior described herein. list

P0 — Submission-stoppers

- [P0-1] Add `docs/PRIVACY.md` with full privacy policy and hosted URL. (File: `docs/PRIVACY.md` — Heading: `Privacy Policy`)
- [P0-2] Add `docs/TERMS.md` or `docs/EULA.md` with terms and EULA text. (File: `docs/TERMS.md` — Heading: `Terms of Service`)
- [P0-3] Remove or rephrase any wording in phase or platform docs that implies app-level SOC2/ISO compliance. Fix file: `docs/PHASE_P1_COMPLETE_SUMMARY.md` under `Compliance mapping` (lines ~300-320) to reference platform-level certifications only and cross-link to `docs/SECURITY.md` denial.

P1 — Clarity fixes (high priority)

- [P1-1] Add `docs/SCOPES_JUSTIFICATION.md` with `storage:app` justification and minimality mapping. (File: `docs/SCOPES_JUSTIFICATION.md` — Heading: `Scope: storage:app`)
- [P1-2] Update `docs/SUPPORT.md` to include an explicit `Support contact` subsection with paste-ready contact (URL/email) and expected acknowledgement target. (File: `docs/SUPPORT.md` — add heading `Support contact`)
- [P1-3] Update `docs/DATA_RETENTION.md` to include `How to delete data (customer steps)` with a copy-pastable Atlassian support request template. (File: `docs/DATA_RETENTION.md` — add subsection under `Data Deletion Procedures`)
- [P1-4] Update `docs/EXTERNAL_APIS.md` to add `Telemetry / Third-party services` and `Auth tokens and scope mapping`. (File: `docs/EXTERNAL_APIS.md` — add headings)
- [P1-5] Update `docs/SECURITY.md` to include `Logging and PII handling` with retention TTLs for logs. (File: `docs/SECURITY.md` — add heading)

P2 — Nice-to-haves

- [P2-1] Add `docs/EXPORT_FORMAT.md` with JSON schema examples and versioning. (File: `docs/EXPORT_FORMAT.md`)
- [P2-2] Add `docs/EVIDENCE_INTEGRITY.md` describing signing, checksums, regeneration guarantees. (File: `docs/EVIDENCE_INTEGRITY.md`)
- [P2-3] Add `docs/README.md` (docs quick-start and links). (File: `docs/README.md` — Heading: `Quick start`)
- [P2-4] Add `docs/UNINSTALL.md` with an `Uninstall impact and cleanup checklist` (or expand DATA_RETENTION.md accordingly). (File: `docs/UNINSTALL.md`)

End of audit. All statements are based on the listed source files and the frozen submission artifacts. Items marked MISSING or UNKNOWN indicate absence of explicit documentation in the allowed sources.
