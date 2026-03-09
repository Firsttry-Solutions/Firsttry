# User Guide — FirstTry

**Version**: 2.14.0  
**Last Updated**: 2026-03-09

---

## Overview

FirstTry is an audit evidence snapshot tool for Jira Cloud. It surfaces compliance and governance metrics in your Jira issues, helping security, audit, and procurement teams quickly assess project status.

**Key Features**:
- ✅ **Read-only** — Safely view Jira data without modification risk
- ✅ **Zero-latency** — Instant data snapshots (no external API calls)
- ✅ **Privacy-conscious** — No data leaves Atlassian infrastructure
- ✅ **Minimal scopes** — Only reads necessary Jira information
- ✅ **Persistent preferences** — Settings sync automatically

---

## Getting Started

### Accessing FirstTry

FirstTry appears as a panel in:
- Issue view (detail page)
- Issue panels in boards/reports
- Sprint backlog

Navigate to any Jira issue → Look for the **FirstTry** section

### First Launch

On first launch, FirstTry:
1. Requests read access to the issue (already approved during installation)
2. Checks your user role/permissions
3. Loads default display settings
4. Displays audit metrics for the issue

**Time to first data**: < 1 second (no external calls)

---

## Main Interface

### Dashboard View

The FirstTry interface shows:

| Section | Purpose | Data Source |
|---------|---------|-------------|
| **Audit Snapshot** | Current compliance state | Jira issue metadata |
| **Evidence Summary** | Key findings | Jira custom fields (if configured) |
| **Historical Changes** | Timeline of modifications | Jira activity log |
| **Permissions** | User/group access | Jira security settings |
| **Related Issues** | Linked items | Jira link relationships |

### Metrics Explained

Each metric represents an audit-relevant property:

| Metric | Meaning | Range | Status |
|--------|---------|-------|--------|
| **Compliance Score** | Overall assessment against criteria | 0-100 | Green ≥80, Yellow 50-79, Red <50 |
| **Last Modified** | Time of last change | Date-time | Recent = < 7 days |
| **Access Level** | Your permission level | View/Edit/Admin | Displayed as badge |
| **Audit Trail** | Number of tracked events | Integer | Higher = more history |

### Status Badges

| Badge | Meaning |
|-------|---------|
| 🟢 **Green** | Status is good / compliant / no issues |
| 🟡 **Yellow** | Needs attention / minor issues / review recommended |
| 🔴 **Red** | Critical issue / non-compliant / action required |
| ⚫ **Gray** | Not applicable / data unavailable |

---

## Common Tasks

### 1. View Issue Audit Snapshot

**Goal**: Get a compliance overview of an issue

1. Open any Jira issue
2. Scroll to **FirstTry** section (right sidebar or below description)
3. Review the **Audit Snapshot** card
4. Check status badges and metrics

**Time**: < 5 seconds

### 2. Review Compliance History

**Goal**: See how compliance metrics have changed

1. In FirstTry section, find **Historical Changes** tab
2. Review timeline of modifications
3. Click any event to see details
4. Identify when issues were introduced or resolved

**Note**: History is limited to available Jira activity log retention (default: 90 days)

### 3. Check Permissions

**Goal**: Verify who has access to this issue

1. In FirstTry section, find **Permissions** tab
2. Review **Users** and **Groups** lists
3. Identify access scope (issue-level vs. project-level vs. workspace-level)
4. Note any overly-broad permissions

### 4. Export/Share Evidence

**Goal**: Share audit evidence with auditors or reviewers

1. In FirstTry section, click **⋮** (more options menu)
2. Select **Export as PDF** or **Copy to Clipboard**
3. Share the exported evidence with stakeholders
4. Evidence is **point-in-time** (snapshot as of export time)

**Supported Formats**:
- PDF (with formatting)
- JSON (raw data)
- CSV (for spreadsheet analysis)
- Markdown (for documentation)

### 5. Customize Display Preferences

**Goal**: Adjust FirstTry to match your workflow

1. Click **⚙️ Settings** icon in FirstTry header
2. Adjust preferences:
   - **Theme** (Light/Dark)
   - **Detail Level** (Summary/Standard/Detailed)
   - **Panels** (Show/Hide specific sections)
   - **Alerts** (Notification frequency for compliance issues)
3. Click **Save** (settings auto-sync)

**Settings are persistent** — they apply across all issues and sessions

---

## Understanding Data

### What FirstTry Sees

FirstTry has read-only access to:
- ✅ Issue metadata (title, description, status, etc.)
- ✅ Custom fields (if configured by admin)
- ✅ User permissions (for current user)
- ✅ Link relationships (related issues)
- ✅ Activity log (change history)

### What FirstTry Does NOT See

FirstTry cannot access:
- ❌ Other app data
- ❌ Workflow automation logic
- ❌ Advanced project settings (requires higher scopes)
- ❌ Sensitive custom fields (if restricted by admin)
- ❌ Audit history older than Jira's retention window

### Data Privacy

- ✅ **No external transmission** — all data stays in Atlassian Forge
- ✅ **Encrypted in transit** — TLS encryption to Jira
- ✅ **Encrypted at rest** — Forge storage encryption
- ✅ **No logging** — FirstTry does not log user data
- ✅ **Auto-delete on uninstall** — all data removed within 24 hours

---

## Advanced Features

### Bulk Audit View

To audit multiple issues at once:

1. Go to **Issues** search/filter view
2. Select issues (checkbox select or saved filter)
3. Click **Export Audit Report** (if available)
4. FirstTry generates batch evidence snapshot

**Limitation**: Bulk export limited to 100 issues per request

### Filtered View

To filter audit data:

1. In FirstTry section, click **Filter** icon
2. Select criteria:
   - Status (Compliant/Warning/Non-compliant)
   - Date range (last 7 days, 30 days, custom)
   - Metric threshold (show only score > 80, etc.)
3. Results update in real-time

### Dashboard

To create a personal audit dashboard:

1. Go to your **Jira Dashboards**
2. Add a **Gadget** > **FirstTry Audit Summary**
3. Configure scope (Project, Team, Custom JQL)
4. Dashboard shows aggregate metrics across issues

---

## Troubleshooting

### FirstTry Not Visible

**Symptoms**: Installed app but FirstTry doesn't appear on issues

**Solutions**:
1. Refresh Jira (Ctrl+F5 / Cmd+Shift+R)
2. Verify app is enabled (Settings > Apps > Manage apps)
3. Check you have view access to the issue
4. Try different issue or different project

See [installation.md](installation.md#troubleshooting-installation) for detailed troubleshooting

### Data Appears Stale

**Symptoms**: Metrics show old dates or outdated information

**Solutions**:
1. **Refresh** FirstTry panel using the refresh icon (🔄)
2. **Clear cache** (browser Developer Tools > Storage > Clear All)
3. **Reload page** (F5)
4. **Try different issue** to verify data is updating elsewhere

**Note**: FirstTry typically displays data < 1 second old

### Cannot Export

**Symptoms**: Export button is disabled or export fails

**Solutions**:
1. Verify you have **view** access to the issue (required for export)
2. Try **Copy to Clipboard** instead of file export
3. Ensure browser allows file downloads (check browser security settings)
4. For bulk export, verify selection < 100 issues

### Format Issues

**Symptoms**: Exported data is corrupted or improperly formatted

**Solutions**:
1. Try different export format (PDF → JSON, etc.)
2. Verify issue doesn't contain special characters or embedded media
3. For PDF export, verify browser supports file generation
4. Contact support if issue persists

---

## Tips & Best Practices

### Performance

- FirstTry loads data instantly (< 1 second)
- No performance impact on Jira
- Works offline-capable (for cached data)

### Privacy

- FirstTry shares only the metrics you view
- Exported evidence is point-in-time (snapshot)
- No data is sent to external services
- Safe to share audit snapshots with external auditors

### Workflow Integration

- Pin FirstTry widget on your issues (browser: bookmark + relevant JQL)
- Use FirstTry snapshots in change management records
- Create audit checklists using FirstTry exports
- Automate compliance monitoring using bulk exports

### Compliance Documentation

- **Save exports** for regulatory evidence
- **Date-stamp** all exported evidence
- **Maintain audit trail** of who accessed what
- **Review changes** periodically to detect drift

---

## Support & Documentation

- **Installation Issues**: [installation.md](installation.md)
- **Troubleshooting**: [troubleshooting.md](troubleshooting.md)
- **Privacy & Data**: [docs/privacy.md](../privacy.md)
- **Security**: [docs/security.md](../security.md)
- **FAQ**: [docs/marketplace/MARKETPLACE_REVIEWER_FAQ.md](../marketplace/MARKETPLACE_REVIEWER_FAQ.md)

### Getting Help

| Issue | Contact |
|-------|---------|
| **General support** | [GitHub Issues](https://github.com/firsttry-io/jira-audit-app/issues) |
| **Security issues** | security@firsttry.solutions |
| **Feature requests** | GitHub Discussions |
| **Bug reports** | GitHub Issues |

---

**Version**: 2.14.0  
**Last Reviewed**: 2026-03-09
