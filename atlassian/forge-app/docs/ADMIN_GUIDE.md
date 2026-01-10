# FirstTry Admin Guide

**Audience**: Jira Cloud site administrators  
**Last Updated**: 2026-01-10

---

## What FirstTry Does

FirstTry is a **read-only governance and evidence collection app** for Jira Cloud:

- **Captures snapshots** of Jira project and issue metadata (schema, structure, definitions)
- **Tracks metadata changes** over time via drift ledgers (no issue content is tracked)
- **Runs periodic checks** to generate proof-of-life and governance evidence
- **Stores all evidence** securely in Jira Cloud Forge Storage (30-90-365 day retention)

### What FirstTry Does NOT Do

- ❌ Does NOT modify Jira data (read-only only)
- ❌ Does NOT write to issues, projects, or fields
- ❌ Does NOT access issue descriptions, comments, or attachments
- ❌ Does NOT send data outside Jira Cloud
- ❌ Does NOT perform user identity checks or authentication beyond Jira

---

## Where FirstTry Appears in Jira

### Dashboard & UI Location

FirstTry appears in Jira Cloud as:
- **Apps → FirstTry Governance** (main entry point)
- **Governance Dashboard**: View current snapshots and drift status
- **Evidence Reports**: Access historical governance data
- **Status & Health**: Proof-of-life indicators and last-run timestamps

### Permissions Required to Use FirstTry

| Role | Can View Dashboard | Can Trigger Manual Snapshot | Can Configure |
|------|-------------------|----------------------------|----------------|
| Jira User | ✅ Yes | ❌ No | ❌ No |
| Project Admin | ✅ Yes | ✅ Yes (project scope) | ✅ Limited |
| Jira Admin | ✅ Yes | ✅ Yes (all projects) | ✅ Full |

**To Install/Uninstall**: Jira **site administrator** role required.

---

## Installation

### Prerequisites

1. **Jira Cloud Site**: Active Jira Cloud subscription (Software, Business, or premium)
2. **Atlassian Marketplace Access**: Your site must allow app installations (check with your IT team)
3. **Admin Role**: You must be a Jira site administrator
4. **Network**: Standard Jira Cloud network access (no special firewall rules)

### Step-by-Step Installation

1. **Go to Jira Cloud** → ⚙️ Settings → **Apps & Integrations** → **Find new apps**
2. **Search** for "FirstTry Governance" in the Atlassian Marketplace
3. **Click Install** on the FirstTry app (published version)
4. **Review the scopes** that FirstTry requests:
   - `storage:app` — Store governance evidence in Forge Storage
   - `read:jira-work` — Read Jira project/issue metadata (schema, types, status)
5. **Click Accept** to grant permissions
6. **Wait for installation** (typically < 2 minutes)
7. **Confirm installation** by navigating to **Apps → FirstTry** (should be visible in the menu)

### Post-Installation Setup

**No mandatory configuration required.** FirstTry automatically:

- ✅ Starts periodic snapshots **5 minutes after installation**
- ✅ Begins drift ledger tracking **immediately**
- ✅ Generates evidence reports **within 10 minutes**

**Optional**: If your organization has custom Forge settings available, you can adjust:
- Snapshot frequency (default: every 6 hours)
- Retention periods (default: 30/90/365 days)
- Alert thresholds

(Contact support if you need these advanced options.)

---

## Uninstallation

### Step-by-Step Uninstall

1. **Go to Jira Cloud** → ⚙️ Settings → **Apps & Integrations** → **Manage apps**
2. **Find FirstTry Governance** in the "Installed apps" list
3. **Click the ⋯ (three-dot menu)** next to FirstTry
4. **Select Uninstall**
5. **Confirm** when prompted (no further confirmation email)

### What Happens to Data After Uninstall

| Data | Behavior |
|------|----------|
| Snapshots | ✅ Automatically deleted from Forge Storage |
| Drift Ledgers | ✅ Automatically deleted from Forge Storage |
| Reports | ✅ Automatically deleted from Forge Storage |
| Jira Data | ❌ No change (FirstTry never modifies Jira) |
| Recovery | ❌ NOT possible (no backup restore available) |

---

## Troubleshooting

### Issue: FirstTry Dashboard Not Appearing

**Problem**: After installation, FirstTry doesn't show up in **Apps** menu.

**Possible Causes & Fixes**:

1. **Cache Issue**:
   - Clear browser cache: `Ctrl+Shift+Delete` (or `Cmd+Shift+Delete` on Mac)
   - Reload Jira Cloud: `F5` or `Cmd+R`

2. **Insufficient Permissions**:
   - Verify you have site admin role or project admin role
   - Check **Settings → Apps → FirstTry → Permissions** (should show `storage:app` and `read:jira-work` granted)
   - If permissions missing, uninstall and reinstall

3. **Installation Still In Progress**:
   - Wait up to **10 minutes** after installation completes
   - Refresh page every 2 minutes

4. **Check Jira Cloud Status**:
   - Visit https://status.atlassian.com to confirm Jira Cloud is not under maintenance

---

### Issue: No Snapshots Being Generated

**Problem**: Dashboard shows "No data yet" or snapshots are old (hours/days stale).

**Possible Causes & Fixes**:

1. **App Not Actually Installed**:
   - Go to **Settings → Apps & Integrations → Manage apps**
   - Confirm FirstTry appears in the installed list
   - If not, reinstall

2. **Permissions Revoked**:
   - Check **Settings → Apps → FirstTry → Permissions**
   - Ensure `read:jira-work` scope is still granted
   - If missing, reinstall the app

3. **Scheduled Job Not Running**:
   - Default snapshot frequency: **every 6 hours**
   - If you just installed, wait 5-10 minutes for first snapshot
   - Manual trigger: Look for "Capture Snapshot Now" button on dashboard (if available)

4. **Jira Cloud Issues**:
   - Verify you have at least one **active project** with issues
   - Verify you have **Browse Projects** permission
   - Check Jira status: https://status.atlassian.com

---

### Issue: "Error Unable to Fetch Metadata" or Similar Errors

**Problem**: Dashboard displays an error message; snapshots fail to generate.

**Possible Causes & Fixes**:

1. **Simple Reload**:
   - Press `F5` or `Cmd+R` to refresh the page
   - Often clears transient API errors

2. **Check Jira Status**:
   - Visit https://status.atlassian.com
   - Confirm Jira Cloud is NOT under maintenance

3. **Check App Permissions Again**:
   - **Settings → Apps → FirstTry → Permissions**
   - Verify `read:jira-work` is granted
   - If not, app likely lost permission (uninstall and reinstall)

4. **Still Broken?**:
   - Open a GitHub issue: https://github.com/Global-domination/Firstry/issues
   - Include: Jira site URL (or site ID), app version, exact error message, screenshot

---

### Issue: "Storage Quota Exceeded" or Similar Storage Errors

**Problem**: Dashboard shows storage quota full; new snapshots cannot be generated.

**Possible Causes & Fixes**:

1. **Retention Policy Is Working (Expected)**:
   - FirstTry automatically deletes snapshots older than **30 days**
   - Drift ledgers older than **90 days**
   - Reports older than **12 months**
   - Wait for next purge cycle (runs daily) or manually trigger cleanup

2. **Manual Cleanup**:
   - Go to FirstTry dashboard → **Settings → Data Cleanup**
   - Select "Clear old snapshots" or "Full wipe" (if available)
   - Confirm

3. **Reduce Snapshot Frequency** (if supported):
   - Contact support to reduce snapshot interval from 6h to 12h or 24h
   - This reduces storage consumption

4. **Check Jira Cloud Storage Limits**:
   - FirstTry uses Forge Storage (separate from Jira Cloud storage quota)
   - Jira Cloud storage issues are separate; contact Jira admin

---

## Support & Getting Help

### How to Get Support

| Channel | Best For | Response Time |
|---------|----------|----------------|
| **GitHub Issues** | Bugs, features, questions | Best effort; typically 24-72 hours |
| **GitHub Discussions** | General questions, best practices | Community-driven; varies |
| **Email** | Sensitive issues | Best effort (include link to GitHub issue) |

**Primary Support**: https://github.com/Global-domination/Firstry/issues

**When Opening an Issue**, include:
- Jira Cloud site ID or URL
- FirstTry app version (visible in dashboard or **Settings → Apps**)
- Exact error message or screenshot
- Steps to reproduce (if applicable)
- Timing: When did the issue start?

### Security Issues

🔒 **Do NOT** open a public GitHub issue for security vulnerabilities.

**Report Security Issues**:
1. Email: (check [SECURITY.md](../../SECURITY.md) for contact)
2. Or: Direct message to repo maintainers on GitHub

---

## Scopes Explained

FirstTry uses exactly **2 Jira scopes**:

| Scope | Purpose | Why Needed |
|-------|---------|-----------|
| `read:jira-work` | Read project/issue metadata | Required to capture Jira structure (project schema, issue types, status definitions, field schema) |
| `storage:app` | Store governance evidence | Required to persist snapshots, drift ledgers, and reports in Forge Storage |

**FirstTry NEVER requests**:
- ❌ Write scopes (`write:jira-work`, `write:automation`)
- ❌ External API scopes (GitHub OAuth, Slack, Datadog, etc.)
- ❌ User identity scopes
- ❌ Admin-only scopes

---

## FAQ

**Q: Does FirstTry modify my Jira data?**  
A: **No.** FirstTry is read-only. It never creates, updates, or deletes any Jira data.

**Q: Does FirstTry access issue descriptions or comments?**  
A: **No.** It accesses only metadata (project names, issue type definitions, status definitions, field schema). Content is not accessed.

**Q: How much data does FirstTry store?**  
A: Depends on your Jira structure (number of projects, issue types, custom fields). Typically 1-10 MB per snapshot for most organizations.

**Q: How long is data stored?**  
A: **Snapshots**: 30 days | **Drift Ledgers**: 90 days | **Reports**: 12 months. Old data auto-deletes daily.

**Q: What happens if I uninstall FirstTry?**  
A: All FirstTry data (snapshots, reports) is deleted automatically from Forge Storage. Jira data is unchanged.

**Q: Can I export FirstTry data?**  
A: Not currently. Data is accessible only via the FirstTry dashboard in Jira.

**Q: Does FirstTry work offline?**  
A: No. FirstTry requires active internet and Jira Cloud access.

---

## Related Documentation

- [DATA_HANDLING.md](DATA_HANDLING.md) — Data privacy, retention, deletion policy
- [SUPPORT.md](SUPPORT.md) — Support channels and response times
- [SECURITY.md](../SECURITY.md) — Security model and threat boundaries
- [RELEASE_GATE_RUNBOOK.md](RELEASE_GATE_RUNBOOK.md) — How we validate marketplace readiness
