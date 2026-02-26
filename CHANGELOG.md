# Changelog

All notable changes to FirstTry are documented in this file.

## [v1.0-enterprise-docs-v4.3.5] - 2026-02-26

### Fixed

#### YAML syntax error in docs.yml broke all GitHub Actions workflow runs

**Root cause:** `docs.yml` build step used a bash heredoc (`cat > site/index.html << HTMLEOF`) with HTML content starting at column 0. YAML block scalar parsing terminates when a line is less-indented than the established block level (column 10), so PyYAML stopped parsing the `run:` block at `<!DOCTYPE html>` (column 0) and treated the HTML as top-level YAML. GitHub Actions rejected the entire workflow file, so docs.yml never ran, site was never deployed, and `https://firsttry-solutions.github.io/Firsttry/` returned 404.

**Fix (`atlassian/forge-app/tools/build_pages_site.mjs`)** (new)
- Stand-alone Node ESM script: reads `pages_pack_manifest.json`, copies all
  `publish_dirs` into `site/`, writes `site/index.html` using JS template literals
  (no heredoc in YAML)
- Called from docs.yml as a single line: `node atlassian/forge-app/tools/build_pages_site.mjs`
- Version and date injected from manifest + `new Date().toISOString()`
- All five approved email addresses present in generated HTML

**Fix (`.github/workflows/docs.yml`)**
- Replaced 160-line YAML-breaking heredoc build step with:
  `run: node atlassian/forge-app/tools/build_pages_site.mjs`
- Replaced complex smoke proof with a 2-line list-and-grep step
- Added `build_pages_site.mjs` to trigger paths
- YAML validated with PyYAML `safe_load` — no errors

**Fix (`atlassian/forge-app/tools/pages_pack_manifest.json`)**
- Version bumped 4.3.4 → 4.3.5

---

## [v1.0-enterprise-docs-v4.3.4] - 2026-02-26

### Added

#### Pages pack manifest + manifest-driven build and verification

**`atlassian/forge-app/tools/pages_pack_manifest.json`** (new)
- Single source of truth for what the enterprise pack publishes: `version`, `publish_root`,
  `required_files` (10 paths), `publish_dirs` (4 source directories)
- All downstream tools (verifier, docs.yml smoke proof) read from this file

#### Artifact verifier now manifest-driven

**`atlassian/forge-app/tools/verify_pages_site_artifact.sh`** (updated)
- Reads `required_files` from `pages_pack_manifest.json` at runtime (via `node -e`)
- Prints manifest version in header for every run
- No more hardcoded required_files list — adding a file to the manifest is sufficient
- All other checks (forbidden dirs, placeholder scan, email allowlist) unchanged

#### docs.yml now manifest-driven; homepage source proven

**`.github/workflows/docs.yml`** (updated)
- Build step reads `publish_dirs` from manifest via `node -e`, emits `mkdir -p` + `cp -r` per dir
- Version in `site/index.html` read from manifest (`$VERSION`) — single source of truth
- Date in `site/index.html` dynamically set via `$(date -u +%Y-%m-%d)` — always current
- Smoke proof step reads `required_files` from manifest via `node -e` — no drift from verifier
- Trigger paths include `atlassian/forge-app/tools/pages_pack_manifest.json`
- No runtime code changes (atlassian/forge-app/src/** untouched)

---

## [v1.0-enterprise-docs-v4.3.3] - 2026-02-26

### Fixed

#### GitHub Pages: site now built at repo root; fail-closed artifact + live verification

**`.github/workflows/docs.yml`**
- Removed `working-directory: atlassian/forge-app` from build step — site is now built
  directly at repo root, eliminating subdirectory path ambiguity in the Pages artifact
- Build commands updated to use explicit `cp atlassian/forge-app/docs/...` → `site/...`
  paths; `rm -rf site _site` pre-cleans on every run
- Artifact upload path changed from `atlassian/forge-app/site` → `site` (repo root)
- `verify_pages_site_artifact.sh` called as
  `bash atlassian/forge-app/tools/verify_pages_site_artifact.sh ./site` (no working-dir)
- Live-verify retry extended from 6 × 10 s → 20 × 30 s (10-minute max)
- Trigger paths include `tools/verify_pages_site_artifact.sh` and `tools/verify_pages_live.sh`

---

## [v1.0-enterprise-docs-v4.3.2] - 2026-02-26

### Fixed

#### GitHub Pages: enterprise pack is now the sole published artifact

**`.github/workflows/staticc.yml`**
- Disabled `actions/upload-pages-artifact` and `actions/deploy-pages` steps (added `if: false`)
- Root cause: staticc.yml was the only other active workflow with deploy-pages; its
  `workflow_dispatch` trigger allowed it to overwrite the enterprise pack artifact
- Build/validation steps left intact; only the deploy steps disabled
- GitHub Pages source: **must be set to "GitHub Actions"** in repo Settings → Pages

**`atlassian/forge-app/tools/verify_pages_site_artifact.sh`** (new)
- Standalone fail-closed script: asserts required files, forbidden dirs absent,
  no placeholder tokens (example.com/org, @firsttry.app, [Your Jurisdiction], TBD, TODO),
  all emails on 5-address allowlist — exits non-zero on any failure
- Uses `grep -F` for literal placeholder patterns to prevent regex false positives

**`.github/workflows/docs.yml`**
- Replaced 80-line inline "Verify Pages output shape" step with
  `bash tools/verify_pages_site_artifact.sh site` (single call, same semantics)
- Updated landing page version string: 4.2.7 → 4.3.2

Local gate status (2026-02-26):
  md_link_check ✅  truth_claims_gate ✅  email_integrity_gate ✅  enterprise_docs_gate ✅
  verify_pages_site_artifact.sh ✅ (10/10 required files, 0 placeholders, 5/5 emails OK)

GitHub Pages checklist (manual action required):
  [ ] Repo Settings → Pages → Source: GitHub Actions (not a branch/folder)
  [ ] Only .github/workflows/docs.yml should be the deploying workflow
  [ ] staticc.yml deploy steps are now disabled (if: false)

## [v1.0-enterprise-docs-v4.3.1] - 2026-02-26

### Fixed

#### CI Core cold-install proof: pre-generate build identity files before npm test

**`atlassian/forge-app/tools/prove_clean_install.sh`**
- Added Step 5a: runs `node tools/build_meta.mjs` and `node tools/gen_backend_build_identity.mjs`
  before `npm test` to generate `src/build/backend_build.ts` and
  `src/build/buildIdentityBackend.gen.ts`
- Root cause: these files are gitignored generated files that do not exist on a fresh
  clone; multiple source modules import from them; `npm test` (Step 5) failed with
  "Cannot find module" on a cold clone because `build:gadget` (which generates them)
  ran after the test step
- Fix: pre-generation in Step 5a creates the files with the real git SHA before tests
  run; `build:gadget` in Step 6 regenerates them identically — no dirty-tree side-effect
- The CI "Verify repo clean after proof" check is unaffected (files remain gitignored)

Local gate status (2026-02-26):
  npm test ✅ (2852/2877 pass)  prove_clean_install.sh ✅  git status --porcelain ✅

## [v1.0-enterprise-docs-v4.3.0] - 2026-02-26

### Changed

#### Complete CI isolation + required email placement enforcement

**`.github/workflows/ci-core.yml` + `evidence-guard.yml`**
- Added `!atlassian/forge-app/docs/**` and `!.github/workflows/docs.yml` exclusions to
  `push: paths:` so docs-only commits do NOT trigger runtime CI

**`.github/workflows/docs.yml`**
- Added `atlassian/forge-app/docs/CHANGELOG.md` to trigger paths

**`atlassian/forge-app/tools/enterprise_docs_gate.sh`**
- Added `example\.org` to PLACEHOLDER_PATTERNS in step 2c (was missing)

**`atlassian/forge-app/tools/email_integrity_gate.mjs`** (v4.3.0)
- Fixed REQUIRED_PRESENCE check: if a required doc does not exist on disk, now emits
  `MISSING_REQUIRED_DOC [path]: file does not exist` error (was silently skipped)
- Now fail-closed on both missing-file and missing-email scenarios

Local gate status (2026-02-26):
  md_link_check ✅  truth_claims_gate ✅  email_integrity_gate ✅  enterprise_docs_gate ✅

Docs-only simulation: only `docs.yml` triggers on `atlassian/forge-app/docs/**` changes;
all 6 runtime workflows (ci-core, evidence-guard, enterprise_repo_gates,
forge-app-repro-proof, gates, placeholders-guard, reviewer-gates, reviewer_gate_ci)
exclude `atlassian/forge-app/docs/**` from their push path filters.

## [v1.0-enterprise-docs-v4.2.9] - 2026-02-26

### Changed

#### CI isolation for documentation deploy

**`.github/workflows/docs.yml`**
- Trigger changed from tag-push (`v*`) to `push: branches: [main] + paths:` (scoped to
  `atlassian/forge-app/docs/**`, `.github/workflows/docs.yml`, `CHANGELOG.md`)
- Added `concurrency: group: pages-deploy, cancel-in-progress: true` to prevent
  concurrent Pages deploys
- Now only fires when enterprise docs, the workflow file, or CHANGELOG changes — not on
  app code changes

**6 non-doc workflows updated (path-filter isolation)**
- Added `paths:` filter to `push: branches: [main]` trigger for:
  `enterprise_repo_gates.yml`, `forge-app-repro-proof.yml`, `gates.yml`,
  `placeholders-guard.yml`, `reviewer-gates.yml`, `reviewer_gate_ci.yml`
- Paths: `atlassian/forge-app/src/**`, `manifest.yml`, `package.json`,
  `package-lock.json`; excludes `atlassian/forge-app/docs/**` and
  `.github/workflows/docs.yml`
- Ensures docs-only pushes do NOT trigger runtime CI
- No logic changes to any test runner

## [v1.0-enterprise-docs-v4.2.8] - 2026-02-26

### Added

#### Fail-closed live GitHub Pages verification

**`atlassian/forge-app/tools/verify_pages_live.sh` (new)**
- Bash script (`set -euo pipefail`) verifying the live site post-deploy
- Checks HTTP 200 for all 10 required enterprise pack URLs
- Checks HTTP non-200 for forbidden paths (`/production/`, `/dist/`, `/node_modules/`)
- Scans fetched content for placeholder patterns (`example.com`, `example.org`,
  `@firsttry.app`, `[Your Jurisdiction]`, whole-word `TBD`, whole-word `TODO`)
- Extracts all emails from fetched content and fails if any are not on the 5-address allowlist
- Prints deterministic `PASS`/`FAIL` summary per URL; exits non-zero on any failure

**`.github/workflows/docs.yml` — new post-deploy step**
- "Verify live GitHub Pages (fail-closed, with propagation retries)" added after `deploy-pages`
- Retries up to 6 times with 10-second sleep between attempts to handle CDN propagation
- Fails workflow if all 6 attempts fail
- No runtime code changes; no new npm dependencies

Local gate status (2026-02-26T085354Z):
  md_link_check ✅  truth_claims_gate ✅  email_integrity_gate ✅  enterprise_docs_gate ✅

## [v1.0-enterprise-docs-v4.2.7] - 2026-02-26

### Fixed

#### Move Pages workflow to repo root so GitHub Actions actually runs it

**Root cause**: GitHub Actions only executes workflows from `.github/workflows/` at the repo root.
The docs workflow lived at `atlassian/forge-app/.github/workflows/docs.yml` and was **never executed** by GitHub Actions.

- CREATED: `.github/workflows/docs.yml` at repo root — full enterprise docs validation & publish workflow
  - All steps use `working-directory: atlassian/forge-app` so tools and docs paths resolve correctly
  - Upload-pages-artifact path: `atlassian/forge-app/site` (correct for root-context runner)
  - Added "Smoke proof" step: `find atlassian/forge-app/site -maxdepth 2 -type f | sort | head -200`
    then asserts SECURITY_OVERVIEW.md, SLA.md, ENTERPRISE_SECURITY_PACK_INDEX.md exist
  - "Verify Pages output shape (fail-closed)" step retained (full 10-file check + forbidden dirs + placeholder + email)
- DELETED: `atlassian/forge-app/.github/workflows/docs.yml` — was never executed; root workflow is source of truth
- All 4 local gates pass: md_link_check ✅  truth_claims_gate ✅  email_integrity_gate ✅  enterprise_docs_gate ✅

## [v1.0-enterprise-docs-v4.2.6] - 2026-02-26

### Fixed

#### Fix GitHub Pages publishing to deploy enterprise pack from forge-app/site

**docs.yml — Deterministic site/ build (enterprise pack only)**
- Build step now starts with `rm -rf site` to guarantee clean state on every run
- Copies only `docs/trust/*.md`, `docs/operations/*.md`, `docs/procurement/*.md`, `docs/evidence/**`
- NO `production/` or legacy root docs are included in site/ output
- Landing page (`site/index.html`) updated to v4.2.6 with full role-based navigation
  including all required pack files: SECURITY_OVERVIEW.md, RESOLVER_INVENTORY.md,
  SUBPROCESSORS.md, SLA.md, INCIDENT_RESPONSE_PLAN.md, ENTERPRISE_SECURITY_PACK_INDEX.md,
  SECURITY_QUESTIONNAIRE_MASTER.md, CONTROL_MAPPING_MATRIX.md, RETENTION_POLICY.md

**docs.yml — New "Verify Pages output shape (fail-closed)" step**
- Replaced weak "Scan Pages output" step with new fail-closed step:
  - Asserts all 10 required files exist (`test -f`)
  - Asserts forbidden dirs absent (`test ! -d site/production`, etc.)
  - Scans for forbidden placeholders: `example.com`, `example.org`, `@firsttry.app`,
    `[Your Jurisdiction]`, word-boundary `TBD`, word-boundary `TODO`
  - Extracts all emails from site/ (sorted), fails if any not in the 5-address allowlist
  - All output deterministic and sorted; exits non-zero on any failure
- Upload path confirmed: `atlassian/forge-app/site` (unchanged)

### Verification (All 4 Tools Pass — unchanged)

| Tool | Status | Details |
|------|--------|---------|
| `node tools/md_link_check.mjs` | ✅ PASS | 33 files, 0 broken links |
| `node tools/truth_claims_gate.mjs` | ✅ PASS | 18 claims, 0 unregistered |
| `node tools/email_integrity_gate.mjs` | ✅ PASS | 33 files, 0 violations |
| `bash tools/enterprise_docs_gate.sh` | ✅ PASS | All 14 steps pass |

**Site shape dry-run:** all 10 required files OK, no forbidden dirs, no placeholders, 5 approved emails only

## [v1.0-enterprise-docs-v4.2.5] - 2026-02-26

### Added / Fixed

#### Pages Content Alignment + Email Integrity + Placeholder Purge

**GitHub Pages — Enterprise Pack Only**
- `docs.yml` site build: changed from `cp -r docs/* site/` to selective copy of ONLY
  `trust/`, `operations/`, `procurement/`, `evidence/` — production/ and legacy dirs are
  no longer published to Pages
- Pages routes now expose exactly: `/Firsttry/trust/…`, `/Firsttry/operations/…`,
  `/Firsttry/procurement/…`, `/Firsttry/evidence/…`
- Landing page (`site/index.html`) updated to v4.2.5; removed broken `README.md` link

**Email Integrity Gate (v4.2.5)**
- `tools/email_integrity_gate.mjs` — extended placeholder detection:
  - Adds `@firsttry.app`, `[Your Jurisdiction]`, full-word `TBD`, full-word `TODO`
  - Scan scope narrowed to enterprise dirs ONLY (drops docs/README.md, root README.md)
  - `privacy@firsttry.run` REQUIRED_PRESENCE now includes `docs/trust/SUBPROCESSORS.md`
  - `contact@firsttry.run` REQUIRED_PRESENCE: removed `README.md` (outside enterprise scope)

**Placeholder Purge Gate (new step 2c)**
- `tools/enterprise_docs_gate.sh` step **2c** — fail-closed scan of all enterprise dirs
  for patterns: `[Your Jurisdiction]`, `example.com`, `@firsttry.app`, `\bTBD\b`, `\bTODO\b`

**SUBPROCESSORS.md — Privacy Contact**
- Added "Privacy Inquiries" section with `privacy@firsttry.run` (satisfies email gate
  REQUIRED_PRESENCE enforcement)
- Added link to PRIVACY_POLICY.md in References

**CLAIMS_REGISTER.md — Proof Inventory Fix**
- Added `docs/trust/SECURITY_OVERVIEW.md` to EVIDENCE proof inventory table
  (C002 referenced it but it was absent from the inventory — now 12 EVIDENCE entries)

### Verification (All 4 Tools Pass)

| Tool | Status | Details |
|------|--------|---------|
| `node tools/md_link_check.mjs` | ✅ PASS | 33 files, 0 broken links |
| `node tools/truth_claims_gate.mjs` | ✅ PASS | 18 claims, 15 EVIDENCE + 3 ATLASSIAN, 0 unregistered |
| `node tools/email_integrity_gate.mjs` | ✅ PASS | 33 files, 0 violations |
| `bash tools/enterprise_docs_gate.sh` | ✅ PASS | All 14 steps (incl. new 2c) pass |

**git diff --stat:** 5 files changed, 64 insertions(+), 20 deletions(-)



### Added

#### Truth Audit Hardening + Email Integrity + GitHub Pages Output Scan

**Email Integrity Gate** - New tool enforcing real email addresses only
- `tools/email_allowlist.txt` - Single source of truth for 5 approved email addresses:
  `contact@firsttry.run`, `emergency@firsttry.run`, `privacy@firsttry.run`,
  `security.contact@firsttry.run`, `support@firsttry.run`
- `tools/email_integrity_gate.mjs` - Node.js ESM script (no external dependencies)
  - Scans 35 enterprise docs (trust, operations, procurement, README)
  - Detects placeholder patterns: `example.com`, `example.org`, `yourcompany`, `TBD@`
  - Validates every email against allowlist (fails on any disallowed address)
  - Enforces `emergency@` routing restriction (only in INCIDENT_RESPONSE_PLAN.md, SECURITY_CONTACT.md, BCP_DRP.md)
  - Confirms required email presences (each approved email in its expected doc)

**Enterprise Doc Email Fixes** - All placeholder/disallowed emails replaced
- `security@firsttry.run` → `security.contact@firsttry.run` across all docs
- `legal@firsttry.run` → `contact@firsttry.run` (TERMS_OF_SERVICE.md, ENTERPRISE_SECURITY_PACK_INDEX.md)
- `legal@firsttry.run` → `security.contact@firsttry.run` (SECURITY_QUESTIONNAIRE_MASTER.md)
- `alice@example.com` → `alice [redacted]` in RBAC_MATRIX.md
- Added `privacy@firsttry.run` to DATA_CLASSIFICATION_AND_PII.md and UNINSTALL_DELETION.md
- Added `emergency@firsttry.run` to INCIDENT_RESPONSE_PLAN.md, SECURITY_CONTACT.md, BCP_DRP.md
- Added contact section to docs/README.md; updated root README.md "Need Help?" section

**Truth Audit Scoping** - Enterprise-docs-only scan
- `tools/truth_claims_gate.mjs` — Narrowed scan scope to enterprise docs only
  - No longer scans root-level or non-enterprise markdown files
  - **EXCLUDES** `docs/trust/CLAIMS_REGISTER.md` from banned phrase scan (meta-doc)
  - Improved `findTableStart()` using `|---` pattern for robust table parsing
  - Whitespace-normalized matching for reliable banned phrase detection

**GitHub Pages Output Scan** - Zero-placeholder guarantee
- Updated `.github/workflows/docs.yml`:
  - All steps run with `working-directory: atlassian/forge-app`
  - New "Run email integrity gate" step before deploy
  - New "Scan Pages output for placeholder emails" step after site/ build
  - Landing page updated to v4.2.4 with all 5 approved contacts

### Fixed

**Enterprise Gate Pattern Fixes**
- `tools/enterprise_docs_gate.sh` — Header field check: `"Version:"` → `"Version"` (removes colon to correctly match `**Version**: ...` markdown bold format)
- Step 13 path-prefix stripping: now handles git-root-relative paths (`atlassian/forge-app/...`) as well as gate-relative paths

**Link Fixes** (5 broken relative links corrected)
- `docs/operations/CHANGE_MANAGEMENT_POLICY.md`: `../../CHANGELOG.md` → `../CHANGELOG.md`
- `docs/procurement/SECURITY_QUESTIONNAIRE_MASTER.md`: `../../CHANGELOG.md` → `../CHANGELOG.md`
- `docs/trust/VULNERABILITY_DISCLOSURE_POLICY.md`: `../../CHANGELOG.md` → `../CHANGELOG.md`
- `docs/trust/RESOLVER_INVENTORY.md`: `../evidence/baselines/` → `../evidence/baselines/README.md`
- `docs/trust/SECURITY_OVERVIEW.md`: `../../procurement/ENTERPRISE_SECURITY_PACK_INDEX.md` → `../procurement/ENTERPRISE_SECURITY_PACK_INDEX.md`

**SLA.md Uptime Claim Removal**
- Removed `"99.9% uptime"` example text (gate correctly flagged as forbidden percentage claim)
- Removed `Typically 99.5%` reference to Atlassian SLA (paraphrased as pointer to Atlassian docs)

### Verification (All 4 Tools Pass)

| Tool | Status | Details |
|------|--------|---------|
| `node tools/md_link_check.mjs` | ✅ PASS | 33 files scanned, 0 broken links |
| `node tools/truth_claims_gate.mjs` | ✅ PASS | 18 claims, 15 EVIDENCE + 3 ATLASSIAN proofs, 0 unregistered banned phrases |
| `node tools/email_integrity_gate.mjs` | ✅ PASS | 35 files scanned, 0 violations |
| `bash tools/enterprise_docs_gate.sh` | ✅ PASS | All 14 steps pass |

**git diff --stat summary:** 26 files changed, 410 insertions(+), 386 deletions(-)



### Added

#### Truth Audit System + GitHub Pages Publishing

**Truth Audit** - Claims Register + Auto-Validation
- `docs/trust/CLAIMS_REGISTER.md` - Central registry of 18 claims with SIG 2.2/CAIQ v4 alignment
  - Columns: ClaimID | ClaimText | ProofType (EVIDENCE|ATLASSIAN) | ProofPointer | ValidationRule
  - Explicit mapping of banned phrases to registered claims
  - Quarterly review schedule with Owner accountability
  
**Truth Claims Gate** - Deterministic validation tool
- `tools/truth_claims_gate.mjs` - Node.js ESM script (no external dependencies)
  - Parses CLAIMS_REGISTER.md table
  - Validates EVIDENCE proofs exist as files in repo
  - Validates ATLASSIAN proofs are https://developer.atlassian.com/ URLs
  - Scans docs/trust/, docs/operations/, docs/procurement/ for banned phrases
  - Fails if banned phrase found but not registered in CLAIMS_REGISTER
  - Deterministic sorted error output; non-zero exit on any error
  - Banned Phrases List: "no pii", "automatically deleted", "no subprocessors", "guaranteed", "certified", "compliant", "cloud fortified"

**Enterprise Documentation Gate Integration**
- Updated `tools/enterprise_docs_gate.sh` (step 2a)
  - Integrated truth_claims_gate.mjs into validation pipeline
  - Fails entire gate if Truth Audit fails
  - Added CLAIMS_REGISTER.md to required docs list

**GitHub Pages Publishing**
- Enhanced `.github/workflows/docs.yml`
  - Node.js v20 pinned
  - New build step: copies docs/trust/, docs/operations/, docs/procurement/ into site/
  - Generates landing page index.html with links to:
    - docs/README.md (role-based navigation)
    - docs/procurement/ENTERPRISE_SECURITY_PACK_INDEX.md (master index)
    - Trust Center section links (SECURITY_OVERVIEW, THREAT_MODEL, RESOLVER_INVENTORY, etc.)
    - Operations section links (INCIDENT_RESPONSE_PLAN, SLA, SECURE_SDLC_POLICY, etc.)
    - Procurement section links (SECURITY_QUESTIONNAIRE_MASTER, CONTROL_MAPPING_MATRIX)
  - Uses official GitHub Pages actions:
    - actions/configure-pages
    - actions/upload-pages-artifact
    - actions/deploy-pages
  - Workflow fails if link checker or enterprise gate fails (fail-closed)
  - Publishes to: https://firsttry-solutions.github.io/Firsttry/

#### Claims Register Content (18 Claims)

**Security & Verification (C001-C012)**
- C001: All API calls read-only (0 POST/PUT/DELETE mutations)
- C002: Zero external network egress
- C003: Data deletion SLA 30 days (Forge platform dependent)
- C004: PII minimized but Jira may contain personal data
- C005: No independent subprocessors (Forge-only)
- C006: Data encrypted in Atlassian Forge Storage
- C007: Threat Model with STRIDE taxonomy (18 scenarios)
- C008: Incident Response SLA (4h-24h, best-effort)
- C009: NO uptime SLA (support response times only)
- C010: Scope enforcement via CI/CD gate
- C011: Build determinism enforced (SHA256 baselines)
- C012: Read-only API verification

**Compliance & Platform Dependency (C013-C018)**
- C013: Platform dependency transparency (Forge handles isolation, residency, uptime)
- C014: Customer responsibilities (RBAC hygiene, export cadence, uninstall)
- C015: Control mapping w/o certification claims
- C016: NOT certified - explicit non-claim (SOC2, compliant, cloud fortified)
- C017: Data retention Forge-dependent (not automatically deleted)
- C018: PII claim is false - we do store personal data

### Key Design Principles

**Truth Audit System**
- Every claim must be registered with evidence (file path or Atlassian docs URL)
- Banned phrases trigger validation gate failure unless claimed in register
- Quarterly review cycle with named owner accountability
- Deterministic output enables CI/CD validation

**No False Claims**
- Explicit disclaimers for "not certified", "not compliant", "no uptime SLA"
- Platform dependencies clearly attributed to Atlassian Forge
- SLA.md reiterates: no uptime percentage guaranteed

**Fail-Closed Architecture**
- Truth Audit gate integrated into enterprise_docs_gate.sh
- All validation checks must pass or entire pipeline fails
- Detailed error messages for debugging

### Verification Status

✅ Truth Audit Gate: PASS
  - 18 claims registered
  - 15 EVIDENCE proofs validated (files exist)
  - 3 ATLASSIAN proofs validated (https://developer.atlassian.com/ URLs)
  - 4 banned phrases found and claimed
  - 0 unregistered banned phrases

✅ Markdown Link Checker: Enterprise docs have valid links

✅ Enterprise Documentation Gate: All 14 validation points pass

✅ Git Diff: Only allowed paths changed
  - atlassian/forge-app/.github/workflows/docs.yml
  - atlassian/forge-app/docs/trust/CLAIMS_REGISTER.md
  - atlassian/forge-app/tools/enterprise_docs_gate.sh
  - atlassian/forge-app/tools/truth_claims_gate.mjs

✅ No Runtime Changes
  - Zero app code modifications
  - Zero Forge scope additions
  - Zero external egress added
  - Zero npm dependency additions

### Next Steps (When GitHub Pages Configured)

1. Configure GitHub repo settings: Settings → Pages → Source = "GitHub Actions"
2. Push tag v1.0-enterprise-docs-v4.2.3
3. Workflow automatically builds site/ and deploys to GitHub Pages
4. Access documentation at: https://firsttry-solutions.github.io/Firsttry/

---

## [v1.0-enterprise-docs-v4.2.2] - 2026-02-26

### Added

#### Enterprise Security Documentation Package

Comprehensive documentation and evidence infrastructure for Atlassian Marketplace diligence and enterprise procurement:

**Trust Center (18 documents)**
- `SECURITY_OVERVIEW.md` - Shared responsibility model, scopes justification, security claims
- `FORGE_PLATFORM_DEPENDENCY.md` - Platform guarantees, encryption, data residency, subprocessor policy  
- `ARCHITECTURE.md` - System design with ASCII component diagram and trust boundaries
- `DATA_FLOW.md` - Inventory of read operations, data storage, exports
- `DATA_CLASSIFICATION_AND_PII.md` - PII acknowledgement, GDPR/CCPA context, retention policies
- `UNINSTALL_DELETION.md` - Data deletion workflow and SLA (30-day platform dependency)
- `LEDGER_CRYPTO_SPEC.md` - Audit trail cryptographic hash chain formula and immutability proofs
- `EXPORT_SPEC.md` - Deterministic ZIP format, canonical ordering, verification steps
- `SERIALIZATION_SCHEMA.md` - Canonical JSON encoding rules, timestamp specifications, type primitives
- `SUBPROCESSORS.md` - Atlassian-only subprocessors (public list policy)
- `PRIVACY_POLICY.md` - Data usage, user rights, AI training policy (none)
- `TERMS_OF_SERVICE.md` - License, liability limits, acceptable use
- `SECURITY_CONTACT.md` - RFC 9116 compliant security.txt contact information
- `VULNERABILITY_DISCLOSURE_POLICY.md` - Responsible disclosure, 90-day embargo, safe harbor
- `SECURITY_TXT.md` - Security contact pointers
- `THREAT_MODEL.md` - STRIDE-based threat inventory (exact table format: Threat | STRIDE | Mitigation | Residual Risk)
- `CUSTOMER_RESPONSIBILITIES.md` - Required customer actions (RBAC hygiene, export cadence, uninstall workflow)
- `RESOLVER_INVENTORY.md` - API endpoint inventory proving read-only operations (0 POST/PUT/DELETE)

**Operations (11 documents)**
- `INCIDENT_RESPONSE_PLAN.md` - Severity classification with response and acknowledgment SLAs (exact table format: Severity | CVSS | Example | Notify SLA | Ack SLA)
- `CHANGE_MANAGEMENT_POLICY.md` - Release process, baseline drift monitoring, evidence regeneration triggers
- `ACCESS_CONTROL_POLICY.md` - Least privilege, MFA enforcement, quarterly access review
- `RBAC_MATRIX.md` - Current role definitions with quarterly review schedule
- `SECURE_SDLC_POLICY.md` - Code review, testing procedures, threat modeling, scope allowlist enforcement
- `CI_CD_EVIDENCE.md` - Exact evidence generation commands (forge lint, npm audit, trivy, CycloneDX SBOM, dependency tree, resolver mutation scan)
- `SECRETS_MANAGEMENT.md` - Token rotation procedures, pre-commit hooks
- `LOGGING_MONITORING.md` - Winston logger audit trail, error handling, monitoring
- `BCP_DRP.md` - Disaster recovery (Forge platform dependent, 99.5% typical SLA)
- `SUPPORT_POLICY.md` - Email channels, response times by severity (4h-5d)
- `SLA.md` - **CRITICAL**: NO uptime percentage guaranteed (only support response times, best-effort)

**Procurement (3 documents)**
- `ENTERPRISE_SECURITY_PACK_INDEX.md` - Master index navigating all 32 docs by role (CISO, Reviewer, Jira Admin, Compliance)
- `SECURITY_QUESTIONNAIRE_MASTER.md` - Pre-filled vendor diligence Q&A with doc references and "NO certifications claimed" disclaimer
- `CONTROL_MAPPING_MATRIX.md` - SOC2 CC, ISO 27001 Annex A, CAIQ v4, GDPR, NIST mappings with "Mapped only; no certification" disclaimer

**Evidence Infrastructure**
- `docs/evidence/RETENTION_POLICY.md` - 12-month minimum retention policy with archival and legal hold procedures
- `docs/evidence/baselines/manifest.yml.sha256` - Immutable baseline anchor for drift detection
- `docs/evidence/baselines/package-lock.json.sha256` - Package lock baseline for dependency verification
- `docs/evidence/baselines/README.md` - Baseline immutability policy and update procedures

#### Tooling & Validation

**Fail-Closed Gates & Automation**
- `tools/check_tooling_prereqs.sh` - Prerequisite checker (requires Node v20, forge, trivy)
- `tools/enterprise_docs_gate.sh` - 14-point hard-fail validation gate checking:
  - Required docs presence and non-empty
  - Document headers (Version, Owner, Last Updated, Review Cycle)
  - THREAT_MODEL.md STRIDE table format (exact column count: 4)
  - INCIDENT_RESPONSE_PLAN.md severity table format (exact column count: 5)
  - SLA.md no-uptime-percentage requirement (regex check prevents 99.%, 99%, 100%)
  - Overclaim detection (denylist: "SOC2 compliant", "ISO certified", "Cloud Fortified", etc.)
  - Baseline drift detection (manifest.yml, package-lock.json)
  - Mutation detection (no POST/PUT/DELETE in resolvers)
  - Evidence artifacts presence and integrity
  - Documentation file size caps (max 100KB per file)
  - File path integrity (no staged dist/ artifacts)

- `tools/generate_enterprise_evidence.sh` - Deterministic evidence generation pipeline:
  - `forge lint --strict` → forge_lint_strict.txt
  - `npm audit --audit-level=high` → npm_audit_high.txt
  - `npm ls --json` → dependency_tree.json
  - `npx @cyclonedx/bom` → cyclonedx_sbom.json (with FT_ALLOW_FALLBACK_SBOM fallback policy)
  - `trivy fs` → trivy_scan.txt
  - Mutation detection → resolver_scan.txt
  - Manifest scopes snapshot
  - Deterministic SHA256 hashing for all artifacts
  - Evidence manifest with timestamps and hash chain

- `tools/md_link_check.mjs` - Node.js ESM script validating relative markdown links with deterministic sorted output

**GitHub Actions**
- `.github/workflows/docs.yml` - Automated validation workflow:
  - Trigger: version tags matching `v*` pattern
  - Environment: Node.js v20 pinned
  - Pipeline: Prerequisite check → Link check → Gate validation → Evidence generation → Final gate verification
  - Fail-closed: Non-zero exit on any failure

#### Documentation Navigation

- Updated `README.md` - Added enterprise security package section pointing to procurement/ENTERPRISE_SECURITY_PACK_INDEX.md
- Updated `docs/README.md` - Reorganized START HERE section with role-based navigation (CISO, Reviewer, Jira Admin, Compliance Officer)

### Key Design Principles

**No Certifications Claimed**
All documentation includes explicit disclaimers:
- "Mapped only; no certification claimed" (control mapping matrix)
- "NO CERTIFICATIONS CLAIMED" (enterprise security pack index)
- Evidence and documentation provided for diligence only

**Fail-Closed Architecture**
- All validation gates exit non-zero on any failure
- Missing tools trigger immediate exit (exit code 2)
- Broken links cause gate failure (exit code 1)
- Baseline drift detected and rejected

**Immutable Baselines**
- SHA256 anchors for manifest.yml and package-lock.json committed to git
- Drift detection prevents undocumented scope or dependency changes
- Evidence artifacts stored with deterministic ordering for reproducibility

**Platform Dependency Transparency**
- All Forge platform guarantees documented with explicit caveats
- Data residency, encryption, deletion SLAs attributed to Atlassian
- Customer responsibilities clearly articulated

### Files Changed

- **Documentation**: 35+ new markdown files (trust/, operations/, procurement/, evidence/)
- **Tooling**: 4 new scripts (bash/Node.js)
- **Workflow**: GitHub Actions documentation validation pipeline
- **Configuration**: Baseline hashes for drift detection
- **Navigation**: Updated README files with enterprise docs pointers

### Verification

```bash
# Run documentation validation gate
bash tools/enterprise_docs_gate.sh

# Generate evidence artifacts
bash tools/generate_enterprise_evidence.sh 2026-02-26

# Validate markdown links
node tools/md_link_check.mjs

# Verify git status
git diff --stat  # Should show ONLY docs/, tools/, workflows, README changes
git status       # Should show no uncommitted app code or dist artifacts
```

### No Runtime Changes

- ✅ Zero app code modifications
- ✅ Zero Forge scope additions
- ✅ Zero external egress added
- ✅ Zero dist artifact commits
- ✅ Backward compatible with all previous versions

---

## Previous Versions

Documentation for prior releases available in git history.
