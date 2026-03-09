# Pages System - Authoritative Inventory

**Document Version**: 1.0  
**Last Updated**: 2026-03-09  
**Status**: System Design Reference

## Authoritative System Definition

### Manifest (Source of Truth)
- **File**: `atlassian/forge-app/tools/pages_pack_manifest.json`
- **Version**: 4.4.2
- **Purpose**: Defines all pages intended for public publication
- **Structure**: `portal_nav` array containing 6 groups with 46 total items
- **Validation**: Each item must have title, src (markdown file), route (canonical URL), doc_id

### Build Process
- **Primary Entry**: `atlassian/forge-app/tools/build_pages_site.mjs` (wrapper)
- **Actual Builder**: `atlassian/forge-app/tools/build_trust_portal.mjs` (F100 Trust Portal Builder)
- **Input**: pages_pack_manifest.json + markdown source files
- **Process**: Parse manifest → validate source files → render markdown to HTML → generate portal assets
- **Output Directory**: `site/` (repo root)
- **Output Structure**:
  ```
  site/
  ├── index.html                    (portal landing page)
  ├── trust/                        (Trust Center pages)
  ├── operations/                   (Operations pages)
  ├── ops/                          (Operator runbooks)
  ├── procurement/                  (Procurement pages)
  ├── evidence/                     (Evidence pages)
  ├── assets/
  │   ├── portal.css
  │   ├── portal.js
  │   └── search_index.json
  └── raw/                          (transparency: markdown copies)
  ```

### Deployment (Authoritative Workflow)
- **Workflow File**: `.github/workflows/docs.yml`
- **Status**: ACTIVE (only authoritative Pages deploy workflow)
- **Triggers**: 
  - Push to `main` affecting: docs.yml (itself), manifest, build scripts, docs/**
  - Manual trigger: `workflow_dispatch`
- **Deploy Concurrency**: Enforced via `pages-deploy` concurrency group (no parallel deployments)
- **Post-Deploy Verification**: 10-minute retry loop (20 retries × 30s) to verify Pages propagation
- **Validation Gates** (fail-closed):
  1. Markdown link verification
  2. Truth audit (claims register validation)
  3. Email integrity (contact@firsttry.run)
  4. Enterprise documentation completeness

### Disabled Workflow (Reference Only)
- **Workflow File**: `.github/workflows/deploy-pages.yml`
- **Status**: DISABLED (manual-only, explicitly marked as archived)
- **Note**: All Pages deployments must flow through `docs.yml`

### Live Portal
- **Base URL**: `https://firsttry-solutions.github.io/Firsttry`
- **Hosting**: GitHub Pages (automatic via workflow)
- **Version Display**: Manifest version 4.4.2 shown in portal header/meta/footer

## Expected Public Pages

**Total pages defined in manifest**: 46 items across 6 navigation groups

| Group | Page Count | Notes |
|-------|-----------|-------|
| Overview | 1 | Enterprise Pack Index |
| Trust Center | 19 | Security, Privacy, Architecture, Claims, Data, Threat Model, etc. |
| Operations | 11 | SLA, Incident Response, Access Control, RBAC, Secrets, Logging, etc. |
| Operator Runbooks | 10 | Setup, Deploy, Release, Incident Response guides |
| Procurement | 3 | Questionnaire, Control Mapping, Pack Index |
| Evidence | 2 | Retention Policy, Evidence Index |

**Route Format Canonical**: `/section/page-name.html` (leading slash, .html suffix)

## Version Management

**Authoritative Version Source**: `pages_pack_manifest.json`
- **portal_version**: 4.4.2
- **portal_pack_version**: 4.4.2
- **version**: 4.4.2

**Where Version Displays**:
- Portal header badge
- Meta panel (Portal Pack Version field)
- Footer metadata
- Each generated page shell

**Build Metadata Requirement**: Every generated page must include:
- Portal Version
- Build Timestamp (UTC ISO 8601)
- Commit SHA (short, 8 chars minimum)

## Quality Gates (Non-Negotiable)

1. **Manifest Source Validation**: All source markdown files referenced in manifest must exist
2. **Generated Route Completeness**: Every manifest route must be generated into site/
3. **Live Route Verification**: Every expected route must return HTTP 200 from live portal
4. **Metadata Consistency**: All pages must display identical version/timestamp/commit across portal
5. **No External Deployment**: No manual deploys outside of docs.yml workflow
6. **Fail-Closed**: Any validation failure halts deployment

## Verification Checkpoints

- **Build Time**: Validate manifest completeness + source file existence
- **Artifact Time**: Validate all generated routes present in site/
- **Deploy Time**: Validate live portal routes match expected set
- **Post-Deploy**: Verify metadata consistency across all live pages

---

**Status**: This document defines the reference architecture. All Pages operations must align with these definitions.
