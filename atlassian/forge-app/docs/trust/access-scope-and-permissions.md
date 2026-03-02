# Access Scope & Permissions

**Last updated: 2026-03-02**

This document details the specific Jira permissions and Forge scopes used by FirstTry.

## Forge scopes

FirstTry declares the following Forge API scopes in `manifest.yml`:

### Required scopes

```yaml
permissions:
  scopes:
    - read:jira-user        # Read user and group information
    - read:jira-work        # Read projects, permissions, audit logs
    - storage               # Store scan results (tenant-isolated)
```

### Scope justification

| Scope | Purpose | Data Accessed | Why Needed |
|-------|---------|---------------|------------|
| `read:jira-user` | User/group analysis | User IDs, display names, group memberships | Identify admins and shadow admins |
| `read:jira-work` | Project/permission analysis | Projects, permission schemes, audit logs | Detect misconfigurations |
| `storage` | Persist results | Scan metadata only | Save results for historical comparison |

## Read-only guarantees

FirstTry makes **zero write operations** to Jira:

### What we CAN do
- ✅ Read user and group information
- ✅ Read project configurations
- ✅ Read permission schemes
- ✅ Read audit log events
- ✅ Store results in Forge Storage (isolated from Jira)

### What we CANNOT do
- ❌ Create, modify, or delete users
- ❌ Create, modify, or delete projects
- ❌ Change permission schemes
- ❌ Modify group memberships
- ❌ Delete or alter audit logs
- ❌ Create Jira issues or comments
- ❌ Modify any Jira configuration

### Enforcement

Read-only behavior is enforced at **multiple layers**:

1. **Scope limitation**: Forge manifest declares only `read:*` scopes
2. **Platform enforcement**: Atlassian Forge rejects write API calls
3. **Code design**: Application code does not attempt write operations
4. **Audit verification**: See [05_audit_runbook.md](../ops/05_audit_runbook.md) for deterministic verification

## External network interactions

**Note:** External URL patterns detected in source code (`src/resolvers/phase2_config.ts`) are used for input validation only (e.g., `ALLOWED_WEBHOOK_ORIGINS` constant). These are not egress endpoints - actual webhook URLs are provided by users via environment configuration, not hardcoded.

### Verification

**Deterministic proof**: Run offline URL scan to inventory literal URL strings:

```bash
cd atlassian/forge-app
bash tools/marketplace/inventory_external_urls.sh
```

The scan detects:
- URL literals in source files (categorized as runtime vs. non-runtime)
- Excludes test files, documentation, and tooling
- Classification: validation patterns vs. actual egress destinations

## API call patterns

FirstTry uses Jira APIs in specific patterns:

### User/group APIs

```typescript
// Read user information (admin context only)
GET /rest/api/3/user
GET /rest/api/3/group
GET /rest/api/3/group/member

// Purpose: Identify administrators and shadow admins
// Frequency: Once per scan
// Data collected: User IDs, display names, group memberships
```

### Project/permission APIs

```typescript
// Read project configurations
GET /rest/api/3/project
GET /rest/api/3/project/{projectKey}/role
GET /rest/api/3/permissionscheme

// Purpose: Detect overly permissive configurations
// Frequency: Once per scan
// Data collected: Project keys, permission schemes, role assignments
```

### Audit log APIs

```typescript
// Read administrative actions
GET /rest/api/3/auditing/record

// Purpose: Timeline reconstruction and compliance verification
// Frequency: Once per scan (filtered to admin events only)
// Data collected: Timestamps, event types, admin action categories
```

## Data access transparency

Every API call made by FirstTry is:

1. **Logged in Jira audit logs**: Customers can see all API access
2. **Read-only**: No modification operations
3. **Admin-scoped**: Only accesses admin-level data (users, groups, projects)
4. **On-demand**: Triggered manually by customer, not automatic

### Jira audit log example

```json
{
  "author": "firsttry-app",
  "remoteAddress": "forge-runtime",
  "created": "2026-03-02T10:30:00Z",
  "summary": "User retrieved: admin@customer-domain.com",
  "category": "user management",
  "eventSource": "Forge App",
  "objectItem": {
    "typeName": "USER"
  }
}
```

## Permission boundaries

FirstTry respects Jira's permission model:

### App user permissions

The Forge app executes with:
- **Context**: Jira admin context (inherited from installing user)
- **Scope**: Limited to `read:*` API scopes
- **Isolation**: Tenant-level isolation (cannot access other customers)

### Customer admin requirements

To install FirstTry, you must have:
- Jira admin privileges (site admin or org admin)
- Permission to install Forge apps
- Ability to approve API scope requests

### Non-admin users

Non-admin users:
- Cannot install or configure FirstTry
- Cannot trigger scans (admin-only operation)
- Cannot view scan results (future: role-based access may be added)

## Scope evolution

### Current scopes (v1.x)

```
read:jira-user
read:jira-work
storage
```

### Planned scopes (future)

We may request additional scopes in future versions:

| Potential Scope | Purpose | Customer Approval Required |
|-----------------|---------|----------------------------|
| `read:audit-log` (new scope tier) | Enhanced audit analysis | Yes (explicit re-approval) |
| `manage:jira-configuration` (hypothetical) | Auto-remediation feature | Yes (would require new approval) |

**Commitment**: Any scope change will:
1. Require explicit customer approval via Atlassian Marketplace
2. Be documented in release notes and changelog
3. Include detailed justification and impact analysis
4. Provide opt-out mechanism (customers can decline update)

## Third-party access

FirstTry shares **zero data** with third parties:

- ❌ No analytics providers (Google Analytics, Mixpanel, etc.)
- ❌ No error tracking services (Sentry, Rollbar, etc.)
- ❌ No AI/ML services (no OpenAI, no model APIs)
- ❌ No marketing tools (no tracking pixels, no retargeting)

**Note:** External URL patterns detected in source are for input validation (e.g., webhook origin checking). Actual service integrations, if configured, are provided via environment/storage, not hardcoded. For network details, see [Security](security.md).

**All processing occurs within Atlassian Forge platform.**

## Compliance alignment

Our scope and permission design aligns with:

- **GDPR Article 5(1)(c)**: Data minimization (only collect what's needed)
- **GDPR Article 25**: Privacy by design (read-only by default)
- **GDPR Article 32**: Security (tenant isolation, platform-managed encryption)
- **SOC 2**: Access control, least privilege principle
- **ISO 27001**: Access management (documented scope rationale)

## Customer verification

Verify our claims:

1. **Review manifest.yml**: See declared scopes in repository
2. **Check Marketplace listing**: Atlassian displays requested permissions
3. **Run audit verification**: `bash tools/audit/v3_1/run_deterministic.sh`
4. **Inspect Jira audit logs**: See actual API calls made by FirstTry

## Contact

Questions about permissions or scope usage?
- GitHub Issues: https://github.com/Firsttry-Solutions/Firsttry/issues
- Security concerns: See [SECURITY_CONTACT.md](SECURITY_CONTACT.md)

---

**For comprehensive technical details, see:**
- [SECURITY_OVERVIEW.md](SECURITY_OVERVIEW.md) - Security architecture
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [Manifest Scopes](generated/manifest_scopes.md) - Forge app manifest with declared scopes

<!-- BEGIN: GENERATED_FACTS -->
### Scopes (Generated)

**Manifest scopes (as of 2026-03-02):**
- `read:jira-user, read:jira-work, storage:app`

**Purpose:**
- `read:jira-user`: Read user profile information
- `read:jira-work`: Read issue and project data
- `storage:app`: Store app configuration and audit trail

### Write Capabilities (Generated)

**Webtrigger:** Yes
**Storage API calls detected:** 100

This app uses Forge storage API for audit trail and configuration. While scopes are read-only for Jira data, the app can write to its own isolated storage partition.
<!-- END: GENERATED_FACTS -->
