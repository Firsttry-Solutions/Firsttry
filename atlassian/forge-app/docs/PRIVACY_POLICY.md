# Privacy Policy

**Effective Date**: January 2026  
**Version**: 1.0  

---

## 1. What This App Does

This Forge app is a **read-only dashboard** that displays and exports build verification snapshots from Atlassian Jira. It allows users to:

- View the current build identity (git commit SHA, bundle hash)
- Display snapshot metadata (ID, creation time, snapshot state)
- Export snapshot records for audit purposes
- Correlate requests via UI request identifiers
- Toggle debug mode for troubleshooting

**No data is modified or written by this app**. It is purely an inspection tool.

---

## 2. Data Collected

### Jira Configuration & Metadata
- **Jira workspace/site ID** (from Jira context)
- **User ID** (the person viewing the dashboard)
- **User display name** (if available from Jira)

### Snapshot Metadata
- **Snapshot ID** (unique identifier for each build state)
- **Snapshot creation timestamp**
- **Snapshot state** (AVAILABLE, NO_SNAPSHOT, HARD_ERROR, INVALID_SNAPSHOT)
- **Build identity** (git commit SHA, bundle hash)
- **UI request ID** (for correlating request chains)

### Debug Data (If ?ft_debug=1 enabled)
- Console output (development mode only; not sent to servers)
- Request/response payloads (for troubleshooting; ephemeral)

---

## 3. Data Storage

### Where Data Is Stored
- **Jira/Forge Bridge**: Snapshot metadata flows through the Forge bridge (Atlassian's runtime)
- **Browser Session**: UI request IDs and build identity are stored in browser memory during the session
- **Browser Local Storage**: None (this app does not use local storage)
- **Server-Side Persistence**: None (this app stores no data on servers)

### How Long Data Is Retained
- **Session data**: Cleared when the browser tab is closed
- **Jira metadata**: Follows Jira's own retention policies (not controlled by this app)
- **Logs**: See section 5 below

---

## 4. Data Sharing & Egress

### External Egress
**None**. This app:
- Does **NOT** send data to third-party services
- Does **NOT** export data outside the Jira ecosystem
- Does **NOT** use analytics or telemetry services
- Does **NOT** integrate with external SaaS platforms

All data stays within the Jira workspace where the app is installed.

### Data Sharing Within Jira
- Snapshot metadata is visible to any user who can access the Forge app in the workspace
- No role-based restrictions are enforced at the app level (Jira's workspace permissions apply)

---

## 5. Logs

### What Is Logged
- **HTTP requests**: Forge bridge request/response pairs (timestamp, correlator ID, status)
- **Errors**: When snapshot state is HARD_ERROR or INVALID_SNAPSHOT, the error reason is logged
- **Debug traces**: If ?ft_debug=1 is enabled, full request payloads are logged to browser console

### What Is NOT Logged
- User passwords or authentication tokens
- Jira API tokens or secrets
- User email addresses
- Full request bodies for non-debug requests

### Log Retention
- Browser console logs: Cleared when the app tab is closed
- Jira/Forge logs: Follows Atlassian's data retention policies (typically 30 days for debug logs)

---

## 6. User Rights & Contact

### Your Rights
- **Access**: You can view all data the app collects about your account
- **Deletion**: You can request deletion of your user ID/display name (contact support)
- **Portability**: You can request export of your snapshot records (via the Export button)
- **Opt-Out**: You can stop using this app, which stops all data collection

### Contact
For privacy questions or requests:
- **Email**: PRIVACY_EMAIL_HERE (replace with your support email)
- **Response time**: Best effort within 5 business days

---

## 7. Changes to This Policy

We may update this privacy policy to reflect:
- Changes in how the app collects or uses data
- Changes in Jira/Forge capabilities
- Legal or compliance requirements

When we make changes, we will:
1. Update the "Effective Date" at the top
2. Increment the "Version" number
3. Notify users via Jira workspace alerts (if applicable)

Users are responsible for reviewing this policy periodically.

---

**Questions?** Contact the app support team (see section 6).
