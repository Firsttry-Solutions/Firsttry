# FirstTry Data Retention Policy

**Version:** 2.14.0  
**Last Updated:** March 4, 2026  
**Status:** Active

## 1. Overview

This policy defines retention periods for all data types collected and processed by FirstTry, in compliance with GDPR Article 5(1)(e) (storage limitation) and CCPA requirements.

## 2. General Principles

FirstTry adheres to the following retention principles:

1. **Minimal retention:** Data kept only as long as necessary
2. **Automatic purging:** Expired data deleted automatically
3. **User control:** Customers can delete data anytime (uninstall)
4. **No indefinite storage:** All data has defined retention period
5. **Audit trail:** Deletions logged for compliance

## 3. Data Retention Schedule

### 3.1 Jira Snapshot Data

| Data Type | Retention Period | Purge Mechanism | Rationale |
|-----------|------------------|-----------------|-----------|
| Issue snapshots | **90 days** | Automated (scheduled trigger) | Sufficient for audit evidence, balances storage |
| Snapshot metadata | **90 days** | Automated (scheduled trigger) | Same as snapshots |
| Timestamps | **90 days** | Automated (scheduled trigger) | Required for audit trail |

**Implementation:**
- Daily scheduled trigger (`snapshot-cleanup`) checks all snapshots
- Deletes entries where `snapshotTime < (now - 90 days)`
- Logs deletion count to app logs

**Code Reference:** `src/triggers/cleanupSnapshots.ts`

---

### 3.2 Configuration Data

| Data Type | Retention Period | Purge Mechanism | Rationale |
|-----------|------------------|-----------------|-----------|
| App settings | **Until uninstall** | Automatic on uninstall | Required for app functionality |
| Dashboard preferences | **Until uninstall** | Automatic on uninstall | User preferences |

**Implementation:**
- Forge Storage API automatically deletes all data on app uninstall
- No manual intervention required

---

### 3.3 Temporary Data

| Data Type | Retention Period | Purge Mechanism | Rationale |
|-----------|------------------|-----------------|-----------|
| Evidence packs | **Ephemeral (in /tmp)** | OS cleanup on reboot | Created on-demand for export |
| Test artifacts | **Ephemeral (in /tmp)** | OS cleanup on reboot | Used for CI/CD verification only |
| Cached API responses | **Not retained** | In-memory only | Performance optimization |

**Implementation:**
- Evidence packs generated in `/tmp/firsttry_reviewer_proof_TIMESTAMP/`
- Linux automatically purges `/tmp` periodically
- No persistent storage

---

### 3.4 Audit Logs

| Data Type | Retention Period | Purge Mechanism | Rationale |
|-----------|------------------|-----------------|-----------|
| Forge runtime logs | **30 days** | Atlassian retention policy | Debugging, incident response |
| Evidence pack manifests | **Ephemeral (in /tmp)** | OS cleanup on reboot | Verification only |

**Implementation:**
- Forge logs managed by Atlassian (not controlled by FirstTry)
- Evidence manifests deleted with `/tmp` cleanup

---

## 4. Retention by Data Category

### 4.1 Personal Data (GDPR)

FirstTry collects **minimal personal data**:

| Data Element | Retention | Legal Basis | Deletion Method |
|--------------|-----------|-------------|-----------------|
| User ID (Atlassian Account ID) | 90 days max | Legitimate interest | Auto-purge or uninstall |
| No email addresses | N/A | N/A | N/A |
| No names | N/A | N/A | N/A |
| No IP addresses | N/A | N/A | N/A |

**Key Point:** FirstTry stores User IDs only in snapshot metadata (e.g., "created by aaid:1234..."). These are deleted with snapshots (90 days) or on uninstall.

### 4.2 Non-Personal Data

| Data Element | Retention | Deletion Method |
|--------------|-----------|-----------------|
| Issue keys (e.g., PROJ-123) | 90 days | Auto-purge |
| Issue summaries | 90 days | Auto-purge |
| Issue status | 90 days | Auto-purge |
| Timestamps | 90 days | Auto-purge |

---

## 5. Deletion Mechanisms

### 5.1 Automatic Deletion (Scheduled)

**Trigger:** `snapshot-cleanup` (daily at 02:00 UTC)

**Logic:**
```javascript
async function cleanupOldSnapshots() {
  const snapshots = await storage.get('snapshots');
  const now = new Date();
  const retentionDays = 90;
  
  const filtered = Object.entries(snapshots).filter(([key, snap]) => {
    const snapshotDate = new Date(snap.snapshotTime);
    const ageInDays = (now - snapshotDate) / (1000 * 60 * 60 * 24);
    return ageInDays <= retentionDays;
  });
  
  await storage.set('snapshots', Object.fromEntries(filtered));
}
```

**Verification:**
- Check app logs for deletion count: `Deleted 15 snapshots older than 90 days`
- Audit evidence pack includes snapshot age distribution

---

### 5.2 Manual Deletion (User-Initiated)

**Method 1: Uninstall App**
1. Navigate to Jira Settings → Apps → Manage apps
2. Find "FirstTry" → Uninstall
3. Confirm deletion
4. **Result:** All data deleted immediately (Forge Storage API guarantees deletion)

**Method 2: Clear Snapshots (Dashboard)**
1. Open FirstTry dashboard
2. Click "Clear All Snapshots" button
3. Confirm deletion
4. **Result:** All snapshots deleted immediately

**Method 3: Email Request**
1. Email privacy@firsttry.run with:
   - Jira Cloud URL
   - Installation ID (optional)
   - Deletion request
2. FirstTry deletes data within **48 hours**
3. Confirmation email sent

---

### 5.3 Automatic Deletion (Uninstall)

**Trigger:** App uninstalled

**Mechanism:** Forge Storage API

**Behavior:**
- All storage keys deleted immediately
- No residual data in Forge infrastructure
- Irreversible (cannot be undone)

**Verification:**
- After uninstall, re-installing creates fresh storage (no old data)
- Forge Platform guarantees tenant isolation

---

## 6. Retention Exceptions

### 6.1 Legal Hold

If FirstTry receives a valid legal hold notice (court order, subpoena):

1. **Suspend deletion:** Auto-purge disabled for affected data
2. **Notify customer:** Email notification within 24 hours (if legally permitted)
3. **Document hold:** Record legal basis, scope, duration
4. **Resume deletion:** Auto-purge re-enabled after hold lifted

**Authority:** Legal counsel approval required

---

### 6.2 Security Incident

If data is involved in a security incident:

1. **Preserve evidence:** Disable auto-purge for affected snapshots
2. **Investigation:** Forensic analysis (evidence packs)
3. **Extended retention:** Up to 1 year for incident records
4. **Notify customers:** If breach notification required (GDPR Article 34)

**Authority:** Security team approval required

---

## 7. Data Residency and Retention

### 7.1 Regional Retention

Retention periods are **uniform globally**:

- EU customers: 90 days (same as US)
- US customers: 90 days
- APAC customers: 90 days

**No regional variations** (simplifies compliance).

### 7.2 Data Portability During Retention

Customers can **export data anytime** during the 90-day retention period:

1. Generate evidence pack: `bash tools/reviewer_demo/proof_pack/build_reviewer_proof_pack.sh`
2. Evidence pack includes:
   - All snapshots (JSON)
   - Timestamps
   - SHA256 manifest
3. Format: Machine-readable JSON (GDPR Article 20 compliance)

---

## 8. Backup and Archival

### 8.1 Backups

FirstTry **does not maintain backups** beyond Forge Storage:

- **Reason:** 90-day retention is sufficient, no long-term archival needed
- **Atlassian backups:** Forge Storage may be backed up by Atlassian (customer should review Atlassian policy)
- **Evidence packs:** Serve as point-in-time exports, not backups

### 8.2 Archival

FirstTry **does not archive data** beyond the 90-day retention period:

- No "cold storage"
- No tape backups
- No off-site archival

**If customers need longer retention:**
1. Export evidence packs before 90-day expiry
2. Store locally (customer-managed)

---

## 9. Data Retention Compliance

### 9.1 GDPR Article 5(1)(e) - Storage Limitation

**Requirement:** Personal data kept only as long as necessary.

**FirstTry Compliance:**
- ✅ 90-day retention (justifiable for audit evidence)
- ✅ Automatic purging (no manual intervention needed)
- ✅ User deletion rights (uninstall or email request)
- ✅ No indefinite storage

**Assessment:** Compliant

---

### 9.2 CCPA Section 1798.105 - Right to Delete

**Requirement:** Consumers can request deletion of personal data.

**FirstTry Compliance:**
- ✅ Uninstall deletes all data immediately
- ✅ Email request honored within 48 hours
- ✅ No reidentification after deletion

**Assessment:** Compliant

---

### 9.3 SOC 2 CC6.5 - Data Retention

**Control:** Data retention policies defined and enforced.

**FirstTry Evidence:**
- ✅ Documented policy (this document)
- ✅ Automated enforcement (scheduled trigger)
- ✅ Audit trail (app logs)
- ✅ Evidence packs for verification

**Assessment:** Control effective

---

## 10. Monitoring and Auditing

### 10.1 Retention Audit

**Frequency:** Quarterly

**Procedure:**
1. Review app logs for deletion counts
2. Generate evidence pack, verify snapshot age distribution
3. Confirm no snapshots > 90 days old
4. Document findings in audit report

**Responsible Party:** Security team

---

### 10.2 Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Average snapshot age | < 45 days | Evidence pack analysis |
| Max snapshot age | ≤ 90 days | Evidence pack analysis |
| Deletion success rate | 100% | App logs (scheduled trigger) |
| Uninstall deletion time | < 1 minute | Forge Platform SLA |

---

## 11. Customer Responsibilities

### 11.1 Export Before Expiry

Customers are responsible for:

1. **Exporting evidence packs** before 90-day expiry (if long-term retention needed)
2. **Storing exports** in customer-managed systems
3. **Complying with own retention policies** (FirstTry exports, customer retains)

FirstTry is **not liable** for data loss after 90-day auto-purge.

---

### 11.2 Uninstall = Data Loss

**Warning:** Uninstalling FirstTry **permanently deletes all data**.

- No recovery possible
- No backup restoration
- Irreversible

Customers should export evidence packs before uninstalling if data is needed.

---

## 12. Policy Updates

### 12.1 Change Notification

Changes to this policy will be communicated via:

1. **Email notification** to app administrators (if contact info available)
2. **In-app banner** in dashboard (30-day notice for material changes)
3. **GitHub release notes** (for transparency)

### 12.2 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-04 | Initial release |

---

## 13. Contact Information

For retention policy inquiries:

- **Privacy Officer:** privacy@firsttry.run
- **Data Protection Officer:** dpo@firsttry.run
- **General inquiries:** support@firsttry.run

**Response Time:** Within 48 hours

---

## 14. References

- [GDPR Article 5](https://gdpr-info.eu/art-5-gdpr/) (Storage Limitation)
- [CCPA Section 1798.105](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.105) (Right to Delete)
- [Atlassian Data Retention](https://www.atlassian.com/trust/privacy/data-retention)
- [Forge Storage API](https://developer.atlassian.com/platform/forge/storage/)
- FirstTry Data Handling Policy: `docs/trust/data_handling.md`

---

**Policy Owner:** FirstTry Compliance Team  
**Approved By:** Chief Privacy Officer  
**Next Review:** 2026-06-04
