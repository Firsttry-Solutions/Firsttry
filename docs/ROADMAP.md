# Roadmap

## Audience & Scope

**Audience**: Enterprise customers, strategic stakeholders, and product planning teams evaluating FirstTry's trajectory and future capabilities.

**Scope**: This document outlines the published roadmap for FirstTry governance capabilities, organized by phase with target timeframes. It describes anticipated features and capabilities. It does NOT provide guarantees of delivery dates, make promises about feature availability, or commit to specific implementation details.

## Executive Summary

FirstTry is evolving through planned phases that extend governance visibility, enhance audit capabilities, and deepen Jira integration. Phase 1-3 capabilities are production-ready. Phases 4-6 represent planned enhancements targeting additional governance domains, extended API coverage, and advanced automation. Roadmap items are subject to prioritization changes and market feedback.

## What This Covers

- Phase-by-phase feature roadmap
- Target timeframes for capability delivery
- Integration scope (Jira, Forge, external systems)
- Governance domains covered
- Known constraints and dependencies

## What This Explicitly Does NOT Cover

- Guaranteed delivery dates or contractual commitments
- Specific implementation details or architecture decisions
- Feature-tier licensing or entitlement-based availability
- Pricing changes or cost impacts from roadmap features
- Third-party integration availability
- Competitive analysis or feature comparison

## Production-Ready Capabilities (Phase 1-3)

### Phase 1: Event Ingestion & Tokenized Access

**Status**: ✅ Production-Ready

**Capabilities**:
- Event ingestion endpoint with token-based authentication
- Idempotent event processing
- Storage of governance events in Forge app storage
- Admin-only proof debug endpoint for validation

**Availability**: Current release

---

### Phase 2: Configuration Visibility

**Status**: ✅ Production-Ready

**Capabilities**:
- Daily snapshot of project governance configuration
- Configuration complexity metrics
- Policy compliance indicators
- Configuration history tracking

**Availability**: Current release

---

### Phase 3: Scheduled Pipelines & Readiness Gating

**Status**: ✅ Production-Ready

**Capabilities**:
- Daily and weekly governance pipeline execution
- Automated readiness status assessment
- Scheduled snapshot generation with deterministic verification
- Evidence ledger storage and retrieval

**Availability**: Current release

---

## Planned Capabilities (Phase 4-6)

### Phase 4: Extended API Coverage

**Target**: Q2 2026

**Planned Capabilities**:
- Support for Jira Portfolio Cloud API
- Advanced query capabilities for historical governance data
- Cross-instance governance aggregation (read-only)
- API performance optimization and caching

**Constraints**:
- Jira Portfolio Cloud API availability and stability
- Cross-instance authentication and rate limiting
- Data volume scaling for large deployments

**Status**: Under evaluation

---

### Phase 5: Governance Rules Engine

**Target**: Q3-Q4 2026

**Planned Capabilities**:
- Custom governance rule definition (declarative DSL)
- Automated compliance assessment against custom rules
- Policy drift detection and alerting
- Rule versioning and change tracking

**Constraints**:
- DSL design and user testing
- Performance impact of rule evaluation at scale
- Integration with existing governance frameworks

**Status**: Concept phase

---

### Phase 6: External Integration & Advanced Audit

**Target**: Q4 2026 - Q1 2027

**Planned Capabilities**:
- Export to external governance platforms (ServiceNow, etc.)
- Advanced audit trail export (SIEM integration)
- Governance change attribution (who made what change)
- External compliance framework mapping (SOC2, ISO27001, etc.)

**Constraints**:
- External platform API availability and stability
- Data schema alignment across systems
- Security and data residency requirements

**Status**: Discovery phase

---

## Dependencies & Constraints

### Forge Platform Dependencies

- **Scheduled Task Reliability**: Roadmap execution depends on Forge scheduledTrigger stability
- **App Storage Scaling**: Extended governance history requires Forge app storage capacity increases
- **API Rate Limits**: Extended API coverage depends on Jira Cloud rate limit policies

### Jira Cloud Dependencies

- **Portfolio Cloud API Availability**: Phase 4 requires Jira Portfolio Cloud API maturity
- **Custom Field Support**: Governance rules engine depends on Jira custom field APIs
- **Webhook Infrastructure**: Event-driven governance features depend on Webhook v3.0 stability

### Market & Regulatory Dependencies

- **Compliance Framework Evolution**: Phase 6 requires market alignment on compliance standards
- **Customer Feedback**: Roadmap prioritization is influenced by customer requests and pain points
- **Regulatory Changes**: Data governance and audit requirements may accelerate certain capabilities

## Dependencies & Constraints

### Forge Platform Dependencies

- **Scheduled Task Reliability**: Roadmap execution depends on Forge scheduledTrigger stability
- **App Storage Scaling**: Extended governance history requires Forge app storage capacity increases
- **API Rate Limits**: Extended API coverage depends on Jira Cloud rate limit policies

### Jira Cloud Dependencies

- **Portfolio Cloud API Availability**: Phase 4 requires Jira Portfolio Cloud API maturity
- **Custom Field Support**: Governance rules engine depends on Jira custom field APIs
- **Webhook Infrastructure**: Event-driven governance features depend on Webhook v3.0 stability

### Market & Regulatory Dependencies

- **Compliance Framework Evolution**: Phase 6 requires market alignment on compliance standards
- **Customer Feedback**: Roadmap prioritization is influenced by customer requests and pain points
- **Regulatory Changes**: Data governance and audit requirements may accelerate certain capabilities

## Core Assertions

- **Phase 1-3 Capabilities Are Production-Ready**: Event ingestion, configuration visibility, and scheduled pipelines are currently deployed and operational.
  - Proof: [manifest.yml:L46-L57](../atlassian/forge-app/manifest.yml#L46-L57)

- **Planned Phases Have Well-Defined Scope and Dependencies**: Phases 4-6 are targeted but dependent on external factors (Jira Cloud API maturity, Forge stability).
  - Proof: [Roadmap — Planned Capabilities](ROADMAP.md#planned-capabilities-phase-4-6) (this document)

- **All Roadmap Features Will Maintain Read-Only Architecture**: No write, delete, or state-modification capabilities will be introduced regardless of phase or feature.
  - Proof: [manifest.yml:L58-L61](../atlassian/forge-app/manifest.yml#L58-L61)

- **Feature Availability Will Remain Uniform Across Deployments**: No feature-tier licensing, entitlement-based gating, or subscription-level differentiation will be implemented.
  - Proof: [PRICING_RATIONALE.md — No Feature-Tier Licensing](../docs/PRICING_RATIONALE.md#explicit-negative-assertions)

## Feature-Tier & License Constraints

**CONSTRAINT**: All roadmap features will be available uniformly across FirstTry deployments. No feature-tier licensing, entitlement-based gating, or subscription-level differentiation will be introduced.

**CONSTRAINT**: All roadmap features will maintain the read-only architectural principle. No write, delete, or state-modification capabilities will be introduced.

## Adoption Path for Customers

1. **Phase 1-3 Users** (Today): Full access to governance visibility, pipelines, and readiness gating
2. **Phase 4 Release** (Q2 2026): Automatic upgrade to include Jira Portfolio Cloud support
3. **Phase 5 Release** (Q3-Q4 2026): Governance rules engine becomes available; customers opt-in to rules
4. **Phase 6 Release** (Q4 2026 - Q1 2027): External integrations and advanced audit features available

No action required from customers for feature adoption; all enhancements are automatic with release upgrades.

## Roadmap Review & Adjustment

This roadmap is reviewed quarterly based on:
- Customer feedback and feature requests
- Market competitive analysis
- Forge platform capability evolution
- Jira Cloud API maturity and stability
- Regulatory landscape changes

Roadmap adjustments are published via:
- Updated documentation (this file)
- Release notes and announcements
- Customer webinars and product updates
- Annual strategic reviews

## Explicit Negative Assertions

- **This roadmap does NOT guarantee feature delivery dates**: Target dates are estimates based on current planning. Actual delivery may be earlier or later depending on technical challenges, resource availability, and prioritization changes.

- **This roadmap does NOT commit to specific feature implementation details**: Described capabilities may be implemented differently than planned. Implementation details are finalized during development phases.

- **This roadmap does NOT include feature-tier or license-based availability**: All roadmap features will be uniformly available to all FirstTry customers at no additional licensing cost (beyond Forge platform usage).

- **This roadmap does NOT alter the read-only architectural principle**: No write, delete, or state-modification capabilities will be added in future phases. FirstTry remains a read-only governance observation platform.

- **This roadmap does NOT replace customer-specific feature requests with generic capabilities**: While roadmap features are planned to address broad market needs, organizations with unique requirements should discuss custom integrations separately.

## Proof Anchors

| Claim | Location |
|-------|----------|
| Phase 1-3 production capabilities | [atlassian/forge-app/manifest.yml](../atlassian/forge-app/manifest.yml) |
| Scheduled pipeline execution | [atlassian/forge-app/manifest.yml:L46-L57](../atlassian/forge-app/manifest.yml#L46-L57) |
| Read-only scopes (architectural constraint) | [atlassian/forge-app/manifest.yml:L58-L61](../atlassian/forge-app/manifest.yml#L58-L61) |
| No write-surface APIs | [atlassian/forge-app/audit/reviewer_ready_gate.sh:L182-L192](../atlassian/forge-app/audit/reviewer_ready_gate.sh#L182-L192) |
| Roadmap planning process | NOT EVIDENCED IN REPO; managed via product planning meetings and stakeholder reviews |

---

**Document Version**: 1.0 | **Updated**: 2026-01-11 | **Status**: Enterprise-Grade
