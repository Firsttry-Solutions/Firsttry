# FirstTry - Audit Evidence Snapshot for Jira

## Short Description

Read-only Jira governance application providing policy compliance tracking, evidence snapshots, and deterministic audit verification with no data modification.

---

## Long Description

FirstTry is a read-only Jira governance application that delivers real-time visibility into project governance and readiness status without modifying any Jira data. It runs on Atlassian Forge and provides:

- **Real-time governance dashboards**: Live policy compliance status and governance metrics
- **Deterministic evidence snapshots**: Timestamped, immutable governance records (locked to cryptographically verified code commits)
- **Policy freeze-lock verification**: Non-bypassable audit gates ensuring reproducible governance state at any deployment
- **Cross-tenant isolation**: Workspace-scoped data isolation enforced by Forge platform; no cross-tenant data access
- **Read-only architecture**: All operations restricted to read-only Jira API scopes; no data modification, state changes, or write operations

**For procurement teams & compliance officers**: FirstTry is designed for organizations requiring deterministic proof of governance state, immutable audit trails, and zero-modification architecture.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Real-Time Governance Dashboard** | Live policy compliance dashboard gadget with status indicators |
| **Scheduled Evidence Snapshots** | Deterministic daily/weekly governance evidence collections |
| **Immutable Audit Ledger** | Append-only event log with cryptographic verification (A3: UUID-based enforcement) |
| **Deterministic Verification** | Freeze-lock mechanism proving deployment payload matches published code commit |
| **No Data Modification** | Zero write/delete operations on Jira data; read-only API surface enforced |
| **Uniform Features** | All customers access identical capabilities; no feature-tier gating |

**See**: [docs/ENTERPRISE_ONE_PAGER.md](ENTERPRISE_ONE_PAGER.md) for detailed capability list.

---

## Requested Scopes (Permissions)

FirstTry declares exactly **two (2) scopes** in the Atlassian Forge manifest:

| Scope | Purpose | Justification |
|-------|---------|---------------|
| **`storage:app`** (Read/Write) | Store governance evidence, metrics, and audit trails in Forge storage | Necessary for persistence; minimal (not storage:cloud); tenant-isolated by Forge |
| **`read:jira-work`** (Read-Only) | Read policy configurations and compute governance metrics | Read-only; no write/delete operations; no access to user data or issues |

**Canonical source**: [docs/SCOPES.md](SCOPES.md#declared-scopes-manifest--proof-anchors)  
**Manifest proof**: [atlassian/forge-app/manifest.yml#L61-L65](../atlassian/forge-app/manifest.yml#L61-L65)

### Explicitly NOT Requested (Security Model)

FirstTry **does not** request any of these scopes, ensuring a minimal, read-only security posture:

- ❌ `write:jira-work` (no data modification)
- ❌ `manage:jira-configuration` (no configuration changes)
- ❌ `read:jira-user` (no user data access)
- ❌ `admin:jira-migration` (no admin operations)
- ❌ `external:fetch` (no external API calls)
- ❌ Authentication/token management scopes

**Canonical source**: [docs/SCOPES.md#explicitly-not-requested-6-blocked-scopes](SCOPES.md#explicitly-not-requested-6-blocked-scopes)

---

## Data Handling & Storage

FirstTry collects and stores **only governance-related data**, with explicit PII minimization:

### Data Stored (in Forge app storage)
- Policy configurations (user-provided rules)
- Governance snapshot metadata (timestamps, status, compliance results)
- Audit event ledger (policy decisions, no user IDs)
- Metrics computations (counts, hashes, no sensitive fields)

### Data NOT Stored
- ❌ User passwords or secrets
- ❌ Email addresses
- ❌ API tokens or credentials
- ❌ User IDs in logs (replaced with tenant context)
- ❌ Jira issue content or summaries
- ❌ PII-sensitive fields (IP addresses, emails are hashed before storage)

### Storage Security
- **Encryption at rest**: Atlassian Forge platform (AES-256, AWS-managed)
- **Encryption in transit**: TLS 1.2+ (Jira Cloud → FirstTry → Forge)
- **Tenant isolation**: Workspace-scoped storage keys; Forge platform prevents cross-tenant access
- **Data retention**: Per policy; configurable TTL on temporary records
- **Audit logging**: Immutable, append-only event trail (UUID-based immutability enforcement)

**Canonical source**: [docs/SECURITY_SUMMARY.md#data-protection](SECURITY_SUMMARY.md#data-protection)

---

## Read-Only Operational Model

FirstTry operates as a **pure read-only application** with zero write operations on Jira data:

### What FirstTry CAN Do
- ✅ Read policy configurations from Jira
- ✅ Compute governance metrics
- ✅ Display status dashboards
- ✅ Export evidence snapshots
- ✅ Audit and verify state

### What FirstTry CANNOT Do
- ❌ Modify, create, or delete Jira issues
- ❌ Change project settings or configurations
- ❌ Create user accounts or assignments
- ❌ Write to Jira endpoints
- ❌ Perform state-changing operations
- ❌ Trigger workflows or transitions

**Validated by**: [atlassian/forge-app/audit/reviewer_ready_gate.sh](../atlassian/forge-app/audit/reviewer_ready_gate.sh#L182-L192) (Check 3C: write-surface ban)

---

## Tenant Isolation & Multi-Workspace Safety

FirstTry is **workspace-scoped** and operates securely in multi-tenant environments:

- **Tenant Isolation**: Each workspace gets isolated Forge storage; FirstTry cannot read other workspaces' data
- **Key Namespace Enforcement**: Storage keys are tenant-prefixed; no cross-tenant key access possible
- **Fail-Closed Design**: Invalid tenant context results in exception (no fallback to "default" tenant)
- **No Cross-Workspace Privileges**: FirstTry respects Jira's permission model; only sees data the Jira admin allows

**Proof**: [docs/SECURITY_SUMMARY.md#tenant-isolation](SECURITY_SUMMARY.md#tenant-isolation)  
**Implementation**: [atlassian/forge-app/src/security/tenant_context.ts](../atlassian/forge-app/src/security/tenant_context.ts#L36-L52) (fail-closed derivation) + [atlassian/forge-app/tests/p1_tenant_isolation.test.ts](../atlassian/forge-app/tests/p1_tenant_isolation.test.ts) (24 tests, all passing)

---

## Immutability & Audit Trail Guarantees

FirstTry maintains **append-only, immutable audit records** to prevent tampering:

### Immutability Mechanism (A3)
- **Audit events**: Each event assigned cryptographically random UUID (no overwrites possible)
- **Snapshot records**: Deterministic ID from content hash (same content → same ID → idempotent writes)
- **No modifications**: Once written, events cannot be changed or deleted by application code
- **Forge isolation**: Platform-enforced storage isolation prevents unauthorized access

**Proof**: [docs/SECURITY_SUMMARY.md#audit-trail](SECURITY_SUMMARY.md#audit-trail)  
**Code implementation**: [atlassian/forge-app/src/audit/audit_events.ts](../atlassian/forge-app/src/audit/audit_events.ts#L211-L214) (UUID generation) + [atlassian/forge-app/tests/a3_immutability_guarantee.test.ts](../atlassian/forge-app/tests/a3_immutability_guarantee.test.ts) (10 tests, all passing)

---

## Explicit Limitations

### FirstTry Does NOT Provide

- ❌ **Feature-tier gating**: All customers access identical capabilities
- ❌ **Custom authentication**: Delegates to Jira/Atlassian Forge
- ❌ **End-to-end encryption**: Data encryption managed by Atlassian Cloud (TLS in transit, AES-256 at rest)
- ❌ **Custom retention policies**: Uses Forge default retention model
- ❌ **Role-based access control**: Respects Jira admin scoping only
- ❌ **API for external systems**: No external API exposure
- ❌ **Custom branding**: Uses Forge standard UI components

### Known Constraints

- **Scope restricted**: Can only read policy configurations and governance data (no write/delete on Jira)
- **Workspace-scoped**: Cannot cross workspace boundaries
- **Forge dependency**: Requires Atlassian Forge runtime (Cloud only, not Data Center compatible)
- **Scheduled operations**: Daily/weekly snapshots only (no real-time event streaming)

---

## Who Should Install FirstTry?

### Good Fit ✅

- Organizations requiring **immutable governance audit trails**
- Teams managing **policy compliance verification** at scale
- Enterprises needing **deterministic, reproducible governance state**
- Compliance-heavy industries (finance, healthcare, regulated tech)
- Teams wanting **zero data modification risk** (read-only architecture)

### Not Recommended ❌

- Organizations requiring **write operations on Jira** (FirstTry is read-only)
- On-premises Jira deployments (Forge is Cloud-only)
- Teams with **real-time event processing needs** (scheduled snapshots only)
- Deployments requiring **custom feature tiers** (all customers identical)
- Scenarios where **authentication customization** is needed (Forge-managed)

---

## Support & Service Level Agreement

FirstTry is provided on a **community support basis** with transparent scope boundaries.

### What's Supported
- **Bug reports**: Reproducible issues in the application code
- **Security issues**: Report privately via maintainers
- **Documentation clarifications**: Manifest scopes, architectural decisions
- **Deployment verification**: Confirming freeze-lock integrity

### What's NOT Supported
- **SLA guarantees**: No response time commitments
- **Premium support tiers**: Not available
- **Custom feature development**: Not available; FirstTry does not make forward-looking commitments
- **Jira integration extensions**: Limited to standard Forge APIs
- **Configuration consulting**: Users responsible for policy setup

**Canonical source**: [docs/SUPPORT_POLICY.md](SUPPORT_POLICY.md)

---

## Security & Compliance Summary

### Security Posture
- ✅ **Manifest scope restriction**: Only `storage:app` + `read:jira-work` (no write/delete)
- ✅ **Read-only API surface**: Zero write operations on Jira endpoints
- ✅ **Tenant-isolated storage**: Workspace-scoped keys; Forge enforces isolation
- ✅ **Immutable audit trail**: UUID-based event keys prevent overwrites
- ✅ **Deterministic verification**: Freeze-lock enables reproducible state verification
- ✅ **Dependency auditing**: Mandatory NPM vulnerability scanning; HIGH/CRITICAL requires waiver

### Compliance
- ✅ **GDPR-ready**: No PII collected; right-to-access via evidence export
- ✅ **SOC2/HIPAA**: Audit trail with immutability guarantees; encryption managed by Forge
- ✅ **Zero data modification**: Read-only architecture; no unauthorized state changes
- ✅ **Cryptographic verification**: Freeze-lock ensures reproducible deployments

**Detailed review**: [docs/SECURITY_SUMMARY.md](SECURITY_SUMMARY.md)

---

## Getting Started

1. **Install FirstTry** from the Atlassian Marketplace
2. **Grant permissions** (Jira admin only): `storage:app` + `read:jira-work` (see [docs/SCOPES.md](SCOPES.md))
3. **Configure policies** (optional): Set governance rules via admin dashboard
4. **View evidence snapshots**: Navigate to FirstTry dashboard gadget
5. **Export or audit**: Use freeze-lock verification for compliance reporting

**Full documentation**: [docs/DOCS_INDEX.md](DOCS_INDEX.md)

---

## Technical Details (For Security Teams)

**For procurement/security due diligence, see**:
- [docs/SECURITY_SUMMARY.md](SECURITY_SUMMARY.md) — Manifest scopes, API restrictions, verification mechanisms
- [docs/SCOPES.md](SCOPES.md) — Complete scope enumeration with least-privilege justifications
- [docs/ENTERPRISE_ONE_PAGER.md](ENTERPRISE_ONE_PAGER.md) — Executive overview
- [docs/PRIVACY.md](PRIVACY.md) — Data handling and GDPR/HIPAA/SOC2 compliance

**For technical verification**:
- Repository: [github.com/Firsttry-Solutions/Firsttry](https://github.com/Firsttry-Solutions/Firsttry)
- Manifest source: [atlassian/forge-app/manifest.yml](../atlassian/forge-app/manifest.yml)
- Security gates: [atlassian/forge-app/audit/reviewer_ready_gate.sh](../atlassian/forge-app/audit/reviewer_ready_gate.sh)
- Test suites: [atlassian/forge-app/tests/](../atlassian/forge-app/tests/) (34+ tests for isolation, immutability, compliance)

---

## Canonical Version

**Marketplace listing copy version**: 1.0  
**Last updated**: 2026-01-13  
**Consistency verified with**:
- ✅ [docs/SCOPES.md](SCOPES.md)
- ✅ [docs/SECURITY_SUMMARY.md](SECURITY_SUMMARY.md)
- ✅ [docs/ENTERPRISE_ONE_PAGER.md](ENTERPRISE_ONE_PAGER.md)

This file is the **canonical source** for FirstTry Marketplace copy. Any changes must be made here to prevent drift between published Marketplace text and actual capabilities/scope declarations.

---

**Repository source**: [/docs/MARKETPLACE_LISTING.md](../MARKETPLACE_LISTING.md)
