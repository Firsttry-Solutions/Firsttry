# Data Retention Policy

**Effective Date**: 2026-01-10  
**Classification**: Public (Marketplace Review)  
**Scope**: FirstTry Governance App for Jira Cloud

---

## Data Retention Schedule

### Active Data (Stored in Forge Storage)

| Data Type | Retention Period | Justification | Deletion Method |
|-----------|------------------|---------------|-----------------|
| Governance evidence snapshots | 90 days | Sufficient for trend analysis; older data compressed | Automatic cleanup job (daily) |
| Configuration policies | Indefinite (until admin deletes) | Admin-defined settings; no PII | Manual deletion via admin UI |
| Hash digests (integrity proof) | 90 days | Verification only; matches evidence retention | Automatic cleanup |
| OAuth tokens | 12 hours (rotated) | Runtime memory only; never stored | Automatic refresh job |

### Archived/Exported Data

| Format | Retention | Owner | Access |
|--------|-----------|-------|--------|
| JSON export (admin-triggered) | Until manual deletion | Jira admin (external to app) | Admin only |
| CSV export (admin-triggered) | Until manual deletion | Jira admin (external to app) | Admin only |
| Evidence audit trail | 90 days | FirstTry app | Read-only access |

---

## Deletion & Cleanup

### Automatic Cleanup

**File**: `src/retention/cleanup.ts` (line 76)  
**Trigger**: Daily scheduled job (`phase4-timeline-scheduler`)  
**Process**:
1. Query all evidence older than 90 days
2. Delete snapshots from Forge storage
3. Log cleanup result
4. Alert admin if deletion fails

**Proof**: `audit/proof_runs/run_20260110_121856/npm_test_deterministic.log` (line "retention cleanup")

### Manual Deletion

Jira admins can:
1. Access FirstTry admin dashboard
2. Click "Delete Evidence" button
3. Confirm deletion
4. Cleanup runs immediately

---

## Data NOT Retained

FirstTry **never stores**:
- Issue content (descriptions, comments)
- Custom field values
- User emails or personal data
- API tokens (except in-memory, rotated every 12 hours)
- Raw HTTP requests/responses
- Debugging logs containing PII

---

## Compliance

### GDPR / Data Subject Rights

If a user requests deletion of their data:
1. Query Forge storage for evidence containing user IDs
2. Delete relevant snapshots
3. Cleanup runs (guarantees deletion within 90 days max)

**Note**: FirstTry does not store user personal data directly (only IDs for "assignee" field). User names/emails are NOT stored.

### Data Processor Role

FirstTry acts as a **data processor** (not controller):
- Jira Cloud is the controller
- FirstTry processes only what Jira API exposes
- Data remains within Jira Cloud infrastructure

---

## Audit Trail

FirstTry logs all evidence operations:
- Evidence created/updated/deleted
- Cleanup jobs executed
- Errors during deletion

**Location**: Jira app logs (accessible to admins via Jira UI)

---

## References

- Cleanup Implementation: `src/retention/cleanup.ts`
- Scheduled Trigger: `manifest.yml` (lines 70-71)
- Test Verification: `tests/test_phase3_daily_pipeline_no_data.ts` (retention cleanup test)
- Privacy Policy: `legal/PRIVACY_POLICY.md`

