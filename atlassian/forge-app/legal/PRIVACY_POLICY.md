# Privacy Policy

**Effective Date**: 2026-01-10  
**Last Updated**: 2026-01-10

---

## Data Processing

FirstTry processes the following data on behalf of your Jira Cloud instance:

### Data Accessed from Jira

FirstTry reads (via the `read:jira-work` scope):
- Project names and keys
- Issue metadata (IDs, keys, timestamps, status, assignee ID)
- Workflow and field definitions

### Data Not Accessed

FirstTry **never** accesses:
- Issue descriptions or comments
- Custom field values
- User email addresses or personal information
- Attachment content
- Jira audit logs

### Data Stored

FirstTry stores governance evidence snapshots in Jira's Forge Storage:
- Aggregated metrics (counts, timestamps)
- Configuration policies
- Hash digests for integrity verification

### Data Retention

- **Active storage**: 90 days
- **Cleanup**: Automatic daily deletion of evidence older than 90 days
- **Uninstall**: All data deleted within 90 days

### Data Sharing

FirstTry **does not share data** with:
- Third-party analytics services
- External cloud providers
- Marketing or sales teams

All data remains within Jira Cloud infrastructure.

---

## Your Rights

As a Jira admin, you can:
- **Access**: View all stored evidence via the admin dashboard
- **Export**: Download evidence as JSON or CSV
- **Delete**: Manually trigger evidence deletion
- **Control**: Configure what constitutes "compliant"

---

## Contact

For privacy questions: `contact@firsttry.run`

