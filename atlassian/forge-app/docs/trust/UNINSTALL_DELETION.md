# Uninstall and Data Deletion

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual

---

## Customer Reproducible Deletion Workflow

To trigger deletion of FirstTry data from your Jira Cloud site:

### Step 1: Navigate to App Management
1. Log in to Jira Cloud as a Jira administrator
2. Click **Settings** (gear icon) → **Apps**
3. Select **Manage apps** (or **Apps management**)
4. Search for "FirstTry"

### Step 2: Uninstall the App
1. Locate the FirstTry entry in the installed apps list
2. Click **Uninstall**
3. Confirm uninstall in the dialog

### Step 3: Verify Deletion
- Once uninstalled, no FirstTry data is visible in Jira
- Uninstall triggers background data cleanup in Atlassian Forge Storage
- **Note**: Verification of actual deletion in backup systems is not available to customers

---

## Data Deletion SLA and Platform Dependency

**FirstTry commitment**:
- Immediate: Uninstall removes app access to Forge Storage
- Immediate: Uninstall triggers app cleanup handler (clears Forge Storage KV store)

**Atlassian responsibility** (we depend on):
- Within 30 days of uninstall: Customer data is removed from Forge Storage backups
- Exact timeline and backup duration: Governed by Atlassian SLA (see pinned URL below)

**Caveat (IMPORTANT)**:
> Data deletion timelines are dependent on Atlassian Forge platform SLA and backup policies. FirstTry cannot independently verify deletion from Atlassian backup systems. Customers must trust Atlassian's published SLA and terms.

**Reference**: Atlassian Service Level Agreement (pinned URL: `https://www.atlassian.com/legal/service-level-agreement`)

---

## What Proof Exists

### Evidence of Immediate Deletion
- ✅ App uninstall removes Forge Storage access permissions
- ✅ Uninstall handler clears Forge Storage KV store (FirstTry code triggers this)
- ✅ Git commit history shows uninstall handler implementation

### Evidence of Backup Deletion
- ❌ Not available. Backup deletion is managed by Atlassian; FirstTry has no independent verification mechanism.

### Audit Trail
- ✅ Forge Storage deletion can be confirmed by:
  1. Uninstalling app
  2. Reinstalling app
  3. Confirming no prior snapshots are visible (empty Forge Storage)

---

## Manual Deletion Without Uninstall

**Option 1: Uninstall and Reinstall** (recommended)
- Only reliable method to clear all FirstTry data
- Triggers platform-managed deletion SLA

**Option 2: Forge CLI (Advanced)**
- Requires access to Atlassian Forge CLI on local machine
- Requires permission to manage the Jira Cloud site via OAuth2
- Command: `forge settings delete` (app-specific, clears Forge Storage)
- Requires developer/IT knowledge; not recommended for non-technical admins

**Option 3: Export and Manual deletion**
- Download all exports from FirstTry gadget
- Delete exports externally from your systems
- **Note**: Does not delete data from Forge Storage; only removes exported copies from your systems

---

## Disaster Recovery and Uninstall Consequences

**Before uninstalling, consider**:
- All snapshots stored in FirstTry will be deleted
- Any compliance evidence not previously exported will be lost
- Uninstall is permanent; reinstall creates new empty Forge Storage

**Recommended practice**:
1. Export all compliance evidence (download export ZIP from gadget)
2. Store export ZIP on your infrastructure (outside Forge)
3. Then uninstall app if desired

---

## References

- [DATA_CLASSIFICATION_AND_PII.md](DATA_CLASSIFICATION_AND_PII.md): PII inventory and handling
- [DATA_FLOW.md](DATA_FLOW.md): Data storage and deletion points
- [FORGE_PLATFORM_DEPENDENCY.md](FORGE_PLATFORM_DEPENDENCY.md): Platform SLA and dependencies
