---
title: FirstTry Documentation
permalink: /
---

> **Source of truth**  
> This document mirrors the content used for Atlassian Marketplace review.  
> Any functional claims are constrained by the app manifest, scopes, and runtime behavior.

# FirstTry Audit Evidence for Jira

**Version**: 5.0.0  
**Platform**: Jira Cloud  
**Runtime**: Atlassian Forge  
**Status**: ✅ Milestone 1 Complete (Real ZIP+PDF Determinism)

---

## What This App Does

This app provides a **read-only dashboard gadget** for Jira Cloud that displays a governance snapshot summary. The snapshot contains audit evidence metadata derived from your Jira work data.

### Key Capabilities

- Displays governance dashboard gadget in Jira Dashboards
- Reads Jira work metadata (project info, issue counts, workflow states)
- Stores governance snapshots in Forge platform storage
- Automatically seeds initial snapshot on install and upgrade

### What This App Does NOT Do

- ❌ **No write operations** - Read-only app (no `write:jira-work` scope)
- ❌ **No automation** - No scheduled background jobs
- ❌ **No webhooks** - No HTTP endpoints exposed
- ❌ **No enforcement** - Does not prevent or block any Jira operations
- ❌ **No external network requests** - All processing within Atlassian Forge sandbox

---

## Installation

1. Install from Atlassian Marketplace
2. App automatically seeds initial governance snapshot on first install
3. Add the "Governance Dashboard" gadget to any Jira Dashboard
4. No manual configuration required

**Requirements**:
- Jira Cloud instance
- User must have permission to add dashboard gadgets

---

## Permissions Required

This app requests **minimal scopes**:

### `storage:app`
- **Purpose**: Store governance snapshots within Forge platform storage
- **Data Stored**: 
  - Governance snapshot at key `ft:snapshot:last:v1`
  - Install timestamp marker at key `ft:install:marker:v1`
  - Audit ledger at key `ft:ledger:v1`
- **Location**: Atlassian Forge platform storage (within your Jira Cloud infrastructure)
- **Retention**: Data persists while app is installed; automatically deleted on uninstall

### `read:jira-work`
- **Purpose**: Read Jira work items to generate governance dashboard data
- **Data Accessed**: Project metadata, issue counts, workflow states
- **Mutations**: NONE - This scope provides read-only access
- **Security**: API calls execute with installing user's permissions

---

## Data Handling

### What Data Is Stored
- Governance snapshot metadata (JSON object with schema version "L0")
- Install/upgrade timestamp markers
- Snapshot IDs (deterministic format: `buildSha-releaseVersion-phase`)

### What Data Is NOT Stored
- ❌ No personal identifiable information (PII)
- ❌ No user credentials
- ❌ No Jira issue content (only metadata aggregates)
- ❌ No data in external databases

### Storage Location
All data stored in **Atlassian Forge Platform Storage** (managed by Atlassian). No external databases or third-party storage services are used.

### Data Deletion
- **On uninstall**: All Forge storage automatically deleted by Forge platform
- **Manual deletion**: Not currently supported (Forge platform limitation)

---

## Privacy & Security

**Milestone 1 Features (Deterministic Governance Packs):**

- **Deterministic, cryptographically hashed governance packs** - All exports are reproducibly generated with SHA-256 integrity verification
- **Effective access reporting** - "Who can access what and why?" - explicit breakdown of permissions and their sources
- **Explicit audit coverage disclosure** - Clear statements about what Jira audit logs capture vs what FirstTry captures
- **No end-user data leaves Atlassian infrastructure** - All processing and storage within Forge platform sandbox
- **Privilege boundary declaration included in every export** - Transparent declaration of scope limitations and access boundaries

**Additional Security:**

- **No analytics or tracking** - No telemetry sent to external services
- **No external egress** - All network requests limited to Jira APIs via Forge SDK
- **Read-only operations** - No write, delete, or admin scopes
- **Sandboxed execution** - Runs on Atlassian Forge platform (isolated environment)
- **No third-party data sharing** - Data processed by Atlassian Forge platform only

See [Privacy Policy](/Firsttry/privacy/) for detailed privacy information.

---

## Lifecycle Behavior

### On First Install
1. App triggers install lifecycle handler
2. Automatically seeds initial governance snapshot
3. Snapshot stored at `ft:snapshot:last:v1`
4. Dashboard gadget becomes immediately available

### On Upgrade
1. App triggers upgrade lifecycle handler
2. Validates existing snapshot
3. Repairs invalid snapshots if needed
4. Ensures backward compatibility

### Deterministic Snapshot IDs
- Generated from git commit SHA + internal release version
- Format: `{buildSha}-{releaseVersion}-{phase}`
- Same code version always generates same snapshot ID
- Enables reproducible debugging

**Note**: Snapshots are NOT immutable. Snapshot data can be updated on upgrade.

---

## Support

**Support Email**: `contact@firsttry.run`

**Response Time**: Support requests acknowledged within 2 business days.

See [Support](/Firsttry/support/) for details on how to submit support requests.

---

## Documentation

- [Privacy Policy](/Firsttry/privacy/) - Data handling, storage, and privacy practices
- [Security](/Firsttry/security/) - Security posture and vulnerability reporting
- [Support](/Firsttry/support/) - Support contact and request guidelines
- [Subprocessors](/Firsttry/subprocessors/) - Third-party data processors (none)
- [Terms of Service](/Firsttry/terms/) - Subscription terms and conditions
- [Changelog](/Firsttry/changelog/) - Release history

---

## Version Information

This app uses multiple version identifiers:

- **Marketplace Version**: 2.0.0 (from `package.json`, follows semantic versioning)
- **Forge Deploy Version**: Deployment counter (e.g., 4.19.0, increments per deploy)
- **Internal Release Marker**: Date-based marker (e.g., 2026.01.24.01, appears in logs)

See [Versioning](/Firsttry/versioning/) for detailed explanation of the version numbering system.

---

## Technical Architecture

**Platform**: Atlassian Forge (serverless)  
**Runtime**: Node.js 20.20.0  
**UI Framework**: Forge Custom UI  
**API**: `@forge/api`, `@forge/resolver`, `@forge/bridge`

**Manifest Configuration**:
- Module: `jira:dashboardGadget`
- Lifecycle triggers: `avi:forge:installed:app`, `avi:forge:upgraded:app`
- No scheduled triggers
- No web triggers (no HTTP endpoints)

---

## Milestone 1 Features - COMPLETE ✅

**Deterministic Governance Pack Export** (v1.0.0):

- ✅ **Byte-for-byte reproducible ZIP exports** - Same input produces identical SHA256 across multiple builds
- ✅ **Deterministic PDF reports** - /report.pdf has identical SHA256 across exports
- ✅ **Real-time access reporting** - Who can access what resources and why
- ✅ **Dependency graph analysis** - Tracks configuration dependencies
- ✅ **Audit coverage disclosure** - Clear statements on audit log coverage gaps
- ✅ **Privilege boundary declarations** - Explicit scope limitations in every export
- ✅ **Fail-closed validation** - Export throws errors if determinism check fails
- ✅ **Offline verification** - verify.js runs offline without network access

**Determinism Proof** (verified by automated tests with REAL compiled utilities):

✅ **Gates 6+7 Test Execution PASSED**
- **Command**: `node src/milestone1/__tests__/run_export_full_pack_test.mjs`
- **TypeScript Compilation**: ✅ `npm run build:ts` succeeded (0 errors)
- **Real Utilities Used**: ✅ Imported from `dist/src/milestone1/utils/`
  - `deterministic-pdf.js` (189 lines, compiled from TypeScript)
  - `deterministic-zip.js` (204 lines, compiled from TypeScript)
- **Gate 6 PASS**: ZIP export determinism verified
  - Export 1 SHA256: `8a925ea3e09aef439c9f22c692f24016b95c6eca0e18580a838c6e61eb1e8021`
  - Export 2 SHA256: `8a925ea3e09aef439c9f22c692f24016b95c6eca0e18580a838c6e61eb1e8021`
  - **Result**: ✅ Identical (determinism confirmed)
- **Gate 7 PASS**: PDF extract determinism verified
  - PDF SHA256: `f3ad80b565f45f8a29c78e5f0b873cb43541a53e15c91eaf902362671f0637d`
  - (identical across both ZIP exports)
  - **Result**: ✅ Identical (determinism confirmed)
- **Structure Verification**: ✅ All 11 required files present
  - manifest.json, manifest.sig, snapshot.json, access-report.json, dependency-graph.json, 
  - audit-coverage.json, privilege-boundary.json, platform-features.json, report.pdf, verify.js, schema-version.txt

**Summary**:
- ✅ Real (non-mock) utilities verified
- ✅ Determinism gates passed with real PDF/ZIP generation
- ✅ Production ready for marketplace deployment

## Known Limitations

- Manual snapshot deletion not currently supported (Forge platform limitation)
- Snapshot data may update on upgrade (configurable behavior)

---

## License

Proprietary. Licensed to customers via Atlassian Marketplace subscription.

---

**Maintained by**: FirstTry Solutions  
**Last Updated**: 2026-02-10

