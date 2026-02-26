# Data Classification and PII

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual

---

## Personally Identifiable Information (PII) Acknowledgement

**EXPLICIT ACKNOWLEDGEMENT**: 
This application collects, reads, and stores personally identifiable information (PII) including:
- **User names** (full names from Jira user profiles)
- **Email addresses** (from Jira user objects)
- **User IDs** (Atlassian account IDs)
- **Organization roles** (groups, permissions assigned to users)

This PII is **necessary** for the app's core function (compliance and governance reporting) and is **intentionally collected and stored**.

---

## Data Classification

| Data Class | Type | Examples | Source | Storage | Sensitivity |
|------------|------|----------|--------|---------|-------------|
| **PII** | User identity | Names, emails, IDs | Jira /myself, /permissions | Forge Storage snapshot | High |
| **Role/Permission** | Access control | Group membership, role assignments | Jira /permissions | Forge Storage snapshot | High |
| **Project Metadata** | Configuration | Project names, types, leads | Jira /projects | Forge Storage snapshot | Medium |
| **System Data** | Operational | Timestamps, request IDs, hash values | FirstTry application | Forge Storage ledger | Low |
| **Build Identity** | Integrity marker | Git SHA, UI bundle hash | Build system | Export archive manifest | Low |

---

## No AI Training Usage

**Policy**: User data stored by FirstTry is **NOT used** for training machine learning models, large language models, or any other AI systems.

**Scope**: This policy applies to:
- Snapshots stored in Forge Storage
- Audit ledger entries
- Export archives provided to customers

**Exclusions**: 
- Atlassian platform may use anonymized telemetry from Forge platform layer (outside FirstTry control)
- See FORGE_PLATFORM_DEPENDENCY.md for Atlassian data handling

---

## Data Deletion and Uninstall

**Customer-initiated deletion**:
1. Jira admin uninstalls FirstTry app from Jira Cloud console
2. Forge platform invokes app uninstall handler
3. Application clears Forge Storage (snapshots, ledger, exports)
4. Within 30 days: Atlassian removes data from backups

**Reference**: See [UNINSTALL_DELETION.md](UNINSTALL_DELETION.md) for detailed workflow and SLA.

**Limitation**: No independent verification available. Customer must trust Atlassian SLA for final deletion from backup systems.

---

## Export Privacy Considerations

When admin exports compliance evidence:

**What is included**:
- All PII collected (names, emails, roles)
- Audit trail with user IDs for each recorded action
- Build markers (git SHA, timestamps)

**What is NOT included**:
- Encryption keys, secrets, credentials
- Raw API responses beyond metadata
- Intermediate computation state
- External service credentials

**Admin responsibility**:
- Downloaded export ZIP remains under customer control
- FirstTry does not access the export file after download
- Customer must handle export file storage, transmission, and deletion per their own data handling policies

---

## Redaction and Privacy Modes

**No redaction mode exists**: FirstTry does not offer a "redaction mode" that strips PII from storage or exports.

**Rationale**: For governance and compliance use cases (e.g., security audit, access control review), PII context is essential for proof and traceability.

**Alternative**: Customer can:
1. Manually redact export ZIPs before sharing with external auditors
2. Store exports in secure location with restricted access (own infrastructure)
3. Request deletion of old snapshots by uninstalling and reinstalling app

---

## Data Minimization Posture

**What FirstTry minimizes**:
- Only reads permission/project metadata, not issue data or comments
- Does not call user profile endpoints beyond /myself
- Does not integrate with Jira agile, work management, or custom fields
- Does not collect unrelated data for analytics or telemetry

**What FirstTry does NOT minimize**:
- User names and emails (necessary for compliance context)
- Role/permission details (necessary for access control auditing)
- Timestamps (necessary for audit trailing)

---

## Compliance Frameworks

**GDPR**:
- FirstTry processes personal data on behalf of the customer (Jira admin)
- Data subject rights (access, deletion, portability) are honor via Jira uninstall workflow
- See UNINSTALL_DELETION.md and PRIVACY_POLICY.md for details

**CCPA/CPRA**:
- User names, emails, and roles qualify as "personal information"
- Users can request deletion; submit request to Jira admin who can uninstall app

**No special policy**: FirstTry does not implement independent GDPR/CCPA handling beyond deletion workflow. Responsibility delegated to Jira admin and Atlassian platform.

---

## References

- [DATA_FLOW.md](DATA_FLOW.md): What data is read, stored, exported
- [UNINSTALL_DELETION.md](UNINSTALL_DELETION.md): Deletion workflow
- [PRIVACY_POLICY.md](PRIVACY_POLICY.md): Privacy practices
- [FORGE_PLATFORM_DEPENDENCY.md](FORGE_PLATFORM_DEPENDENCY.md): Platform responsibilities
