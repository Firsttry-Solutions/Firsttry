# Changelog

All notable changes to documentation and release artifacts are recorded here.

## v4.3.6 — 2026-02-26 — F100 Trust Center Portal: HTML rendering + nav + search

### Added
- `build_trust_portal.mjs` (new): renders 35 markdown docs to styled HTML portal pages
  with sidebar nav, breadcrumbs, metadata panel, print support, view-raw links
- `vendor/marked.min.js` (new): pinned marked v9.1.6 (MIT), vendored for determinism
- `portal.css`: professional enterprise layout (sidebar + content + meta panel),
  table/code styling, mobile off-canvas sidebar, print CSS
- `portal.js`: sidebar toggle, inline nav filter, full-text search from search_index.json
- `search_index.json` (generated): 35 entries with title/heading/excerpt/doc_id
- `portal_nav` in manifest: 5 groups, 35 items, with title/src/route/doc_id
- Executive `index.html`: quick-link cards, section grids, contact block, badges
- All existing fail-closed gates updated for portal HTML routes
- `verify_pages_site_artifact.sh`: checks all 35 portal routes + 3 assets
- `verify_pages_live.sh`: checks HTML routes (not .md paths), portal content check
- No runtime code changed; no app code, manifest, or Forge config touched

## v4.3.5 — 2026-02-26 — Fix YAML syntax error that prevented docs.yml from running

### Fixed
- **Root cause of 404:** `docs.yml` heredoc with HTML at column 0 broke YAML block scalar
  parsing; GitHub Actions rejected the workflow; site never deployed; live URL was 404
- `tools/build_pages_site.mjs` (new): stand-alone Node ESM script that reads manifest,
  copies publish_dirs, writes index.html via JS template literal - no YAML heredoc
- `docs.yml`: build step replaced with `node atlassian/forge-app/tools/build_pages_site.mjs`
  (single line); smoke proof simplified; build_pages_site.mjs added to trigger paths
- `pages_pack_manifest.json`: version 4.3.4 → 4.3.5
- YAML validated with PyYAML safe_load before commit

---

## v4.3.4 — 2026-02-26 — Pages pack manifest + manifest-driven build and verification

### Added
- `tools/pages_pack_manifest.json`: single source of truth for enterprise pack contents
  (version, publish_dirs, required_files). All downstream tools derive from this.
- `verify_pages_site_artifact.sh`: now reads required_files from manifest at runtime;
  prints manifest version in every run header; no hardcoded list to drift
- `docs.yml`: build step now manifest-driven (node parses manifest, emits copy cmds);
  index.html version from manifest `$VERSION`; date dynamically set; smoke proof
  reads manifest required_files; manifest path added to trigger paths
- Homepage source proven: `site/index.html` is the SOLE landing page, generated
  entirely by the inline heredoc in the build step using `$VERSION` from manifest
- No runtime code changes (atlassian/forge-app/src/** untouched)

---

## v4.3.3 — 2026-02-26 — GitHub Pages: repo-root site build; fail-closed artifact + live verify

### Fixed
- Site built at repo root (`site/`) — removed `working-directory: atlassian/forge-app`
  ambiguity; artifact upload path is now simply `site`
- `verify_pages_site_artifact.sh ./site` called from repo root (no working-dir)
- Live-verify retry: 20 × 30 s (10 min max)
- Trigger paths: `tools/verify_pages_site_artifact.sh` + `tools/verify_pages_live.sh` added
- `_site/site.css` stale artifact removed and excluded from repo

---

## v4.3.2 — 2026-02-26 — GitHub Pages: enterprise pack only + fail-closed artifact policy

- DISABLED: `staticc.yml` upload-pages-artifact + deploy-pages steps (`if: false`)
  — prevents legacy docs overwriting the enterprise pack artifact
- NEW: `tools/verify_pages_site_artifact.sh` — standalone fail-closed script;
  checks required files, forbidden dirs, placeholders (grep -F), email allowlist
- UPDATED: `docs.yml` — replaced inline shape verificaton with script call;
  updated landing page version 4.2.7 → 4.3.2
- MANUAL ACTION: GitHub Pages source must be set to "GitHub Actions" in repo Settings → Pages
- Local gates: all 4 gates ✅  verify_pages_site_artifact.sh ✅

## v4.3.1 — 2026-02-26 — Fix CI cold-install proof: pre-generate build identity files before npm test

- FIXED: `tools/prove_clean_install.sh` — added Step 5a: pre-generates `src/build/backend_build.ts`
  and `src/build/buildIdentityBackend.gen.ts` via `node tools/build_meta.mjs` and
  `node tools/gen_backend_build_identity.mjs` before running `npm test`
- ROOT CAUSE: these files are gitignored and do not exist on a fresh clone; source modules
  import from them; `npm test` (Step 5) failed with "Cannot find module" because
  `build:gadget` (Step 6, which regenerates them) ran after tests
- EFFECT: `npm test` now passes on cold clone; `build:gadget` in Step 6 regenerates files
  identically; CI "Verify repo clean after proof" unaffected (files remain gitignored)
- Local status: npm test ✅ (2852 pass)  prove_clean_install.sh ✅  git status ✅

## v4.3.0 — 2026-02-26 — Complete CI isolation + required email placement enforcement

- UPDATED: `ci-core.yml` — added `!atlassian/forge-app/docs/**` and `!.github/workflows/docs.yml` exclusions
- UPDATED: `evidence-guard.yml` — same exclusions
- UPDATED: `docs.yml` trigger — added `atlassian/forge-app/docs/CHANGELOG.md` to paths
- UPDATED: `enterprise_docs_gate.sh` step 2c — added `example.org` to placeholder patterns
- UPDATED: `email_integrity_gate.mjs` v4.3.0 — fail-closed on missing required docs
  (was silently skipping; now emits MISSING_REQUIRED_DOC error)
- Local gates: md_link_check ✅  truth_claims_gate ✅  email_integrity_gate ✅  enterprise_docs_gate ✅

## v4.2.9 — 2026-02-26 — CI isolation for documentation deploy

- UPDATED: `.github/workflows/docs.yml` trigger: tag-push → branch+paths (docs/**, docs.yml, CHANGELOG.md)
- ADDED: `concurrency: group: pages-deploy, cancel-in-progress: true` to docs.yml
- UPDATED (x6): `enterprise_repo_gates.yml`, `forge-app-repro-proof.yml`, `gates.yml`,
  `placeholders-guard.yml`, `reviewer-gates.yml`, `reviewer_gate_ci.yml` — added app-code path
  filters to push triggers so docs-only changes do not fire runtime CI
- No runtime code changes; no npm dependency changes

## v4.2.8 — 2026-02-26 — Add fail-closed live GitHub Pages verification

- CREATED: `tools/verify_pages_live.sh` — bash script verifying live site post-deploy
  - HTTP 200 check for all 10 required enterprise pack URLs
  - HTTP non-200 check for forbidden paths (/production/, /dist/, /node_modules/)
  - Per-page placeholder scan + email allowlist enforcement on fetched content
  - Deterministic PASS/FAIL summary; exits non-zero on any failure
- UPDATED: `.github/workflows/docs.yml` — added "Verify live GitHub Pages" step after deploy
  - 6 retries × 10s sleep to handle GitHub Pages CDN propagation
  - Fail-closed: fails workflow if all retries exhausted
- No runtime changes; no new npm dependencies
- Local gates: md_link_check ✅  truth_claims_gate ✅  email_integrity_gate ✅  enterprise_docs_gate ✅

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
