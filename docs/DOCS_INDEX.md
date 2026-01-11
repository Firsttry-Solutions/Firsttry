# FirstTry Documentation Index

## Overview

Welcome to FirstTry enterprise documentation. This index provides a roadmap to all FirstTry governance, security, operational, and strategic documentation.

## Documentation Categories

### Executive & Procurement

For C-suite, finance, and procurement stakeholders evaluating FirstTry:

- **[Enterprise One-Pager](ENTERPRISE_ONE_PAGER.md)** — What FirstTry is, key capabilities, security posture, operational model at a glance
- **[ROI Justification](ROI_JUSTIFICATION.md)** — Quantified value propositions, audit automation cost reduction, compliance risk mitigation
- **[Pricing Rationale](PRICING_RATIONALE.md)** — Transparent cost model, Forge billing components, cost predictability framework

### Security & Compliance

For security teams, compliance officers, and audit stakeholders:

- **[Security Summary](SECURITY_SUMMARY.md)** — Scope restrictions, read-only API surface, deterministic verification, dependency auditing
- **[Change Management](CHANGE_MANAGEMENT.md)** — Freeze-lock mechanism, deployment verification, rollback procedures, audit trails

### Operations & Support

For IT operations, DevOps engineers, and organizations managing deployments:

- **[Support Policy](SUPPORT_POLICY.md)** — Support levels, response times, escalation procedures, support scope boundaries
- **[Roadmap](ROADMAP.md)** — Phase-by-phase planned capabilities, target timeframes, dependencies, adoption path

## Document Structure

Every FirstTry document follows a consistent enterprise-grade schema:

1. **Audience & Scope** — Who should read this document and what it covers
2. **Executive Summary** — High-level overview for busy readers
3. **What This Covers** — Specific topics and scope of the document
4. **What This Explicitly Does NOT Cover** — Scope boundaries and exclusions
5. **Core Assertions** — Factual claims anchored to proof locations
6. **Operational / Security Implications** (where applicable) — Impact on deployment and risk
7. **Explicit Negative Assertions** — ≥3 claims about what the system does NOT do
8. **Proof Anchors** — Mapping of claims to source code, manifest, or configuration

## Key Concepts

### Read-Only Architecture

FirstTry is fundamentally read-only. All Forge manifest scopes are restricted to `storage:app` (internal evidence storage) and `read:jira-work` (Jira data observation). No write, delete, manage, admin, or state-modification operations are supported.

**Proof**: [Security Summary — Manifest Scope Restriction](SECURITY_SUMMARY.md#core-assertions)

### Deterministic Verification

Every FirstTry deployment is locked to a freeze commit via freeze-lock cryptographic verification. The verification process is non-bypassable, deterministic, and produces reproducible proof artifacts.

**Proof**: [Change Management — Freeze-Lock Mechanism](CHANGE_MANAGEMENT.md#change-management-mechanism-freeze-lock)

### Evidence Ledger

FirstTry maintains an immutable evidence ledger of governance snapshots, deployment proofs, and audit artifacts. The ledger is stored in Forge app storage and is accessible for external audit.

**Proof**: [Change Management — Audit Trail & Evidence Storage](CHANGE_MANAGEMENT.md#audit-trail--evidence-storage)

### No Feature-Tier Licensing

All FirstTry customers access identical capabilities. No feature-tier, entitlement-based, or subscription-level differentiation exists. All roadmap features will be uniformly available.

**Proof**: [Pricing Rationale — What Is Included in Base Product](PRICING_RATIONALE.md#what-is-included-in-base-product)

## Quick-Start Paths

### I'm Evaluating FirstTry for My Organization

1. Start with [Enterprise One-Pager](ENTERPRISE_ONE_PAGER.md)
2. Review [Security Summary](SECURITY_SUMMARY.md) for security posture
3. Read [ROI Justification](ROI_JUSTIFICATION.md) for business case
4. Review [Pricing Rationale](PRICING_RATIONALE.md) for cost transparency
5. Explore [Roadmap](ROADMAP.md) for planned capabilities

### I'm Deploying FirstTry to Production

1. Review [Change Management](CHANGE_MANAGEMENT.md) for deployment procedures
2. Understand freeze-lock verification: [Change Management — Deployment Workflow](CHANGE_MANAGEMENT.md#deployment-workflow)
3. Bookmark [Support Policy](SUPPORT_POLICY.md) for reference
4. Archive evidence packages for audit compliance

### I'm Supporting FirstTry Operations

1. Review [Support Policy](SUPPORT_POLICY.md) for support scope and escalation
2. Understand rollback procedures: [Change Management — Rollback Procedure](CHANGE_MANAGEMENT.md#rollback-procedure)
3. Monitor evidence ledger for deployment history
4. Contact support for operational issues

### I'm Auditing FirstTry Deployments

1. Obtain evidence package from customer
2. Review [Change Management — External Audit Access](CHANGE_MANAGEMENT.md#external-audit-access)
3. Verify freeze-lock using: `audit/verify_freeze_lock.sh`
4. Cross-reference security claims in [Security Summary](SECURITY_SUMMARY.md) with manifest and code

## Proof Anchors

| Concept | Documentation | Code/Manifest Proof |
|---------|---|---|
| Read-only architecture | [Security Summary](SECURITY_SUMMARY.md) | [manifest.yml:L58-L61](../atlassian/forge-app/manifest.yml#L58-L61) |
| Deterministic verification | [Change Management](CHANGE_MANAGEMENT.md) | [verify_freeze_lock.sh](../atlassian/forge-app/audit/verify_freeze_lock.sh) |
| Non-bypassable gates | [Security Summary](SECURITY_SUMMARY.md) | [reviewer_ready_gate.sh:L1-L230](../atlassian/forge-app/audit/reviewer_ready_gate.sh#L1-L230) |
| Evidence ledger | [Change Management](CHANGE_MANAGEMENT.md) | [audit/submission_bundle/](../atlassian/forge-app/audit/submission_bundle/) |
| Uniform feature availability | [Pricing Rationale](PRICING_RATIONALE.md) | [manifest.yml](../atlassian/forge-app/manifest.yml) (no tier logic) |

## Explicit Negative Assertions

- **This documentation does NOT include product roadmap guarantees**: Roadmap items describe planned capabilities but do not guarantee delivery dates or implementation specifics.

- **This documentation does NOT modify existing Atlassian support or Forge platform agreements**: FirstTry support ends at application code; platform infrastructure support is Atlassian's responsibility.

- **This documentation does NOT provide consulting, implementation, or professional services**: Documentation provides reference information. Consulting engagements are separate.

## Support & Contact

For documentation questions, clarifications, or to report inaccuracies:
- Review the applicable document's proof anchors section
- Contact FirstTry support: [Support Policy](SUPPORT_POLICY.md#support-channels)
- File an issue with supporting evidence and documentation reference

## Document Maintenance

This documentation is maintained alongside the FirstTry codebase. Updates occur when:
- Code or manifest changes affect documented behaviors
- Roadmap milestones are reached
- Customer feedback identifies documentation gaps
- Security or operational procedures evolve

Last updated: 2026-01-11

---

**All documents in this collection follow enterprise-grade documentation standards and are backed by proof anchors in the repository.**
