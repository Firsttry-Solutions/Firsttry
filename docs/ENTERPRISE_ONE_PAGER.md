# Enterprise One-Pager: FirstTry - Audit Evidence Snapshot for Jira

## Audience & Scope

**Audience**: Executive leadership, procurement teams, and technical decision-makers evaluating FirstTry for organizational deployment.

**Scope**: This document provides a high-level overview of FirstTry capabilities, security posture, and operational model. It is designed for busy stakeholders who need a complete understanding of what FirstTry is and does without deep technical detail. It does NOT include implementation procedures, deployment workflows, or detailed technical architecture.

## Executive Summary

FirstTry is a read-only Jira governance application that provides real-time visibility into project governance and readiness status. It runs on Atlassian Forge and delivers governance snapshots, policy compliance tracking, and historical evidence ledgers without modifying any Jira data. All capabilities are uniform across deployments with no feature-tier differentiation.

## What This Covers

- What FirstTry is and core value propositions
- Key governance capabilities
- Security posture and architectural principles
- Operational model and deployment approach
- Support and roadmap vision
- Where to find detailed documentation for each topic

## What This Explicitly Does NOT Cover

- Technical implementation details or architecture
- Deployment procedures or configuration instructions
- Support scope boundaries (see Support Policy)
- Detailed pricing or cost forecasting (see Pricing Rationale)
- Feature roadmap details (see Roadmap document)
- Organizational change management procedures

## Core Assertions

- **FirstTry is Read-Only**: All Forge manifest scopes are restricted to `storage:app` and `read:jira-work`. No write, delete, or state-modification operations are supported.
  - Proof: [manifest.yml:L58-L61](../atlassian/forge-app/manifest.yml#L58-L61)

- **FirstTry Provides Deterministic Verification**: Every deployment is cryptographically verified via freeze-lock mechanism, enabling reproducible audits.
  - Proof: [verify_freeze_lock.sh](../atlassian/forge-app/audit/verify_freeze_lock.sh)

- **FirstTry Enforces Uniform Feature Availability**: No feature-tier licensing or entitlement-based capabilities exist. All customers access identical functionality.
  - Proof: [manifest.yml](../atlassian/forge-app/manifest.yml) (no tier logic)

- **FirstTry Includes Non-Bypassable Audit Gates**: Reviewer readiness gate enforces manifest validation, write-surface scanning, and freeze verification.
  - Proof: [reviewer_ready_gate.sh:L1-L230](../atlassian/forge-app/audit/reviewer_ready_gate.sh#L1-L230)

## Key Capabilities

| Capability | Description |
|---|---|
| **Real-Time Status Dashboard** | Live governance status dashboard gadget deployed to Jira Cloud dashboards |
| **Scheduled Evidence Pipelines** | Deterministic daily/weekly governance snapshots locked to freeze-verified commits |
| **Deterministic Verification** | Non-bypassable freeze-lock mechanism for reproducible artifact verification |
| **Read-Only Architecture** | All operations restricted to read-only Jira API scopes; no write, delete, or state-modification capabilities |
| **Audit Integration** | Mandatory reviewer readiness gates enforcing manifest validation, dependency scanning, and freeze verification |

## Technical Stack

- **Runtime**: Atlassian Forge (Node.js 20.x)
- **Frontend**: Vite bundled dashboard gadget
- **Manifest Scopes**: `storage:app`, `read:jira-work` only
- **Scheduled Tasks**: Daily and weekly triggered pipelines
- **Evidence Storage**: Forge app storage with deterministic verification

## Security Posture

- **Scope-Restricted**: No write, manage, admin, or delete scopes declared in manifest
- **Read-Only API Surface**: Zero write-surface APIs outside test code
- **Tenant-Isolated Storage**: All storage calls enforced through tenant-keyed wrapper functions. Cross-tenant access cryptographically prevented by namespace isolation.
  - Proof: [tenant_context.ts:L36-L52](../atlassian/forge-app/src/security/tenant_context.ts#L36-L52), [tenant_storage.ts:L56-L91](../atlassian/forge-app/src/security/tenant_storage.ts#L56-L91), [p1_tenant_isolation.test.ts](../atlassian/forge-app/tests/p1_tenant_isolation.test.ts) (24 tests, all passing)
- **Deterministic Verification**: Freeze-lock enables reproducible state verification
- **Change Control**: All changes bound to cryptographically verified freeze commits
- **Dependency Audited**: Mandatory NPM vulnerability scanning with waiver enforcement

## Operational Model

1. **Deployment**: Deploy to Jira Cloud via Forge CLI
2. **Verification**: Run `./audit/verify_freeze_lock.sh` to verify deployment payload matches published freeze commit
3. **Auditing**: Access frozen evidence snapshots from evidence ledger
4. **Monitoring**: Dashboard gadget provides live governance status

## What FirstTry Does NOT Include

- Write operations on Jira data
- Feature-tier gating or entitlement enforcement
- Conditional security based on subscription level
- Custom authentication or authorization logic
- Cloud infrastructure security (AWS responsibility)

## Compliance & Governance

| Aspect | Status |
|--------|--------|
| **Manifest Scope Validation** | Enforced by reviewer readiness gate |
| **Write-Surface Audit** | Scanned and blocked in CI gate |
| **Dependency Vulnerabilities** | Automatic NPM audit; HIGH/CRITICAL blocked unless waivered |
| **Freeze Verification** | Deterministic, non-bypassable |
| **Claims Ledger** | Maintained in audit directory; no MISSING statuses allowed |

## Support Model

Technical support is provided through [SUPPORT_POLICY.md](SUPPORT_POLICY.md). FirstTry support covers troubleshooting, configuration guidance, and operational questions. Support scope is defined in the support policy document. No contractual SLAs or response-time commitments are defined in this repository.

## Contact & Resources

- **Documentation**: [docs/DOCS_INDEX.md](DOCS_INDEX.md)
- **Security Details**: [docs/SECURITY_SUMMARY.md](SECURITY_SUMMARY.md)
- **Roadmap**: [docs/ROADMAP.md](ROADMAP.md)
- **Change Management**: [docs/CHANGE_MANAGEMENT.md](CHANGE_MANAGEMENT.md)

## Explicit Negative Assertions

- **FirstTry does NOT perform write operations on Jira data**: All scopes are read-only. No create, update, delete, or state-modification operations are supported.

- **FirstTry does NOT include feature-tier gating or entitlement enforcement**: All customers access identical capabilities regardless of deployment size or subscription level.

- **FirstTry does NOT require custom authentication or authorization implementation**: Authentication is delegated to Atlassian Forge. The application receives pre-authenticated requests.

## Proof Anchors

| Claim | Location |
|-------|----------|
| Read-only manifest scopes | [manifest.yml:L58-L61](../atlassian/forge-app/manifest.yml#L58-L61) |
| Deterministic freeze-lock verification | [verify_freeze_lock.sh](../atlassian/forge-app/audit/verify_freeze_lock.sh) |
| Non-bypassable reviewer readiness gate | [reviewer_ready_gate.sh:L1-L230](../atlassian/forge-app/audit/reviewer_ready_gate.sh#L1-L230) |
| Manifest with no tier logic | [manifest.yml](../atlassian/forge-app/manifest.yml) |
| Evidence storage mechanism | [manifest.yml:L62-L63](../atlassian/forge-app/manifest.yml#L62-L63) |
| Tenant isolation context derivation | [tenant_context.ts:L36-L52](../atlassian/forge-app/src/security/tenant_context.ts#L36-L52) |
| Tenant-prefixed storage key generation | [tenant_storage.ts:L56-L91](../atlassian/forge-app/src/security/tenant_storage.ts#L56-L91) |
| Tenant isolation unit tests (24 passing) | [p1_tenant_isolation.test.ts](../atlassian/forge-app/tests/p1_tenant_isolation.test.ts) |

---

**Document Version**: 1.0 | **Updated**: 2026-01-11 | **Audience**: Enterprise Procurement & Technical Leadership
