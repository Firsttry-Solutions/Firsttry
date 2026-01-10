# Customer Exit Plan

**Last Updated**: 2026-01-10

---

## Uninstallation Process

### Step 1: Access Jira Settings

1. Go to **Jira Settings** > **Apps** > **Manage Apps**
2. Search for "FirstTry Governance"
3. Click **Uninstall**
4. Confirm uninstall

### Step 2: Data Cleanup

Upon uninstallation, FirstTry:
- Stops all scheduled pipelines immediately
- Marks all stored evidence for deletion
- Deletes data within 90 days (per data retention policy)

---

## Data Export Before Uninstallation

### Export Evidence

Before uninstalling, you can export all governance evidence:

1. Open FirstTry admin dashboard
2. Click **Export Evidence**
3. Choose format:
   - **JSON**: Full structured data (for archival)
   - **CSV**: Spreadsheet format (for reports)
4. Download file (stored on your computer, not by FirstTry)

### Retention of Exported Data

- Exported data is **your responsibility** to manage
- FirstTry does not track or delete exports
- Store exports according to your own retention policies

---

## Timeline

| Milestone | Timeline |
|-----------|----------|
| Uninstall initiated | Day 0 |
| Scheduled jobs stopped | Immediately |
| Evidence marked for deletion | Day 1 |
| Active data removed from Forge Storage | Day 90 |
| Complete deletion | Day 90 |

---

## Vendor Lockdown Prevention

FirstTry is designed to **minimize vendor lockdown**:

- **Standard Format**: Evidence is exported in JSON/CSV (standard formats)
- **Jira Native**: All evidence derives from Jira REST API
- **No Custom Integrations**: No dependencies on FirstTry-specific infrastructure
- **Easy Migration**: You can reproduce evidence by querying Jira directly

---

## Data Portability

### Option 1: Use Exported Data

Export all evidence to JSON/CSV before uninstallation. Then:
- Analyze offline
- Import to other governance tools
- Archive for compliance

### Option 2: Recreate from Jira

Since FirstTry only reads Jira metadata, you can recreate evidence by:
- Running your own queries against `/rest/api/3/search`, etc.
- Using Jira's built-in reporting

---

## Support After Uninstallation

If you uninstall FirstTry:
- **Support**: No further support provided (app is uninstalled)
- **Reactivation**: You can reinstall from Marketplace at any time
- **Data**: Previous evidence is deleted after 90 days

If you wish to reinstall later, evidence collection restarts from scratch.

---

## Questions?

Contact: `contact@firsttry.run`

