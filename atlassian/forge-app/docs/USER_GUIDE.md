# FirstTry User Guide

**Audience**: Jira Cloud Admins  
**Updated**: 2026-01-10  
**Version**: 2.14.0

---

## Getting Started

### Installation

1. **Marketplace**: Search for "FirstTry - Audit Evidence Snapshot for Jira" in Atlassian Marketplace
2. **Install**: Click "Get it free" and authorize the requested scopes
3. **Permissions**: Admin permission required
4. **Next**: Navigate to Jira > Governance dashboard to view evidence

### First Run

After installation, FirstTry will:
1. Query your Jira instance for project metadata (takes 1-2 minutes)
2. Store governance baseline in encrypted Forge storage
3. Display dashboard summary in admin gadget
4. Schedule automatic daily snapshots

---

## Dashboard Features

### Governance Status Widget

The admin dashboard gadget shows:

| Metric | Meaning |
|--------|---------|
| **Projects** | Number of projects analyzed |
| **Issues** | Total issue count |
| **Evidence Age** | Latest snapshot timestamp |
| **Compliance Score** | Percentage of observations meeting policy |

### Evidence Download

Admins can export evidence as:
- **JSON**: Full structured data (for auditing)
- **CSV**: Spreadsheet format (for reporting)

**Note**: Exports are generated on-demand and are not stored by FirstTry.

### Policy Configuration

Admins can define what "compliant" means:
- Workflow requirements
- Issue metadata requirements
- Naming conventions

---

## Troubleshooting

### "No data available"

**Cause**: FirstTry is still collecting initial evidence.  
**Solution**: Wait 5-10 minutes, then refresh. Check "Evidence Age" to see when last update occurred.

### "Storage quota exceeded"

**Cause**: Jira Forge storage limit reached.  
**Solution**: Contact `contact@firsttry.run`. FirstTry completes 90-day cleanup daily, so this is rare.

### "Rate limit reached"

**Cause**: FirstTry exceeded Jira API rate limits.  
**Solution**: Automatic exponential backoff applied. Wait 15-30 minutes, then retry.

---

## Data Privacy

FirstTry accesses only:
- Project metadata (names, keys)
- Issue metadata (IDs, keys, created/updated dates, assignee ID, status)
- Workflow definitions
- Field schema

FirstTry **does NOT** access:
- Issue descriptions or comments
- User email addresses
- Custom field values
- Attachments

---

## Performance Impact

FirstTry has **minimal performance impact**:
- Scheduled pipelines run off-peak (configurable)
- API calls use pagination (no large data transfers)
- Evidence stored in Forge storage (Atlassian-managed)
- Uninstall removes all data within 90 days

---

## Support

**Issues or Questions?**  
Email: `contact@firsttry.run`  
Response Target: 24 hours

**Support & Contact**:  
Email: contact@firsttry.run for feature feedback

---

## Scopes & Permissions

### Scopes Required

| Scope | Access | Why Needed |
|-------|--------|-----------|
| `read:jira-work` | Read project/issue metadata | Governance evidence collection |
| `storage:app` | Store app data securely | Evidence persistence (encrypted) |

### Jira Permissions

- **Install**: Jira admin permission required
- **View Dashboard**: Dashboard is visible to admins only
- **Download Evidence**: Admin permission required

---

## Uninstalling

1. Go to Jira Settings > Apps > Manage Apps
2. Find "FirstTry - Audit Evidence Snapshot for Jira"
3. Click "Uninstall"
4. Confirm

**Data**: All FirstTry data (evidence, configs) is deleted within 90 days of uninstall.

---

**Version**: 2.14.0  
**Last Updated**: 2026-01-10

