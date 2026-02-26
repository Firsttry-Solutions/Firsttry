# Privacy Policy

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual

---

## 1. Overview

FirstTry is an Atlassian Forge application that reads Jira governance data and stores compliance snapshots in Atlassian's Forge Storage. This policy describes how FirstTry handles user data.

---

## 2. Data Collection

**Data collected**:
- User names, email addresses, Jira user IDs (via GET /rest/api/3/myself and GET /rest/api/3/permissions)
- Project metadata (names, leads, keys)
- Permission and role assignments

**Data NOT collected**:
- Jira issue content, comments, attachments
- Jira user profile details beyond role/permission context
- External collaboration data
- API rate limit metrics (platform telemetry only)

---

## 3. Data Storage

**Where**: Atlassian Forge Storage (encrypted at rest by Atlassian)

**Duration**: 
- Default: 90 days per snapshot retention policy
- Configurable by Jira admin via uninstall or manual deletion

**Deletion**: See [UNINSTALL_DELETION.md](UNINSTALL_DELETION.md)

---

## 4. Data Usage

**Primary use**: Generating compliance evidence and governance reports visible to Jira administrators.

**Secondary uses**: 
- Audit trail (ledger) for forensic review
- Export archive creation
- Dashboard metrics display

**No secondary uses**:
- No AI training or model development
- No third-party analytics integration
- No behavior-based profiling or targeting
- No selling or licensing of data

---

## 5. Data Sharing

**FirstTry shares data with**:
- **Jira admin**: Via dashboard gadget and export downloads
- **Atlassian platform**: KV store encryption and backups (platform-managed)

**FirstTry does NOT share data with**:
- External services or APIs (zero egress)
- Third-party analytics providers
- FirstTry SaaS backend (no FirstTry-owned services)
- Competitors or partners

---

## 6. User Rights (GDPR/CPRA Context)

### Right to Access
Users can request access to their personal data by asking the Jira admin to export compliance evidence (ZIP archive contains user IDs, names, emails).

### Right to Deletion
Users can request deletion via Jira admin:
1. Admin uninstalls FirstTry app
2. Request submitted to Jira admin or Atlassian support
3. Deletion processed within 30 days (see UNINSTALL_DELETION.md)

### Right to Portability
Jira admin can export all data as ZIP archive (portable, machine-readable format).

### Right to Object
Users can request non-processing of their data (opt-out):
- Not feasible: FirstTry requires user permission data for governance function
- Alternative: Jira admin can uninstall app (full data deletion)

---

## 7. International Transfers

**Data residency**: Determined by customer's Jira Cloud region selection.
- No independent regional processing by FirstTry
- See [FORGE_PLATFORM_DEPENDENCY.md](FORGE_PLATFORM_DEPENDENCY.md) for residency guarantees

---

## 8. Security

See [SECURITY_OVERVIEW.md](SECURITY_OVERVIEW.md) for encryption, access control, and authentication details.

---

## 9. Contact

Privacy inquiries: [security@firsttry.run](mailto:security@firsttry.run) or see [SECURITY_CONTACT.md](SECURITY_CONTACT.md)

---

## 10. Changes to This Policy

We will:
1. Update this document for material changes
2. Commit updates to git with notice
3. Notify customers via release notes (CHANGELOG.md)

---

## References

- [DATA_CLASSIFICATION_AND_PII.md](DATA_CLASSIFICATION_AND_PII.md): PII inventory
- [UNINSTALL_DELETION.md](UNINSTALL_DELETION.md): Deletion workflow SLA
- [FORGE_PLATFORM_DEPENDENCY.md](FORGE_PLATFORM_DEPENDENCY.md): Data residency
