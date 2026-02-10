# Support

**App**: FirstTry Audit Evidence for Jira  
**Version**: 2.0.0  
**Last Updated**: 2026-02-10

---

## Support Contact

**Email**: `SUPPORT_EMAIL` *(operator must replace this placeholder)*

---

## Response Time

Support requests are **acknowledged within 2 business days**.

**Business Days**: Monday through Friday, excluding public holidays.

**No SLA / No Uptime Guarantees**: This app does not provide service level agreements (SLAs) or uptime guarantees beyond the acknowledgment timeframe stated above.

---

## How to Submit a Support Request

When submitting a support request, include the following information:

### Required Information

1. **Jira Cloud Site URL** (e.g., `yourcompany.atlassian.net`)
2. **App Version** (see below for how to find this)
3. **Snapshot ID** (if available, visible in dashboard gadget)
4. **Timestamp** (UTC timestamp when issue occurred)
5. **Description of Issue** (what you expected vs. what happened)
6. **Steps to Reproduce** (if applicable)

### Optional Information

- Screenshot of error message or unexpected behavior
- Browser console logs (if UI issue)
- Forge logs (if available and provided by Atlassian support)

---

## How to Find App Version

### Marketplace Version (Customer-Facing)

1. In Jira Cloud, go to **Settings** > **Apps** > **Manage Apps**
2. Find "FirstTry Audit Evidence for Jira" in the installed apps list
3. Version displayed is the marketplace version (e.g., `2.0.0`)

### Internal Release Marker (For Debugging)

The internal release version appears in:
- Dashboard gadget logs (if visible)
- Snapshot IDs (format: `{buildSha}-{releaseVersion}-{phase}`)
- Example: `613fb705d58d-2026.01.24.01-seed`

### Forge Deploy Version

Visible only to app developer via Forge CLI. Not accessible to customers.

**When Reporting Issues**: Provide all three version identifiers if available. See [VERSIONING.md](VERSIONING.md) for explanation of version numbering system.

---

## What Support Covers

### Covered Issues

- App installation failures
- Dashboard gadget not displaying
- Snapshot seeding errors on install/upgrade
- Permission or scope issues
- Data storage errors
- Unexpected behavior or bugs

### Not Covered by App Support

- Jira Cloud platform issues (contact Atlassian support)
- Forge platform outages (contact Atlassian support)
- Feature requests (submit via Atlassian Marketplace feedback)
- Custom integrations or modifications
- Issues caused by other apps or Jira configurations

---

## Troubleshooting Common Issues

### Gadget Not Displaying

1. Verify app is installed: **Settings** > **Apps** > **Manage Apps**
2. Check user has permission to view dashboard gadgets
3. Try refreshing browser
4. Check browser console for errors (F12 in most browsers)

### Snapshot Not Seeding on Install

1. Verify install completed (check **Manage Apps** for app status)
2. Wait 1-2 minutes for lifecycle trigger to complete
3. Refresh dashboard gadget
4. If still not seeded, contact support with site URL and timestamp

### Permission Errors

1. Verify installing user has `read:jira-work` permissions in Jira
2. Check app has been granted `storage:app` and `read:jira-work` scopes
3. Reinstall app if scopes were not granted on first install

---

## Escalation

For critical production issues, include **[URGENT]** in email subject line.

**Definition of Critical**:
- App completely non-functional for all users
- Data loss or corruption
- Security vulnerability disclosure

**Response for Critical Issues**: Acknowledged within 1 business day.

---

## Security Vulnerability Reporting

To report a security vulnerability:

1. **Do NOT use public channels** (e.g., Marketplace reviews, public forums)
2. Email `SUPPORT_EMAIL` with subject line: **[SECURITY] Vulnerability Report**
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Your contact information

See [SECURITY.md](SECURITY.md) for security posture details.

---

## Feature Requests

To request new features:

1. Visit Atlassian Marketplace app listing
2. Submit feedback via Marketplace feedback mechanism
3. Or email `SUPPORT_EMAIL` with subject line: **[FEATURE REQUEST]**

**Note**: Feature requests are not covered by support response time commitments.

---

## Additional Resources

- [README.md](README.md) - App overview and capabilities
- [PRIVACY_POLICY.md](PRIVACY_POLICY.md) - Data handling and privacy
- [SECURITY.md](SECURITY.md) - Security posture and vulnerability reporting
- [VERSIONING.md](VERSIONING.md) - Version numbering explanation
- [CHANGELOG.md](CHANGELOG.md) - Release history

---

**Support Email**: `SUPPORT_EMAIL` *(operator must replace this placeholder)*  
**Acknowledgment Time**: Within 2 business days  
**Last Updated**: 2026-02-10
