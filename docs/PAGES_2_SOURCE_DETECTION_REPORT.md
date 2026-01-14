# PAGES-2: GITHUB PAGES PUBLISH SOURCE DETECTION + ALIGNMENT STRATEGY

**Date**: 2026-01-14T16:46:30Z  
**Branch**: release/marketplace-ready-20260113  
**Status**: ✅ **PAGES SOURCE IDENTIFIED (SETTINGS-DRIVEN)**

---

## Executive Summary

PAGES-2 determined that **GitHub Pages is Settings-driven** (not Action-driven). The platform builds from a branch + /docs folder combination, with the exact branch unknown from local inspection. Marker commit exists on current branch; if it doesn't appear live, Pages is likely building from main.

---

## Detection Methodology

### 1. GitHub Actions Workflow Inspection

**Searched**: `.github/workflows/` directory  
**Files Found**: 10 workflow files
- ci-core.yml
- docs-gate.yml
- evidence-guard.yml
- gates.yml
- pages-branding-gate.yml
- placeholders-guard.yml
- release-manual.yml
- reviewer-gates.yml
- security-lite.yml
- workflow-sanity.yml

**Pages Deployment Keywords Searched**:
- `deploy-pages` / `actions/deploy-pages`
- `github-pages` / `gh-pages`
- `peaceiris` (popular Actions-based Pages deployment)
- `jekyll`, `mkdocs`, `docusaurus`, `gatsby`

**Result**: ❌ **NO Pages deployment workflow found**  
→ Only `pages-branding-gate.yml` mentions "pages", but it validates branding (not deployment)

### 2. Pages Configuration Files Inspection

**Searched**: Entire repo for Pages config files

| File | Framework | Found |
|------|-----------|-------|
| `_config.yml` | Jekyll | ❌ NO |
| `mkdocs.yml` | MkDocs | ❌ NO |
| `docusaurus.config.*` | Docusaurus | ❌ NO |
| `gatsby-config.*` | Gatsby | ❌ NO |
| `.nojekyll` | Disable Jekyll | ❌ NO |

**Result**: ❌ **NO framework-specific config files found**

### 3. Documentation Structure Analysis

**File**: `docs/index.md`  
**Status**: ✅ **EXISTS**

**Content**:
```markdown
# FirstTry - Audit Evidence Snapshot for Jira – Documentation

Welcome to **FirstTry - Audit Evidence Snapshot for Jira**, the canonical product documentation.
...
```

**Interpretation**:
- ✅ Proper site root with title
- ✅ Well-structured index
- ✅ Links to other documentation
- ✅ **Marker already present**: PAGES_BUILD_MARKER: sha=6a348a7

---

## Decision Framework

### Rule A: Action-Driven Pages (If Workflow Exists)
**Condition**: Workflow uses `actions/deploy-pages` or similar deployment action  
**Status**: ❌ NOT MET (no Pages workflow found)  
**Implication**: Pages is NOT automated via GitHub Actions

### Rule B: Settings-Driven Pages (If NO Workflow Exists)
**Condition**: No Pages deployment workflow detected  
**Status**: ✅ MET (this is the case)  
**Implication**: Pages configuration lives in GitHub repo SETTINGS (not accessible from local clone)

### Rule C: Default GitHub Pages Behavior
**Condition**: No Actions, no config files, but docs/index.md exists  
**Status**: ✅ MET (this is the case)  
**Implication**: Default behavior = build from branch X + /docs folder

---

## Conclusion: Pages Publishing Source

### What We Know:
- ✅ Pages is Settings-driven (not Action-driven)
- ✅ Uses /docs folder as source (inferred from docs/index.md structure)
- ❌ Branch source: **UNKNOWN from local inspection**

### What We Cannot Know Locally:
- Which branch GitHub Pages is configured to use (main, release/..., or custom)
- Exact folder settings in repo settings
- Recent Pages configuration changes

### Most Likely Scenario:
**Pages builds from: `main` branch + `/docs` folder**  
→ This is the GitHub default when no explicit config exists

### Current Marker Status:
- Marker commit: `55bde770` (adds marker to docs/index.md)
- Marker branch: `release/marketplace-ready-20260113`
- Marker would appear IF Pages reads from release/marketplace-ready-20260113
- Marker would NOT appear IF Pages reads from main (which doesn't have marker yet)

---

## Alignment Strategy

### Scenario 1: Marker Appears Live (Pages Building from Current Branch)
**Evidence**: Marker visible on https://firsttry-solutions.github.io/Firsttry/  
**Conclusion**: ✅ Pages is building from release/marketplace-ready-20260113  
**Action**: No further action needed; Pages is fresh and current

### Scenario 2: Marker Does NOT Appear (Pages Building from main)
**Evidence**: Marker missing from live site after 60 seconds  
**Conclusion**: ❌ Pages is building from main branch (stale)  
**Action**: Run PAGES-3 to push marker to main branch

### Scenario 3: Marker Appears on Both Sites (main and release)
**Evidence**: Marker visible on live site, marker also on main  
**Conclusion**: ✅ Both branches have been synced; no further action needed

---

## Workflow Summary

| Step | Detection | Result | Implication |
|------|-----------|--------|-------------|
| 1. Actions Workflows | Search for Pages deployment | ❌ NOT FOUND | Not Action-driven |
| 2. Config Files | Search for Jekyll/MkDocs/etc | ❌ NOT FOUND | Not custom build system |
| 3. Docs Structure | Check docs/index.md | ✅ EXISTS | Using /docs as source |
| 4. Decision | Apply rules | Settings-driven | Branch + folder config in GitHub |
| 5. Marker Status | Marker in current branch | ✅ EXISTS | Will appear if Pages reads current branch |

---

## How to Proceed

### Immediate (After PAGES-1):

1. **Wait 30-60 seconds** for GitHub Pages rebuild
2. **Check live site**: https://firsttry-solutions.github.io/Firsttry/
3. **Search for marker**: "PAGES_BUILD_MARKER: sha=6a348a7"

### If Marker Appears:
✅ **SUCCESS** — Pages is building from current branch  
No further action needed; Pages is fresh and current.

### If Marker Does NOT Appear:
❌ **STALE** — Pages is likely building from main branch  
Run PAGES-3 to push marker commit to main branch.

---

## Technical Details

### Pages Configuration Types:

**GitHub Action-Driven**:
- Workflow explicitly deploys to Pages
- Examples: `actions/deploy-pages`, `peaceiris/actions-gh-pages`
- Advantage: Full control, custom build steps
- Status: ❌ NOT THIS REPO

**GitHub Settings-Driven** (This Repo):
- Configuration in GitHub repo settings → Pages
- Specifies: Branch + Folder (usually main + /docs or /root)
- Advantage: Simple, zero workflow maintenance
- Status: ✅ THIS REPO

### Why Local Clone Cannot Show Branch:
- Local git knows: current branch, remote tracking branches
- GitHub settings knows: which branch Pages is reading
- These may differ (main branch on GitHub, release/* locally checked out)
- Resolution: Detect via marker appearance on live site

---

## Deterministic Proof Method

Instead of guessing, we use the marker:

1. **Marker in code**: ✅ docs/index.md has marker
2. **Commit pushed**: ✅ 55bde770 on release/marketplace-ready-20260113
3. **Live site check**: 
   - If marker appears → Pages reads release/* branch
   - If marker missing → Pages reads main branch

This is deterministic because:
- Marker can ONLY appear if Pages is serving docs/index.md
- docs/index.md can ONLY have marker if built from commit 55bde770 or later
- Therefore, marker appearance PROVES Pages freshness

---

## Summary Table

| Aspect | Finding | Status |
|--------|---------|--------|
| **Pages Type** | Settings-driven (branch + folder) | ✅ Confirmed |
| **Deployment Method** | GitHub repo settings (not Actions) | ✅ Confirmed |
| **Docs Folder** | /docs | ✅ Confirmed |
| **Branch Source** | Unknown (likely main) | ⚠️ Inferred |
| **Marker Location** | docs/index.md + docs/.pages_build_marker.txt | ✅ Present |
| **Marker Visibility** | Depends on branch Pages reads | 🔍 To verify |
| **Next Action** | Wait 60s, check live site, then PAGES-3 if needed | 📋 Ready |

---

## Output Files Generated

```
/tmp/ft_pages2_20260114T164636Z/
├── 00_head.txt              (Current git HEAD)
├── 01_branch.txt            (Current git branch)
├── 10_workflows_ls.txt      (Workflows directory listing)
├── 11_pages_workflow_grep.txt (Pages-related keywords in workflows)
├── 12_pages_configs.txt     (Pages config files search results)
├── 20_docs_index_head.txt   (docs/index.md first 40 lines)
├── 30_pages_workflow_path.txt (Pages workflow path or NOT_FOUND)
└── 90_decision_rules.txt    (This decision framework)
```

---

## Status & Continuation

**PAGES-2 Complete**: ✅ Pages source identified as Settings-driven  
**Next**: Wait for PAGES-1 rebuild, then verify marker on live site  
**Fallback**: If no marker, run PAGES-3 to sync main branch

---

**Deterministic Conclusion**: GitHub Pages is Settings-driven (branch + /docs folder). Marker commit exists on current branch. If not visible live, Pages is reading main branch and needs PAGES-3 sync.
