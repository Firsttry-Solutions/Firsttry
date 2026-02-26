# Data Flow

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual
**Doc ID**: FT-TRUST-009  

---

## What Jira Data is Read

The application reads the following data from Jira Cloud API:

| Data Category | Source | API Endpoint | Frequency | Retention |
|---------------|--------|--------------|-----------|-----------|
| Current user context | Jira API | GET /rest/api/3/myself | On-demand (gadget load) | Session (in memory) |
| Project metadata | Jira API | GET /rest/api/3/projects | On-demand or scheduled snapshot | Forge Storage (90 days by default) |
| Permission matrix | Jira API | GET /rest/api/3/permissions | On-demand or scheduled snapshot | Forge Storage (90 days by default) |
| Field configuration | Jira API | GET /rest/api/3/fieldconfiguration | On-demand or scheduled snapshot | Forge Storage (90 days by default) |

---

## What is Stored

**Forge Storage persistence layer**:

### Snapshots
- JSON structure containing project list, permission matrix, timestamp
- One file per snapshot
- Stored in key: `snapshot:${timestamp}`
- Encrypted at rest by Atlassian

### Audit Ledger
- Append-only JSON lines log
- Each record: event type, timestamp, user ID, operation, hash
- Stored in key: `ledger`
- Immutability enforced by application (read, verify hash, append, write)
- Encrypted at rest by Atlassian

### Export Archives
- ZIP format containing snapshots + ledger + manifest + signature
- One ZIP per export request
- Stored in key: `export:${timestamp}`
- Deterministic content and ordering

---

## What is NOT Stored

**The following data is NOT persisted by the application**:
- Raw API response bodies (parsed and filtered before storage)
- User credentials or authentication tokens
- Jira Cloud JWT or OAuth2 secrets (Forge manages these)
- API rate limit headers or metadata
- Intermediate computation state (unless explicitly saved to snapshot)
- External service credentials (application does not have any)
- Unencrypted PII (see DATA_CLASSIFICATION_AND_PII.md)

---

## Cross-Tenant Data Isolation

**Guarantee**: FirstTry respects Atlassian Forge per-tenant isolation.

**Detail**:
- Each Forge app instance is tenant-isolated by Atlassian
- Jira site A cannot access Jira site B's Forge Storage
- When app is uninstalled from Site A, Forge Storage for Site A is deleted
- No shared storage between tenants exists at application level

**Caveat**: This isolation is **guaranteed by Atlassian Forge platform**, not independently implemented by FirstTry. See FORGE_PLATFORM_DEPENDENCY.md.

---

## Export Data Handling

When admin exports compliance evidence:

1. **Export initiation**: Admin clicks "Export" in gadget UI
2. **Data collection**: App reads current snapshots from Forge Storage
3. **ZIP creation**: App packages snapshots + ledger + manifest
4. **Hash computation**: SHA256 hash computed over deterministic ZIP content
5. **Build identity**: Git commit SHA + UI bundle hash embedded in manifest
6. **Download**: ZIP provided to admin via Jira download mechanism
7. **Out of scope**: Admin downloads and stores ZIP on their own infrastructure

**No external transmission**: App does not send ZIP to external services or FirstTry servers.

---

## Data Deletion

### On Uninstall
- Customer (Jira admin) uninstalls app via Jira administration console
- Forge platform triggers delete event
- App cleanup handler executes (clears Forge Storage for tenant)
- Within 30 days: Atlassian deletes underlying data from backups

**Verification**: Customer cannot verify deletion independently; must trust Atlassian SLA.

### Manual Deletion
- No in-app delete mechanism for stored snapshots
- Workaround: Uninstall app (triggers full delete) or use Forge CLI (app-specific, requires CLI access to tenant)

---

## Data Minimization

**Data minimization principle**: FirstTry reads only data necessary for compliance reporting.

**Applied**:
- Only GET endpoints called (no WRITE operations)
- Only permission and project metadata requested (no user personal data beyond role context)
- No call to user profile endpoint (only /myself for current user context)
- No integration with Jira issues, comments, or attachments

**Not applied**:
- App does not filter out personally identifiable information (PII) at collection time
- Names, emails, and user IDs are present in snapshots (necessary for compliance reporting)
- See DATA_CLASSIFICATION_AND_PII.md for PII handling details

---

## References

- [ARCHITECTURE.md](ARCHITECTURE.md): System component diagram
- [DATA_CLASSIFICATION_AND_PII.md](DATA_CLASSIFICATION_AND_PII.md): PII inventory and handling
- [UNINSTALL_DELETION.md](UNINSTALL_DELETION.md): Deletion workflow and SLA
- [FORGE_PLATFORM_DEPENDENCY.md](FORGE_PLATFORM_DEPENDENCY.md): Platform isolation guarantees
