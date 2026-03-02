# Data Processing

**Last updated: 2026-03-02**

> This document describes data processing architecture. For detailed technical specifications, see **[DATA_FLOW.md](DATA_FLOW.md)** and **[ARCHITECTURE.md](ARCHITECTURE.md)**.

## Data flow

FirstTry implements a strict read-only, ephemeral processing model:

### Scan execution flow

```
┌─────────────────┐
│  Jira Cloud     │
│  (Read-only)    │
└────────┬────────┘
         │ API calls (read scopes only)
         ▼
┌─────────────────┐
│  Forge Runtime  │◄──── Ephemeral compute (stateless)
│  (Processing)   │
└────────┬────────┘
         │ Write results
         ▼
┌─────────────────┐
│  Forge Storage  │◄──── Tenant-isolated KV store
│  (Persistence)  │
└─────────────────┘
```

### Data flow stages

1. **Input**: Read Jira admin data via Forge APIs
2. **Processing**: Analyze in-memory (no external writes)
3. **Output**: Generate HTML report + write metadata to Forge storage
4. **Deletion**: Ephemeral data auto-cleared after function exit

## Storage locations

All data resides within Atlassian infrastructure:

| Data Type | Storage Location | Encryption | Retention |
|-----------|------------------|------------|-----------|
| **Source data** | Customer's Jira Cloud instance | TLS in-transit, AES-256 at-rest (Atlassian) | Per customer Jira retention |
| **Scan metadata** | Forge Storage (tenant-isolated) | AES-256 at-rest (Atlassian) | Until deletion or uninstall |
| **Report HTML** | Generated on-demand (not stored) | In-memory only | Ephemeral (cleared after render) |
| **Logs** | Forge platform logs | Encrypted by Atlassian | 90 days (Atlassian retention) |

### Geographic locations

- **Data residency**: Same region as customer's Jira Cloud instance
- **Forge execution**: Typically same region as Jira (controlled by Atlassian)
- **No cross-region transfers**: Data stays in customer's region
- **No external egress**: Zero data leaving Atlassian platform

## Processing purposes

FirstTry processes data for these exclusive purposes:

### 1. Security misconfiguration detection

- Identify shadow administrators and privilege escalation risks
- Detect overly permissive project configurations
- Analyze permission scheme anomalies

### 2. Compliance reporting

- Generate audit-ready HTML reports
- Produce evidence artifacts (timestamps, entity counts, hashes)
- Create remediation guidance

### 3. Historical tracking

- Store scan results for trend analysis
- Compare current vs. previous configurations
- Detect configuration drift over time

### Non-purposes (what we DON'T do)

- ❌ No analytics or telemetry collection
- ❌ No marketing or advertising use
- ❌ No selling or sharing with third parties
- ❌ No training machine learning models
- ❌ No cross-tenant analysis or aggregation

## Data minimization

FirstTry implements strict data minimization:

| Data Category | What We Collect | What We DON'T Collect |
|---------------|-----------------|----------------------|
| **Users** | User IDs, display names, account IDs | Passwords, emails, profile photos, personal details |
| **Projects** | Project keys, names, permission schemes | Issue content, comments, attachments, custom fields |
| **Groups** | Group names, member counts, IDs | Group membership details beyond admin context |
| **Audit logs** | Administrative action timestamps, types | Full audit payload, IP addresses, user agents |

## Processing principles

### Read-only access

- **API scopes**: `read:jira-user`, `read:jira-work` (admin context only)
- **No write operations**: Cannot modify Jira data
- **No delete operations**: Cannot remove Jira entities
- **No create operations**: Cannot add users, projects, permissions

### Ephemeral processing

- **Stateless functions**: Each scan execution is isolated
- **No persistent memory**: Data cleared after function exit
- **No shared state**: No cross-request data sharing
- **Deterministic**: Same inputs always produce same outputs

### Tenant isolation

- **Tenant key prefix**: All Forge storage keys prefixed with tenant ID
- **Access control**: Forge platform enforces tenant boundaries
- **No cross-tenant**: Cannot access other customers' data
- **Platform-enforced**: Isolation guaranteed by Atlassian, not application code

## Data lifecycle

```
[Scan Triggered]
    ↓
[API Read: Jira data] ──────► (Ephemeral memory)
    ↓
[Process: Analyze] ──────────► (Ephemeral memory)
    ↓
[Generate: HTML report] ─────► (Rendered to user, not stored)
    ↓
[Store: Scan metadata] ──────► (Forge Storage, tenant-isolated)
    ↓
[Clear: Ephemeral data] ─────► (Auto-cleared on function exit)
```

**Retention**: Scan metadata retained until manual deletion or app uninstall

**Deletion**: See [Data Retention & Deletion](data-retention-deletion.md)

## Customer controls

Customers have full control over data processing:

1. **Scan execution**: Manually triggered (no automatic scanning)
2. **Data deletion**: Delete scan results anytime via in-app UI
3. **Access revocation**: Uninstall app to immediately revoke all access
4. **Audit trail**: Jira audit logs record all FirstTry API calls

## Legal basis (GDPR)

For EU customers, our legal basis for processing:

- **Legitimate interest**: Security monitoring and compliance (Article 6(1)(f))
- **Contract performance**: Providing requested security scanning service (Article 6(1)(b))
- **Explicit consent**: Optional data processing requires customer initiation

## Data subject rights

Customers and their users have rights under GDPR/CCPA:

- **Right to access**: View scan results in-app or export
- **Right to deletion**: Delete scan results or uninstall app
- **Right to rectification**: Source data correction done in Jira (not FirstTry)
- **Right to object**: Uninstall app to cease processing

See [Privacy Policy](privacy-policy.md) for more on data subject rights.

---

**For comprehensive technical details, see:**
- [DATA_FLOW.md](DATA_FLOW.md) - Complete data flow specification
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [UNINSTALL_DELETION.md](UNINSTALL_DELETION.md) - Deletion behavior

<!-- BEGIN: GENERATED_FACTS -->
### Outbound Egress (Generated)

**Runtime external URL literals in src/:** 90

**Offline source scan (as of 2026-03-02):** Detected 90 external URL literal(s) in src/ (see evidence: /tmp/ft_marketplace_trustfacts_20260302T081657Z_19103/verifiers/01_scan/runtime_urls.txt).

**Classification:** URL literals found in src/resolvers/phase2_config.ts are input validation patterns (ALLOWED_WEBHOOK_ORIGINS), not actual egress endpoints. Actual external service URLs, if configured, are provided via environment/Forge storage, not hardcoded.

**Note:** This scan detects literal strings only. Dynamic URL construction or environment-based configuration is not detected.
<!-- END: GENERATED_FACTS -->
