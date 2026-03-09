# Pages Pipeline Inventory & Unification Plan

**Generated**: 2026-03-09T05:30Z

## Current Pipeline State

> **ISSUE**: Two competing deployment paths detected. This document describes the current state and planned unification.

### Workflow Matrix

| Workflow | Location | Trigger | Source | Deploy Step | Status |
|----------|----------|---------|--------|-------------|--------|
| **docs.yml** | `.github/workflows/docs.yml` | `workflow_dispatch` only | `site/` (built by build_pages_site.mjs) | ❌ NO | Validation + build, NO deploy |
| **deploy-pages.yml** | `.github/workflows/deploy-pages.yml` | `push` to main + `docs/**` | `docs/` (static directory) | ✅ YES | Deploys from docs/ |
| **docs-gate.yml** | `.github/workflows/docs-gate.yml` | `workflow_dispatch` only | N/A | ❌ NO | Validation only |
| **pages-branding-gate.yml** | `.github/workflows/pages-branding-gate.yml` | ? | N/A | ❌ NO | Validation only |

### Current Build Paths

**Path 1 (docs.yml - Manual dispatch)**:
```
source: docs/* + atlassian/forge-app/docs/{trust,operations,ops,procurement,evidence}
build: build_pages_site.mjs → build_trust_portal.mjs
output: site/
deploy: ❌ NONE
```

**Path 2 (deploy-pages.yml - Auto on push)**:
```
source: docs/
build: ❌ NONE (static)
output: docs/
deploy: ✅ GitHub Pages (via deploy-pages action)
current: ACTIVE
```

### Critical Findings

1. **Fragmentation**: Two separate deployment paths exist
   - docs.yml builds comprehensive site/ but doesn't deploy
   - deploy-pages.yml deploys outdated docs/ directory automatically
   
2. **Live State**: Currently ACTIVE is deploy-pages.yml (auto on push)
   - Pages root is live at https://firsttry-solutions.github.io/Firsttry/ ✅
   - Many doc routes return 404 (docs/ is outdated, site/ never deployed)

3. **Source of Truth**: pages_pack_manifest.json defines canonical routes
   - Expected output: `site/` directory with .html artifacts
   - Verification: verify_pages_live.sh checks 16 required routes

4. **Build Configuration**:
   - pages_pack_manifest.json: version 4.4.2, defines required_files
   - build_pages_site.mjs: delegates to build_trust_portal.mjs
   - Trigger sources: `atlassian/forge-app/docs/{trust,ops,operations,procurement}` + `docs/`

## Unification Plan (7 Phases)

### PHASE 2: Make docs.yml Authoritative

**Action**: 
1. Modify `.github/workflows/docs.yml` to add `push` trigger
2. Add deploy step (deploy-pages action) to docs.yml
3. Rename `deploy-pages.yml` → `deploy-pages.yml.disabled`

**Result**: Single authoritative deployment path (docs.yml)

### PHASE 3: Canonical Route References

**Source of Truth**: pages_pack_manifest.json `required_files` list
- Routes must resolve to `.html` files in site/
- No underscore paths or no-extension variants
- Example: `/trust/privacy-policy.html` ✅, not `/trust/privacy_policy` ❌

### PHASE 4: Trigger Sources

docs.yml will trigger on ANY change to:
- `docs/**`
- `atlassian/forge-app/docs/{trust,operations,ops,procurement,evidence}/**`
- `atlassian/forge-app/tools/build_pages_site.mjs`
- `atlassian/forge-app/tools/build_trust_portal.mjs`
- `atlassian/forge-app/tools/pages_pack_manifest.json`
- `.github/workflows/docs.yml`

### PHASE 5: Live Route Verification

Script: `audit_artifacts/pages_live_verify_*/`

Canonical routes under test:
- `/` (root)
- `/trust/privacy-policy.html`
- `/trust/subprocessors.html`
- `/trust/security-overview.html`
- `/operations/sla.html`
- `/operations/incident-response-plan.html`
- `/procurement/enterprise-pack-index.html`
- `/procurement/security-questionnaire.html`
- (others from pages_pack_manifest.json required_files)

### PHASE 6: Closeout Harness Update

Remove old expectations (HTTP 404 paths), use canonical routes only.

### PHASE 7: End-to-End Verification

Run docs.yml build logic, verify live routes, produce final report.

---

## Files Affected

| Phase | File | Change |
|-------|------|--------|
| 2 | `.github/workflows/docs.yml` | Add push trigger + deploy step |
| 2 | `.github/workflows/deploy-pages.yml` | Disable (rename .disabled) |
| 4 | `.github/workflows/docs.yml` | Expand path triggers |
| 5 | `atlassian/forge-app/tools/verify_pages_live.sh` | (Already correct) |
| 6 | `tools/submission_closeout/run_closeout.sh` | Update route checks |

---

## Rollback Plan

If unification fails:
1. Restore `deploy-pages.yml.disabled` → `deploy-pages.yml`
2. Revert docs.yml to `workflow_dispatch` only
3. Restore original path triggers
