# Data Retention & Deletion

**Last updated: 2026-03-02**

> This document describes data lifecycle management. For uninstall behavior, see **[UNINSTALL_DELETION.md](UNINSTALL_DELETION.md)**.

## Retention periods

FirstTry retains data only within your Jira Cloud instance:

| Data Type | Retention Period | Storage Location |
|-----------|------------------|------------------|
| Scan results | Until manual deletion or uninstall | Forge Storage (tenant-isolated) |
| Report HTML | Generated on-demand, not persisted | Ephemeral runtime memory |
| Temporary processing data | Cleared after scan completion | Ephemeral runtime memory |
| Audit metadata | Lifetime of containing scan result | Forge Storage |

**No data is retained outside your Jira instance.**

## Deletion process

### Manual deletion

Delete scan results at any time:
1. Open FirstTry app in Jira
2. Navigate to scan history
3. Select result and click "Delete"
4. Result immediately removed from Forge storage

### Automatic deletion on uninstall

When you uninstall FirstTry:

1. **Forge storage keys**: Automatically deleted by Atlassian platform (instant)
2. **App permissions revoked**: Jira immediately revokes all API access
3. **No external copies**: No data exists outside Forge platform to delete

See **[UNINSTALL_DELETION.md](UNINSTALL_DELETION.md)** for technical details.

## Customer request

To request data deletion:

1. **Self-service**: Use in-app deletion (instant)
2. **Support request**: Email support (see [Support SLA](support-sla.md))
3. **Uninstall**: All data auto-deleted per above

**Response time**: Immediate for self-service, 24 hours for support requests

---

**For comprehensive technical details, see:**
- [UNINSTALL_DELETION.md](UNINSTALL_DELETION.md) - Uninstall behavior specification
- [DATA_FLOW.md](DATA_FLOW.md) - Data flow architecture
