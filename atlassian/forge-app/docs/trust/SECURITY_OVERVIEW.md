# Security Overview

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual (Interim updates triggered by material security events or platform changes)

---

## Product Overview

FirstTry is an Atlassian Forge application deployed on Atlassian's managed Cloud platform. The app provides governance and compliance telemetry by reading Jira permissions, project configurations, and user context data, persisting snapshots in Forge Storage, and exporting compliance evidence to customers.

**Key characteristics**:
- Deployed via Atlassian Forge CLI (forge deploy)
- Runs within Atlassian's Forge runtime (Node.js/Deno variant)
- Accesses Jira Cloud via authenticated Forge requestJira() API only
- Stores artifacts in Forge Storage (Atlassian-managed persistence)
- No external network egress beyond Atlassian platform
- Read-only scopes declared in manifest.yml

## Shared Responsibility Model

The security posture is distributed across three parties:

### Atlassian Responsibility (Forge Platform)
- **Runtime isolation**: Process sandbox, input validation, API gating
- **API authentication**: OAuth2 token management for Jira API calls
- **Encryption**: TLS for data in transit; encryption at rest (platform-provided)
- **Infrastructure**: Data centers, DDoS mitigation, capacity management
- **Compliance**: SOC2, ISO27001, GDPR compliance at platform level
- **Subprocessor management**: CDNs, logging aggregators (see SUBPROCESSORS.md)

### Customer Responsibility (Jira Admin)
- **Site configuration**: Choosing data residency region during Atlassian Cloud setup
- **Jira permissions**: Defining user roles and project access controls (app respects these)
- **Export cadence**: Scheduling regular compliance exports and storing securely
- **Uninstall workflow**: Triggering app deletion to activate data cleanup period
- **Contact management**: Maintaining accurate security contact email in Jira

### FirstTry Responsibility (This App)
- **Scope minimization**: Declaring only read-only scopes in manifest.yml
- **API usage**: Calling only authenticated endpoints via Forge requestJira API
- **Data handling**: Storing governance snapshots only in Forge Storage
- **Export format**: Generating deterministic, signed compliance artifacts
- **Documentation**: Maintaining threat model, security policies, evidence artifacts
- **Mutation prevention**: Engineering fail-closed gates to detect scope escalation or POST/PUT/DELETE mutations

---

## Mutation/Method Claims

**Claim**: The application performs no WRITE mutations (POST, PUT, DELETE) to Jira data.

**Evidence location**: 
- Scan output: `docs/evidence/<date>_release/resolver_scan.txt`
- Inventory: `docs/trust/RESOLVER_INVENTORY.md` (lists all Jira endpoints called)

**Validation by enterprise docs gate**: Scan must not contain POST/PUT/DELETE in resolver_scan.txt, else gate fails.

**Caveat**: This claim is backed by deterministic source code scanning. Future code changes require re-generation of evidence artifacts per change management policy (docs/operations/CHANGE_MANAGEMENT_POLICY.md).

---

## Networking Claims

**Claim**: Zero external network egress in production code. All data transits authenticated Jira API (requestJira) only.

**Evidence location**:
- Scan output: `docs/evidence/<date>_release/resolver_scan.txt`
- Baseline inventory: `docs/trust/RESOLVER_INVENTORY.md`

**Validation by enterprise docs gate**: 
1. Scans for external HTTP clients (fetch, axios, node-fetch) in source code.
2. Scans for external HTTPS URLs.
3. Fail if non-test code detected.

**Limitation note**: This claim is based on static source code analysis. Dynamic runtime introspection (e.g., behavioral network taps) is not performed; reliance is placed on Forge platform network isolation guarantees.

---

## Encryption

### In Transit
- **TLS 1.3**: Atlassian platform mandates TLS for all Jira API connections
- **Certificate validation**: Performed by Forge runtime; application assumes platform enforcement
- **Attestation**: Implicit in requestJira() API contract

### At Rest
- **Forge Storage**: Atlassian-managed encrypted persistence layer
- **SHA256 integrity hashing**: Application includes deterministic content hashing for export pack integrity (see LEDGER_CRYPTO_SPEC.md)
- **No independent encryption**: Application does not encrypt data before storage (relies on platform encryption)

---

## Logging and Monitoring Boundary

**Application observability**:
- Error logging: Winston logger with tenant-ID context
- Audit trail: Append-only immutable ledger in Forge Storage
- Dashboard metrics: Real-time governance state exported to Jira UI gadget

**Platform observability** (not app responsibility):
- Forge runtime metrics (request count, latency, memory)
- API rate limit tracking
- Deployment logs (available via forge logs)

**Customer visibility**: Jira admin can inspect app health via dashboard panel and download export packs with embedded compliance markers.

---

## Evidence Pack Pointer

For detailed procurement documentation and control mapping, refer to:
- **[docs/procurement/ENTERPRISE_SECURITY_PACK_INDEX.md](../../procurement/ENTERPRISE_SECURITY_PACK_INDEX.md)**: Master index linking all trust, operations, and procurement docs.

---

## Security Contact

For security inquiries, refer to [docs/trust/SECURITY_CONTACT.md](SECURITY_CONTACT.md).

---

## Next Steps

1. **Risk assessment**: Review THREAT_MODEL.md for documented threats and mitigations.
2. **Procurement**: Use `ENTERPRISE_SECURITY_PACK_INDEX.md` for diligence questionnaire responses.
3. **Ongoing compliance**: Monitor evidence bundles in docs/evidence/ for drift and changes.
4. **Incident response**: Refer to docs/operations/INCIDENT_RESPONSE_PLAN.md if security issues arise.
