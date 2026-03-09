# Troubleshooting Guide — FirstTry

**Version**: 2.14.0  
**Last Updated**: 2026-03-09

---

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Access & Permissions](#access--permissions)
3. [Data & Display](#data--display)
4. [Performance](#performance)
5. [Export & Integration](#export--integration)
6. [Security & Privacy](#security--privacy)
7. [Getting Help](#getting-help)

---

## Installation Issues

### App Not Appearing After Installation

**Symptoms**: Installed FirstTry but it doesn't show up in Jira

**Diagnosis Steps**:

1. **Verify installation**
   - Go to Settings > Apps > Manage apps
   - Search for "FirstTry"
   - Check if status is "Enabled"

2. **Check browser**
   - Try a different browser (Chrome, Firefox, Safari)
   - Clear cache and cookies
   - Disable browser extensions (may interfere)

3. **Test with different issue**
   - Navigate to different project
   - Open different issue
   - See if FirstTry appears there

**Solutions**:

| Status | Action |
|--------|--------|
| Not found in app list | Re-install from marketplace |
| Status = "Disabled" | Click "Enable" button |
| Status = "Pending" | Contact admin for approval |
| Status = "Failed" | Uninstall and reinstall |

**Resolution Time**: Usually 5-10 seconds after enabling

### Installation Fails / App Rejected

**Symptoms**: Cannot install or installation fails with error

**Common Errors**:

| Error | Cause | Fix |
|-------|-------|-----|
| "Insufficient permissions" | Admin role required | Contact Jira admin |
| "Cannot add app to workspace" | Workspace limit reached | Remove unused apps first |
| "Invalid app package" | Marketplace issue | Wait 5 min and retry, or contact support |
| "Network error" | Connectivity issue | Check internet, retry |

**Solutions**:

1. **Ensure admin access**
   - Verify your account has Jira admin rights
   - Ask workspace admin if needed

2. **Try different network**
   - Use different WiFi or cellular network
   - Try from different location/computer

3. **Wait and retry**
   - Marketplace synchronization can take 5-10 minutes
   - Wait a few minutes, then retry installation

4. **Check workspace limits**
   - Go to Settings > Apps
   - If many apps installed, uninstall unused ones
   - Retry FirstTry installation

### Permissions Request Denied

**Symptoms**: "Cannot grant required permissions" or similar dialog

**Solutions**:

1. **Verify admin role**
   - Only Jira admins can approve app permissions
   - Contact your workspace admin

2. **Review requested scopes**
   - FirstTry requests: read:jira-work, read:jira-user, storage:app
   - These are standard read-only scopes
   - No write permissions requested

3. **Re-approve app**
   - Settings > Security > Apps
   - Find FirstTry in pending/restricted
   - Click "Approve" button
   - Allow access to specific projects or all

---

## Access & Permissions

### Cannot See FirstTry Data

**Symptoms**: App installed and visible, but no data shows / all blank

**Diagnosis**:

1. **Check user permissions**
   - Verify you have **view** access to the issue
   - Try with an issue you know you can access
   - Check project-level permissions

2. **Verify app scopes**
   - Settings > Apps > Manage apps
   - Click FirstTry > "View permissions"
   - Confirm read:jira-work, read:jira-user are granted

3. **Check issue access**
   - Can you see basic issue details?
   - Can you edit the issue?
   - Does security/visibility restrict you?

**Solutions**:

| Problem | Fix |
|---------|-----|
| No project access | Contact project admin to grant access |
| Issue restricted | Verify you're in required group/role |
| App scopes revoked | Re-approve app permissions (Settings > Apps) |
| Issue doesn't exist | Verify issue ID is correct |

### "Access Denied" Error

**Symptoms**: Error message "You don't have permission to view this"

**Causes**:
- Issue visibility restricted to specific group
- Project level permissions restrict access
- Issue removed or archived
- Security settings changed

**Solutions**:

1. **Request access**
   - Contact issue creator or project admin
   - Ask to be added to required group/role

2. **Verify issue exists**
   - Search for issue in Jira
   - Confirm it appears in search results
   - If not visible, you may not have access

3. **Check project settings**
   - Go to project > Project settings > Permissions
   - Verify your role has "View issues" permission
   - If not, request elevation

4. **Try with different issue**
   - Open another issue in same project
   - If that works, original issue may be specially restricted
   - If not, project-level access issue

### FirstTry Tab Empty / Grayed Out

**Symptoms**: FirstTry section exists but shows "Loading..." or is empty

**Solutions**:

1. **Wait for data to load**
   - FirstTry typically loads in < 1 second
   - Wait 5-10 seconds if data-heavy issue

2. **Refresh the page**
   - Press F5 or Cmd+R
   - Wait for full page reload

3. **Clear cache**
   - Browser: Storage > Clear all (Dev Tools)
   - Then refresh page
   - Or use Private/Incognito window

4. **Check browser console**
   - Press F12 to open Developer Tools
   - Go to Console tab
   - Look for error messages
   - Screenshot and share with support

---

## Data & Display

### Data Appears Outdated

**Symptoms**: Metrics show old date or historical data, not current

**Diagnosis**:

1. **Check last refresh time**
   - Look for timestamp in FirstTry header
   - Should be recent (minutes ago, not hours)

2. **Verify Jira data isn't stale**
   - Check issue description/status directly
   - Is it current?
   - If not, Jira data is stale (CDN/cache issue)

**Solutions**:

1. **Force refresh**
   - Click the 🔄 Refresh button in FirstTry header
   - Wait 3-5 seconds

2. **Clear browser cache**
   - Ctrl+Shift+Delete (or Cmd+Shift+Delete)
   - Select "All time"
   - Clear "Cookies and other site data"
   - Refresh page

3. **Try Incognito window**
   - Open new Private/Incognito window
   - Navigate to issue
   - FirstTry will load fresh data (no cache)

4. **Try different device/browser**
   - Switch to Chrome/Firefox/Safari
   - If fresh data appears, browser cache issue confirmed

### Metrics Show "N/A" or Missing

**Symptoms**: Some or all audit metrics show "N/A", no data, or gray badges

**Causes**:
- Data not available in Jira
- Custom fields not configured
- View restriction (you can't see that field)
- Data schema change

**Solutions**:

1. **Expected "N/A" cases**
   - Issue brand new (no history) → Normal
   - Custom field not configured → Contact admin
   - Data type mismatch → Support case

2. **Verify custom fields configured**
   - Ask Jira admin: "Are audit custom fields configured?"
   - Settings > Issues > Custom fields
   - Look for FirstTry-related fields
   - If missing, FirstTry can't populate metrics

3. **Check field visibility**
   - You may not have view access to that field
   - Contact admin to grant field access

4. **Wait for next update cycle**
   - FirstTry caches some data
   - Full refresh every 5-10 minutes
   - Refresh manually with 🔄 button if needed

### Display Formatting Issues

**Symptoms**: Text garbled, special characters displaying incorrectly, layout broken

**Solutions**:

1. **Check browser encoding**
   - View > Text Encoding > UTF-8
   - Refresh page

2. **Update browser**
   - Download latest version of your browser
   - Clear cache after update
   - Retry

3. **Try different browser**
   - Chrome, Firefox, Safari all supported
   - If issue specific to one browser, report with browser version

4. **Check system font**
   - Operating system might not have required fonts
   - Usually auto-fallback to system fonts, but verify

---

## Performance

### Slow to Load / Freezes

**Symptoms**: FirstTry takes > 5 seconds to load; page freezes when FirstTry visible

**Diagnosis**:

1. **Check issue size**
   - Very large issues (many links, hundreds of comments) load slower
   - Try with simpler issue to establish baseline

2. **Check network**
   - Open browser Network tab (F12)
   - Trigger FirstTry load
   - Look for slow requests (> 2 sec)
   - Check for failed requests

3. **Check system resources**
   - Open Task Manager / Activity Monitor
   - Is CPU/memory usage high?
   - Is disk I/O high?

**Solutions**:

1. **Reduce page complexity**
   - Disable browser extensions (may interfere)
   - Close unnecessary browser tabs
   - Use Incognito window (fewer extensions)

2. **Upgrade browser**
   - Ensure you're on latest version
   - Latest browsers have better performance

3. **Upgrade system**
   - If system is slow overall, hardware may be bottleneck
   - Increase RAM if possible

4. **Contact support**
   - If only FirstTry is slow, may be bug
   - Share network waterfall (F12 > Network tab)
   - Include browser and OS version

### High Memory Usage / Browser Crash

**Symptoms**: Browser becoming unresponsive, memory constantly increasing, browser crashes

**Solutions**:

1. **Check for memory leak**
   - Open Developer Tools (F12)
   - Performance tab > Memory
   - Look for constantly rising memory
   - Take heap snapshot

2. **Close/disable other apps**
   - Browser extensions can cause memory leaks
   - Disable all extensions, retry
   - Re-enable one at a time to find culprit

3. **Use Incognito mode**
   - No extensions run in Incognito
   - Try using Incognito to confirm it's an extension

4. **Restart browser**
   - Close all windows/tabs
   - Restart browser completely
   - Reopen FirstTry

5. **Contact support**
   - If persists in Incognito on clean browser, it's a FirstTry bug
   - Share heap snapshot and browser version

---

## Export & Integration

### Cannot Export / Export Button Disabled

**Symptoms**: Export button grayed out or click does nothing

**Causes**:
- No view access (required to export)
- Browser doesn't support file download
- Issue contains unsupported characters

**Solutions**:

1. **Verify access**
   - Can you view the issue normally?
   - Can you see all FirstTry metrics?
   - If not, export won't work

2. **Try different format**
   - PDF not working? Try JSON/CSV/Markdown
   - Different formats use different mechanisms

3. **Check browser settings**
   - Settings > Privacy > File download handling
   - Ensure downloads are allowed
   - Check "Downloads" folder for file

4. **Try "Copy to Clipboard"**
   - Select ⋮ (more) > Copy as JSON
   - Paste into text editor
   - Save as .json file

5. **Try different browser**
   - Chrome → Firefox, or vice versa
   - If works in different browser, browser-specific issue

### Exported File Corrupted / Opens Wrong

**Symptoms**: Exported file is empty, garbled, wrong format, or won't open

**Solutions**:

1. **Verify file size**
   - File should be > 1 KB
   - If 0 bytes, issue was empty or export failed

2. **Try different format**
   - PDF problems? Try JSON
   - JSON problems? Try CSV
   - Different formats use different export logic

3. **Check file extension**
   - Ensure filename has correct extension (.json, .csv, .pdf, .md)
   - Some systems hide extension, verify in properties

4. **Open with correct application**
   - .pdf → PDF reader (Adobe Reader, etc.)
   - .json → Text editor or JSON viewer
   - .csv → Excel or Google Sheets
   - .md → Text editor or Markdown viewer

5. **Re-export from fresh issue**
   - Try exporting a different issue
   - Then re-export original if first works

---

## Security & Privacy

### Data Breach / Suspected Security Issue

**If you believe you found a security vulnerability**:

1. **Do NOT post on public forums**
2. **Contact security team immediately**
   - Email: security@firsttry.solutions
   - Include: description, affected component, reproduction steps
   - Do NOT include sensitive data

See [docs/security.md](../security.md) for responsible disclosure policy

### Privacy Concerns

**Q: Where is my data stored?**  
A: All FirstTry data is stored in Atlassian Forge (AWS-managed, encrypted at rest)

**Q: Can FirstTry developers see my data?**  
A: No. Forge isolation prevents any access to customer data.

**Q: Is exported data encrypted?**  
A: Data in transit is encrypted (TLS). Stored files depend on where you save them.

**Q: How long is data retained?**  
A: See [docs/privacy.md](../privacy.md) for retention policy. Generally 30-90 days.

See [docs/privacy.md](../privacy.md) for complete privacy policy

---

## Getting Help

### Gather Diagnostic Information

Before contacting support, gather:

1. **Browser info**
   - Browser name and version
   - OS (Windows/Mac/Linux)
   - Example: Chrome 125.0 on Windows 11

2. **Issue details**
   - Issue ID (e.g., PROJ-1234)
   - Can you reproduce the issue? (Yes/No)
   - What were you trying to do?

3. **Error messages**
   - Exact error text
   - Screenshot of error
   - Console errors (F12 > Console tab)

4. **Reproduction steps**
   - Step-by-step to reproduce
   - How often does it occur? (Always/sometimes/once)
   - Other issues reported by users?

### Support Channels

| Issue Type | Channel | Response Time |
|-----------|---------|----------------|
| **General support** | [GitHub Issues](https://github.com/firsttry-io/jira-audit-app/issues) | Best-effort |
| **Security issues** | security@firsttry.solutions | 24-48 hours priority |
| **Feature requests** | GitHub Discussions | Community-driven |
| **Bug reports** | GitHub Issues | Best-effort |

### Escalation

If issue persists after troubleshooting:

1. Create GitHub Issue with:
   - Detailed description
   - Reproduction steps
   - Diagnostic information (above)
   - Screenshots/console errors

2. Include:
   - Issue key (e.g., FOO-123)
   - Browser + OS version
   - What you tried to fix it

3. Community may respond with solutions
4. FirstTry team will triage and prioritize

---

## Common Solutions Checklist

Use this checklist for any issue:

- [ ] Refresh page (F5 / Cmd+R)
- [ ] Clear browser cache (Ctrl+Shift+Delete)
- [ ] Try different browser
- [ ] Try Incognito/Private window
- [ ] Try different issue
- [ ] Try different project
- [ ] Verify you can see the issue normally
- [ ] Check Settings > Apps > FirstTry is "Enabled"
- [ ] Check browser errors (F12 > Console)
- [ ] Restart browser completely
- [ ] Contact support if still failing

---

**Version**: 2.14.0  
**Last Reviewed**: 2026-03-09
