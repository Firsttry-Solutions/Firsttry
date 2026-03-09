# Installation Guide — FirstTry

**Version**: 2.14.0  
**Last Updated**: 2026-03-09

---

## Quick Start

### Prerequisites

- Jira Cloud instance with admin or app management access
- Active Atlassian account
- (FirstTry does not require any configuration — it works immediately after installation)

### Installation Steps

1. **Navigate to Atlassian Marketplace**
   - Go to your Jira Cloud instance
   - Select **Settings** (gear icon) > **Apps**
   - Click **Find new apps**

2. **Search for FirstTry**
   - In the search box, type "FirstTry"
   - Select **FirstTry — Audit Evidence Snapshot for Jira**

3. **Install the App**
   - Click **Get it free** or **Free trial** (if applicable)
   - Review the permissions (read-only scopes)
   - Click **Install**
   - Accept the terms and confirm

4. **Verify Installation**
   - Return to **Apps** > **Manage apps**
   - Search for "FirstTry"
   - Confirm status shows **Enabled**

---

## Permissions & Scopes

FirstTry requests minimal read-only scopes:

| Scope | Purpose | Why Required |
|-------|---------|--------------|
| `read:jira-work` | Read issue data | Core functionality — access to Jira project and issue metadata |
| `read:jira-user` | Identify current user | User-specific preferences and access control |
| `storage:app` | Store user preferences | Persist display settings and preferences across sessions |

**No write scopes requested** — FirstTry is read-only and cannot modify Jira data.

---

## Post-Installation

### 1. Grant App Access (if required)

If your Jira workspace requires app approval:

1. Go to **Settings** > **Security** > **Apps**
2. Look for **FirstTry — Audit Evidence Snapshot for Jira** in pending approvals
3. Click **Approve** to enable the app
4. Select which projects FirstTry can access (or select "All projects")

### 2. Verify Access

1. Go to any Jira issue
2. Look for the **FirstTry** panel/section in the issue view
3. If you see the FirstTry interface, installation is successful
4. If not, check [Troubleshooting](#troubleshooting) below

### 3. Configure User Preferences (Optional)

FirstTry automatically loads with default settings. To customize:

1. Open any issue with FirstTry installed
2. Look for the **Settings** icon (⚙️) in the FirstTry interface
3. Adjust display preferences (theme, detail level, etc.)
4. **Settings are saved automatically** and sync across sessions

---

## Uninstallation

To remove FirstTry:

1. Go to **Settings** > **Apps** > **Manage apps**
2. Find **FirstTry — Audit Evidence Snapshot for Jira**
3. Click **...** (more options) > **Uninstall**
4. Confirm uninstallation
5. All FirstTry data (preferences, cache) is automatically deleted

**Data Deletion Timeline**: Forge automatically removes all stored data within 24 hours of uninstallation.

---

## System Requirements

### Supported Jira Versions

- **Jira Cloud** (latest version) ✅ Supported
- **Jira Server** ❌ Not supported (Jira Server reached end-of-life in 2024)
- **Jira Data Center** ⚠️ Not supported (requires development in Jira Data Center SDK)
- **Jira On-Premise** ❌ Not supported

### Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | Latest 2 versions | ✅ Supported |
| Firefox | Latest 2 versions | ✅ Supported |
| Safari | Latest 2 versions | ✅ Supported |
| Edge | Latest 2 versions | ✅ Supported |

### Network Requirements

- **No external network calls** — FirstTry does not require outbound internet access
- All processing occurs within Atlassian Forge (AWS-hosted)
- Zero egress policy enforced

---

## Troubleshooting Installation

### App Does Not Appear After Installation

**Problem**: Installed app but cannot find FirstTry in Jira interface

**Solutions**:

1. **Refresh Jira**
   - Clear browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)
   - Reload Jira (F5 or Cmd+R)

2. **Check Installation Status**
   - Go to **Settings** > **Apps** > **Manage apps**
   - Search for "FirstTry"
   - Verify status is **Enabled** (not "Pending" or "Disabled")

3. **Verify Project Access**
   - Go to an issue in a project where you have access
   - FirstTry panel may not appear in restricted projects

4. **Browser Compatibility**
   - Switch to Chrome or Firefox and retry
   - Clear all cookies for Jira domain

### Permission Denied / Scope Error

**Problem**: "FirstTry requires additional permissions" or scope rejection dialog

**Solutions**:

1. **Re-approve Permissions**
   - Go to **Settings** > **Apps**
   - Locate FirstTry in pending approvals
   - Click **Approve** and select affected projects

2. **Check Admin Status**
   - Ensure your account has Jira admin or app management rights
   - Contact workspace admin if not

3. **Re-install App**
   - Uninstall FirstTry (Settings > Apps > Uninstall)
   - Wait 30 seconds
   - Reinstall from marketplace

### Support

If installation issues persist:

1. Consult [docs/marketplace/MARKETPLACE_SUPPORT_SLA.md](../marketplace/MARKETPLACE_SUPPORT_SLA.md)
2. Check [troubleshooting.md](troubleshooting.md) for common issues
3. File an issue on [GitHub Issues](https://github.com/firsttry-io/jira-audit-app/issues)
4. Contact security team: [security@firsttry.solutions](mailto:security@firsttry.solutions) (for security-related issues only)

---

## Next Steps

After successful installation:

1. **Read the User Guide** — [user-guide.md](user-guide.md) covers all features in detail
2. **Explore Audit Metrics** — Navigate to an issue and review the FirstTry interface
3. **Customize Preferences** — Adjust display settings to your workflow
4. **Learn About Data** — See [docs/MARKETPLACE_DATA_FLOW.md](../marketplace/MARKETPLACE_DATA_FLOW.md) for how FirstTry processes and stores data

---

**Version**: 2.14.0  
**Last Reviewed**: 2026-03-09
