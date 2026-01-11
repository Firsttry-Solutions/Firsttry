# Security Summary

## Audience & Scope

**Audience**: Security evaluators, procurement teams, enterprise compliance offices, and IT security leaders assessing FirstTry for deployment in regulated environments.

**Scope**: This document provides authoritative facts about the security posture of FirstTry as of the current build. It covers Forge manifest scopes, API surface restrictions, deterministic verification mechanisms, and read-only operational design. It does NOT describe future security features, roadmap enhancements, or conditional capabilities.

## Executive Summary

FirstTry is a read-only Jira governance application built on Atlassian Forge. The application enforces scope restrictions at the manifest level, restricts API surface to read-only operations, and implements deterministic freeze-lock verification for auditable change control. All claims in this document are grounded in manifest configuration and architectural decisions captured in repository artifacts.

## What This Covers

- Forge manifest scope declarations (storage and read permissions only)
- API surface restrictions enforcing read-only data access
- Deterministic verification tooling and freeze-lock mechanisms
- Supply chain security practices (dependencies, audit trails)
- Explicit architectural boundaries that prevent unauthorized operations

## What This Explicitly Does NOT Cover

- Authentication/authorization implementation details (managed by Atlassian Forge)
- Cloud infrastructure security (AWS/Atlassian Cloud responsibility)
- Scheduled task security policies or orchestration details
- Network-level protections or DDoS mitigation
- Future security features or planned hardening initiatives
- Feature-tier availability or entitlement-based access controls

## Core Assertions

- **Manifest Scope Restriction**: The application declares only `storage:app` and `read:jira-work` scopes in `atlassian/forge-app/manifest.yml:lines 58-61`. No write, manage, admin, delete, or transition scopes are declared.
  - Proof: [atlassian/forge-app/manifest.yml](atlassian/forge-app/manifest.yml#L58-L61)

- **Read-Only API Surface**: All Jira API calls are restricted to read operations. No `POST`, `PUT`, `PATCH`, or `DELETE` methods are used against Jira endpoints in production code.
  - Proof: Validated by `atlassian/forge-app/audit/reviewer_ready_gate.sh` Check 3C (write-surface ban) [atlassian/forge-app/audit/reviewer_ready_gate.sh](atlassian/forge-app/audit/reviewer_ready_gate.sh#L182-L192)

- **Deterministic Verification**: A freeze-lock mechanism enables reproducible verification of application state at any commit. The `audit/generate_freeze_lock.sh` and `audit/verify_freeze_lock.sh` scripts provide non-bypassable proof of artifact integrity.
  - Proof: [atlassian/forge-app/audit/generate_freeze_lock.sh](atlassian/forge-app/audit/generate_freeze_lock.sh) and [atlassian/forge-app/audit/verify_freeze_lock.sh](atlassian/forge-app/audit/verify_freeze_lock.sh)

- **Evidence Utility Integration**: All security claims are locked into a reviewer readiness gate (`reviewer_ready_gate.sh`) that enforces manifest validation, write-surface scanning, and freeze verification non-bypassably.
  - Proof: [atlassian/forge-app/audit/reviewer_ready_gate.sh](atlassian/forge-app/audit/reviewer_ready_gate.sh#L1-L230)

- **Dependency Audit Integration**: NPM vulnerability scanning is enforced as a mandatory gate. High and critical vulnerabilities require an explicit waiver file before release.
  - Proof: [atlassian/forge-app/audit/reviewer_ready_gate.sh](atlassian/forge-app/audit/reviewer_ready_gate.sh#L165-L178)

## Operational / Security Implications

1. **Audit Trail**: Every build invokes the reviewer readiness gate, which generates deterministic proof artifacts. These proofs are stored in the evidence bundle and can be externally verified.

2. **Scope Immutability**: The manifest scopes are declared at build time and verified at deployment. Scope changes require manifest edits and rebuild, creating an audit trail in version control.

3. **Change Control**: The freeze-lock mechanism ensures that operational changes (manifest edits, dependency updates, code changes) are cryptographically bound to a specific commit SHA. This enables traceability and prevents silent modifications.

4. **Dependency Risk**: NPM dependencies are subject to automatic vulnerability scanning. Any high or critical vulnerabilities detected will block release unless explicitly waivered.

## Explicit Negative Assertions

- **This system does NOT perform write operations on Jira data**: The manifest restricts scopes to `storage:app` and `read:jira-work`. No write, delete, or state-modification scopes are declared.

- **This system does NOT include feature-tier gating or entitlement enforcement**: All security boundaries are enforced through Forge manifest scopes and architectural read-only constraints. No license checks, tier evaluations, or entitlement logic exist in the codebase.

- **This system does NOT support conditional security based on user role or subscription level**: Security restrictions are uniform across all deployments and cannot be bypassed by configuration, license, or user attributes.

- **This system does NOT provide end-to-end encryption for data in transit**: Data encryption in transit is managed by Atlassian Cloud/AWS infrastructure and is outside the scope of the FirstTry application code.

- **This system does NOT implement custom authentication or authorization logic**: All auth decisions are delegated to Atlassian Forge runtime. The application receives pre-authenticated requests from Forge.

## Proof Anchors

| Claim | Location |
|-------|----------|
| Manifest restricts scopes to read-only | [atlassian/forge-app/manifest.yml:L58-L61](atlassian/forge-app/manifest.yml#L58-L61) |
| No write-surface APIs in production code | [atlassian/forge-app/audit/reviewer_ready_gate.sh:L182-L192](atlassian/forge-app/audit/reviewer_ready_gate.sh#L182-L192) |
| Freeze-lock mechanism for deterministic verification | [atlassian/forge-app/audit/verify_freeze_lock.sh](atlassian/forge-app/audit/verify_freeze_lock.sh) |
| Mandatory NPM audit gate | [atlassian/forge-app/audit/reviewer_ready_gate.sh:L165-L178](atlassian/forge-app/audit/reviewer_ready_gate.sh#L165-L178) |
| Non-bypassable reviewer readiness gate | [atlassian/forge-app/audit/reviewer_ready_gate.sh:L1-L230](atlassian/forge-app/audit/reviewer_ready_gate.sh#L1-L230) |

---

**Document Version**: 1.0 | **Updated**: 2026-01-11 | **Status**: Enterprise-Grade
