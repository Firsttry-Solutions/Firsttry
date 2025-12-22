# FirstTry Data Retention Policy

**Version**: 1.0  
**Last Updated**: 2025-12-22

**SINGLE SOURCE OF TRUTH**: All FirstTry data retention claims must reference this document.

---

## Executive Summary

**Data is retained indefinitely within Atlassian Forge storage until tenant uninstall or Atlassian-controlled lifecycle deletion. FirstTry does not currently enforce time-based TTL deletion.**

| Data Type | Retention Model | Control | Notes |
|-----------|-----------------|---------|-------|
| **All FirstTry Data** | Indefinite | Atlassian Forge | No FirstTry-enforced expiry |
| **On Tenant Uninstall** | Cleared | Atlassian | Forge auto-purges all storage |
| **Data Residency** | Jira region | Atlassian | FirstTry does not control location |

---

## 1. Retention Constants (For Reference Only)

**IMPORTANT**: FirstTry has defined TTL constants in code, but these do NOT enforce deletion. Actual retention is indefinite at the FirstTry application level.

### 1.1 Code Constants (Informational)

**Evidence File**: `src/storage.ts`

These constants are defined but do NOT result in automatic FirstTry-enforced deletion:

```
SNAPSHOT_TTL_SECONDS = 7776000  // 90 days (defined, not enforced)
EVENT_TTL_SECONDS = 7776000  // 90 days (defined, not enforced)
REPORT_TTL_SECONDS = 2592000  // 30 days (defined, not enforced)
EXPORT_TTL_SECONDS = 604800  // 7 days (defined, not enforced)
```

**Status**: These values are placeholders for future TTL enforcement. Currently, FirstTry retains all data indefinitely.

---

## 2. Platform-Controlled Behaviors

**CRITICAL DISCLAIMER**: The following behaviors are governed by Atlassian Forge platform guarantees and are NOT independently controlled or overridden by FirstTry:

### 2.1 Data Deletion on Uninstall

**Who Controls**: Atlassian Forge  
**What FirstTry Guarantees**: NOTHING

When a workspace admin uninstalls FirstTry:
- ⚠️ FirstTry application loses read access to storage
- ⚠️ Data remains in Atlassian Forge infrastructure
- ❌ FirstTry does not control uninstall deletion
- ❌ FirstTry cannot guarantee data purge on uninstall
- Workspace admin must manually request deletion from Atlassian

**You Cannot Rely On FirstTry To Delete Your Data On Uninstall.**

### 2.2 Data Residency

**Who Controls**: Atlassian Cloud Platform  
**What FirstTry Guarantees**: NOTHING

FirstTry data residency is determined by:
- Your Jira Cloud tenant region (US or EU)
- Atlassian's infrastructure decisions (not FirstTry)
- FirstTry has zero control over storage location

**You Cannot Specify FirstTry Data Residency.**

### 2.3 Data Backup & Recovery

**Who Controls**: Atlassian Forge  
**What FirstTry Guarantees**: NOTHING

Backup and recovery are managed by Atlassian:
- Backup procedures are implemented by Atlassian Forge only
- Data recovery is performed by Atlassian, not FirstTry
- Contact Atlassian for data recovery requests

**FirstTry Cannot Recover Your Data If Lost.**

### 2.4 Storage Quotas & Limits

**Who Controls**: Atlassian Forge  
**What FirstTry Guarantees**: NOTHING

Storage capacity is determined by:
- Your Atlassian Forge plan quota
- Atlassian's platform-controlled storage limits (not FirstTry)
- FirstTry will fail gracefully if storage exceeded

**Platform-Controlled**: Atlassian Forge manages quota enforcement. App does not override or determine quotas.

---

## 3. Automatic Purge Mechanism

### 3.1 How Purge Works (Future)

FirstTry *intends* to use **Atlassian Forge storage TTL** (when implemented):

1. Data is written to Forge storage with TTL header
2. Atlassian infrastructure would automatically delete expired records
3. No manual purge job required
4. No configuration needed

**Current Status**: NOT IMPLEMENTED. FirstTry retains data indefinitely.
- ✅ All workspace-scoped storage is automatically purged by Atlassian
- ✅ FirstTry cannot access deleted workspace
- ✅ Purge is guaranteed by Atlassian infrastructure

---

## 4. Data Minimization

### 4.1 Why Retention Is Short

FirstTry keeps retention periods short (30-90 days) because:

| Reason | Benefit |
|--------|---------|
| Snapshots expire | No need to store historical drift (fresh comparison each run) |
| Events expire | Audit trail is sufficient for troubleshooting, not archival |
| Reports expire | Auto-generated; not valuable after issue is resolved |
| Exports expire | Temporary files; keep download window short |

### 4.2 Storage Optimization

- ❌ No long-term data archive
- ❌ No indefinite growth
- ✅ Bounded storage footprint per workspace
- ✅ Predictable resource usage

---

## 5. Retention-Related Requirements

### 5.1 CI Enforcement

**Status**: ⚠️ Planned (not yet enforced)

- Test file exists: `tests/docs/data_retention_enforcement.test.ts`
- CI gate: Will fail if TTL constants are removed or increased
- Coverage: All retention-related claims will be backed by code constants

### 5.2 Documentation Accuracy

**Current**: This document matches code constants exactly.  
**Verification**: See [audit/CLAIMS_PROOF_CATALOG.md](../audit/CLAIMS_PROOF_CATALOG.md) for evidence mapping.

---

## 6. GDPR / Data Subject Rights

### 6.1 Right to Erasure (GDPR Art. 17)

**Status**: Dependent on Atlassian Forge Terms

- ❌ FirstTry does NOT provide automatic purge (FirstTry retains data indefinitely)
- ⚠️ Data deletion on uninstall is Atlassian-controlled (FirstTry does not manage this)
- ⚠️ No immediate on-demand deletion mechanism in FirstTry (must request from Atlassian)
- ✅ Data cannot be linked to individual users (no email/user ID stored)

**Implication**: For GDPR compliance, customers must rely on Atlassian's data deletion procedures, not FirstTry's deletion mechanisms.

### 6.2 Right to Access (GDPR Art. 15)

**Status**: Not applicable

- FirstTry does not store personal data
- No email addresses, user IDs, or identifiable information
- Issue snapshots contain only metadata (keys, statuses, not comments)

### 6.3 Data Processor Agreement (DPA)

**Status**: See [COMPLIANCE.md](COMPLIANCE.md) - FirstTry does NOT offer a standalone DPA

---

## 7. Changelog & Updates

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2025-12-22 | Updated: Retention is indefinite at FirstTry level; Atlassian Forge controls actual deletion |

---

## Appendix A: Code TTL Constants (For Reference Only)

FirstTry has defined TTL constants in code for potential future use, but they are NOT currently enforced:

```typescript
// src/storage.ts - NOT CURRENTLY ENFORCED BY FIRSTRY

export const SNAPSHOT_TTL_SECONDS = 7776000;   // 90 days (defined, not active)
export const EVENT_TTL_SECONDS = 7776000;      // 90 days (defined, not active)
export const REPORT_TTL_SECONDS = 2592000;     // 30 days (defined, not active)
export const EXPORT_TTL_SECONDS = 604800;      // 7 days (defined, not active)
```

**Status**: These constants are placeholders. FirstTry retains all data indefinitely.

---

**Document Version**: 1.0  
**Next Review**: Q2 2026 or when retention policy changes
