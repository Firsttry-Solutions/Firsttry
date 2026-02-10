> **Source of truth**  
> This document mirrors the content used for Atlassian Marketplace review.  
> Any functional claims are constrained by the app manifest, scopes, and runtime behavior.

# Versioning

**App**: FirstTry Audit Evidence for Jira  
**Last Updated**: 2026-02-10

---

## Overview

This app uses **three distinct version identifiers**. This document explains why multiple version systems exist and how they relate.

---

## Version Systems

### 1. Marketplace Version (Customer-Facing)

**Current Value**: `2.0.0`

**Source**: `package.json` file in app repository

**Format**: Semantic versioning (MAJOR.MINOR.PATCH)

**Purpose**: 
- Customer-facing version number
- Displayed in Atlassian Marketplace listing
- Visible in Jira Cloud "Manage Apps" panel
- Used for marketplace release tracking

**Visibility**: 
- Visible to all Jira Cloud customers
- Displayed in Atlassian Marketplace
- Shown in Jira settings

**Increment Rules**:
- MAJOR: Breaking changes or significant architectural changes
- MINOR: New features (backward-compatible)
- PATCH: Bug fixes (backward-compatible)

**Example**: `2.0.0` → `2.1.0` (new feature) → `2.1.1` (bug fix) → `3.0.0` (breaking change)

---

### 2. Forge Deploy Version (Platform Metadata)

**Current Value**: `4.19.0` *(example from recent deployment)*

**Source**: Forge CLI deployment counter (not stored in repository)

**Format**: Incrementing version number (managed by Forge platform)

**Purpose**:
- Atlassian Forge platform deployment counter
- Increments automatically on each `forge deploy -e production`
- Internal Forge platform metadata

**Visibility**:
- Visible to app developer via Forge CLI (`forge list`)
- NOT visible to customers
- NOT displayed in Jira Cloud UI

**Increment Rules**:
- Increments automatically on every `forge deploy` command
- Independent of marketplace version
- Managed by Forge platform (not human-controlled)

**Example**: Deploy 1 → `4.18.0`, Deploy 2 → `4.19.0`, Deploy 3 → `4.20.0`

---

### 3. Internal Release Marker (Debug Identifier)

**Current Value**: `2026.01.24.01`

**Source**: `src/release/release_version.ts` file in app repository

**Format**: Date-based marker (YYYY.MM.DD.NN)

**Purpose**:
- Human-controlled release marker for runtime debugging
- Embedded in snapshot IDs for traceability
- Appears in Forge platform logs (structured log markers)
- Proves what code version is running in production

**Visibility**:
- Visible in app logs (accessible via Forge CLI)
- Embedded in snapshot IDs (visible in dashboard gadget)
- NOT visible in Jira Cloud UI directly

**Increment Rules**:
- YYYY.MM.DD: Date of release
- NN: Sequence number (01, 02, 03) for multiple releases on same day
- MUST be manually updated on every production deploy where behavior/logging changes
- MUST NOT be auto-generated (to avoid dirty git trees)

**Example**: 
- First release on Jan 24, 2026: `2026.01.24.01`
- Second release same day: `2026.01.24.02`
- Release on Jan 25, 2026: `2026.01.25.01`

**Snapshot ID Format**:
Snapshots use format: `{buildSha}-{releaseVersion}-{phase}`
- Example: `613fb705d58d-2026.01.24.01-seed`
- Build SHA: Git commit short SHA (12 chars)
- Release version: Internal release marker
- Phase: Snapshot lifecycle phase (e.g., "seed", "upgrade")

---

## Why Three Version Systems?

**Reason for Multiple Versions**:
- **Marketplace Version (2.0.0)**: Customer communication, marketplace listing, semantic versioning
- **Forge Deploy Version (4.19.0)**: Forge platform deployment tracking (platform-managed)
- **Internal Release Marker (2026.01.24.01)**: Production debugging, log tracing, snapshot traceability

**Not Synchronized**: 
These version numbers are **intentionally NOT synchronized**. Each serves a different purpose:
- Marketplace version changes only on feature releases or breaking changes
- Forge deploy version changes on every deployment (including patches)
- Internal release marker changes on every production deploy with behavior changes

---

## Version Mapping Example

| Marketplace | Forge Deploy | Internal Release | Event |
|-------------|--------------|------------------|-------|
| 2.0.0 | 4.16.0 | 2026.01.20.01 | Initial marketplace release |
| 2.0.0 | 4.17.0 | 2026.01.22.01 | Hotfix (no marketplace update) |
| 2.0.0 | 4.18.0 | 2026.01.23.01 | Another hotfix |
| 2.0.0 | 4.19.0 | 2026.01.24.01 | Lifecycle trigger fix |
| 2.1.0 | 4.20.0 | 2026.02.01.01 | New feature release |

**Key Insight**: 
- Marketplace version (2.0.0) stayed constant across multiple Forge deploys (4.16.0 → 4.19.0)
- Each Forge deploy incremented Forge deploy version
- Each deploy with behavior changes incremented internal release marker

---

## When Reporting Issues

**Provide All Three Versions (if available)**:

1. **Marketplace Version**: 
   - Find in Jira: **Settings** > **Apps** > **Manage Apps**
   - Look for "FirstTry Audit Evidence for Jira", note version number

2. **Forge Deploy Version**:
   - NOT accessible to customers
   - Only visible to app developer via Forge CLI

3. **Internal Release Marker**:
   - Visible in snapshot IDs (if you have access to snapshot data)
   - Visible in dashboard gadget (if displayed in UI)
   - Format: YYYY.MM.DD.NN

**Example Support Request**:
```
Subject: Dashboard gadget not displaying

Marketplace Version: 2.0.0
Snapshot ID: 613fb705d58d-2026.01.24.01-seed
Internal Release: 2026.01.24.01
Jira Site: yourcompany.atlassian.net
Issue: Gadget shows "snapshot invalid" error
```

See [SUPPORT.md](SUPPORT.md) for support request guidelines.

---

## Version History

See [CHANGELOG.md](CHANGELOG.md) for release history and version-specific changes.

---

## Developer Notes

**For App Maintainers**:

When preparing a new release:

1. **Update Marketplace Version** (`package.json`):
   - Increment according to semantic versioning
   - Commit change before deployment

2. **Update Internal Release Marker** (`src/release/release_version.ts`):
   - Format: YYYY.MM.DD.NN
   - Use current date and sequence number
   - Commit change before deployment

3. **Deploy to Forge**:
   - Run `forge deploy -e production`
   - Forge deploy version increments automatically
   - Note new Forge deploy version from CLI output

4. **Update CHANGELOG.md**:
   - Document marketplace version changes
   - Include all three version identifiers
   - List user-facing changes

---

## Additional Resources

- [CHANGELOG.md](CHANGELOG.md) - Release history
- [SUPPORT.md](SUPPORT.md) - How to report issues with version information
- [README.md](README.md) - App overview

---

**Last Updated**: 2026-02-10  
**Current Marketplace Version**: 2.0.0  
**Current Internal Release**: 2026.01.24.01  
**Recent Forge Deploy**: 4.19.0 (example)
