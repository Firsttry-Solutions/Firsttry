# Support Policy

## Audience & Scope

**Audience**: FirstTry customers, IT operations teams, and organizations planning support engagement strategies.

**Scope**: This document defines FirstTry support levels, response times, and support scope boundaries. It clarifies what issues are covered under support versus what require external resources. It does NOT modify or supersede existing Atlassian support agreements or Forge platform support terms.

## Executive Summary

FirstTry support is provided through defined support channels with tiered response times. Standard support includes troubleshooting, configuration assistance, and documentation guidance via email/ticketing systems. Premium support includes phone/chat channels with faster response times. All support covers FirstTry-specific functionality; Forge platform and Jira Cloud infrastructure support remain Atlassian's responsibility.

## What This Covers

- Support channels and contact methods
- Response time SLAs by support tier
- Types of issues covered under support
- Escalation procedures
- Boundaries between FirstTry support and Atlassian support
- Support hours and availability

## What This Explicitly Does NOT Cover

- Modifications to existing Atlassian support agreements
- Forge platform infrastructure support (managed by Atlassian)
- Jira Cloud support for non-FirstTry issues
- Custom feature development or consulting services
- Data recovery or backup services
- Third-party integration support (outside FirstTry scope)

## Support Levels

### Tier 1: Standard Support

**Cost**: Included with FirstTry base product

**Response Times**:
- Critical (service down): 24 hours
- High (degraded functionality): 48 hours
- Medium (operational concern): 72 hours
- Low (documentation/general inquiry): 5 business days

**Channels**: Email ticketing system

**Hours**: Monday-Friday, 9 AM - 5 PM (US Eastern Time)

**Included Issues**:
- FirstTry dashboard gadget not loading
- Evidence snapshot failures
- Freeze-lock verification errors
- Configuration questions
- Documentation guidance
- API access issues (FirstTry integration)

### Tier 2: Premium Support

**Cost**: Additional annual subscription (negotiated separately)

**Response Times**:
- Critical (service down): 4 hours
- High (degraded functionality): 8 hours
- Medium (operational concern): 24 hours
- Low (documentation/general inquiry): 2 business days

**Channels**: Email, phone, chat

**Hours**: 24/7 (including weekends/holidays)

**Included Issues**: All Tier 1 issues, plus:
- Priority access to implementation assistance
- Dedicated support contact
- Proactive monitoring recommendations
- Quarterly business reviews

## Issue Severity Definitions

| Severity | Definition | Examples |
|----------|-----------|----------|
| **Critical** | FirstTry functionality completely unavailable; governance pipelines not executing | Dashboard gadget error on all dashboard instances; scheduled tasks fail to trigger |
| **High** | FirstTry functionality degraded; some features unavailable but core operations continue | Evidence snapshots incomplete; freeze-lock verification throws intermittent errors |
| **Medium** | FirstTry functionality partially impaired; workarounds exist | Dashboard performance degradation; snapshot generation slower than baseline |
| **Low** | General inquiries, configuration guidance, or documentation requests | How to customize dashboard layout; explanation of evidence ledger structure |

## Support Scope Boundaries

### FirstTry Support Covers

✅ FirstTry application configuration and troubleshooting
✅ Dashboard gadget setup and gadget-specific issues
✅ Scheduled governance pipeline tuning
✅ Evidence ledger queries and snapshot retrieval
✅ Freeze-lock verification and audit artifact interpretation
✅ Integration with FirstTry APIs
✅ Performance optimization guidance

### NOT FirstTry Support (Escalate to Atlassian)

❌ Forge platform infrastructure issues (runtime, deployment, scaling)
❌ Jira Cloud authentication or authorization problems
❌ Forge app storage or resource quota management
❌ Jira API rate limiting or throttling (Jira Cloud responsibility)
❌ Cloud infrastructure networking, firewall, or security
❌ Atlassian app marketplace publishing or approval process

### Out of Scope (Requires Consulting)

❌ Custom feature development
❌ Integration with third-party governance or risk platforms
❌ Governance policy design or compliance strategy consulting
❌ Organizational change management or training programs
❌ Data migration from legacy governance systems
❌ Custom report development or export integrations

## Escalation Procedure

**Tier 1 to Tier 2 Escalation**: Submit "escalation request" to support email. Response within 2 hours during support hours.

**Tier 2 to Engineering**: Premium support can request engineering escalation for complex technical issues. Engineering review within 1 business day.

**Tier 2 to Forge Platform Support**: For issues determined to be Forge/Jira Cloud responsibility, FirstTry support will open Atlassian support ticket and keep FirstTry customer informed of progress.

## Escalation Procedure

**Tier 1 to Tier 2 Escalation**: Submit "escalation request" to support email. Response within 2 hours during support hours.

**Tier 2 to Engineering**: Premium support can request engineering escalation for complex technical issues. Engineering review within 1 business day.

**Tier 2 to Forge Platform Support**: For issues determined to be Forge/Jira Cloud responsibility, FirstTry support will open Atlassian support ticket and keep FirstTry customer informed of progress.

## Core Assertions

- **Support is Available Through Defined Channels**: Standard support uses email ticketing; Premium support includes phone and chat. Both tiers have published SLAs for response times.
  - Proof: [Support Policy — Support Levels](SUPPORT_POLICY.md#support-levels) (this document)

- **Support Scope Is Clear and Bounded**: FirstTry support covers FirstTry application issues. Forge platform and Jira Cloud infrastructure support remain Atlassian's responsibility.
  - Proof: [Support Policy — Support Scope Boundaries](SUPPORT_POLICY.md#support-scope-boundaries) (this document)

- **Escalation Procedures Are Non-Negotiable**: Issues escalating beyond FirstTry support follow defined procedures. Complex issues escalate to engineering; platform issues escalate to Atlassian.
  - Proof: [Support Policy — Escalation Procedure](SUPPORT_POLICY.md#escalation-procedure) (this document)

- **Support Tiers Provide Different Response Times**: Standard (24-72 hours) vs. Premium (4-24 hours) tiers enable organizations to choose support level based on operational criticality.
  - Proof: [Support Policy — Support Levels table](SUPPORT_POLICY.md#support-levels) (this document)

## Support Tickets & Documentation

All support interactions are documented in support ticket system. Organizations can:
- View ticket status and history
- Upload artifacts and logs
- Track response times against SLAs
- Request ticket updates via email

## Explicit Negative Assertions

- **This support policy does NOT include consulting services**: Support covers troubleshooting and operational guidance. Governance policy design, compliance strategy, or custom integrations require separate consulting engagements.

- **This support policy does NOT provide feature development or roadmap influence**: Support does not cover feature requests, custom modifications, or product backlog influence. Feature development is managed through standard Atlassian Forge channels.

- **This support policy does NOT cover Forge platform or Jira Cloud issues**: FirstTry support ends at FirstTry application code. Infrastructure, platform, and cloud service issues are Atlassian's responsibility.

- **This support policy does NOT guarantee issue resolution within response time**: Response times are SLAs for initial support contact and triage. Resolution time depends on issue complexity and may require escalation or external resources.

- **This support policy does NOT include data backup, recovery, or archival services**: FirstTry evidence storage is managed by Forge app storage. Backup and recovery are Forge/Jira Cloud responsibilities.

## Proof Anchors

| Claim | Location |
|-------|----------|
| Support policy definition | [docs/SUPPORT_POLICY.md](SUPPORT_POLICY.md) (this file) |
| Forge platform support boundary | NOT EVIDENCED IN REPO; refer to [Atlassian Forge Support](https://developer.atlassian.com/platform/forge/support/) |
| FirstTry evidence storage mechanism | [atlassian/forge-app/manifest.yml:L62-L63](../atlassian/forge-app/manifest.yml#L62-L63) |
| Scheduled pipeline execution | [atlassian/forge-app/manifest.yml:L46-L57](../atlassian/forge-app/manifest.yml#L46-L57) |

---

**Document Version**: 1.0 | **Updated**: 2026-01-11 | **Status**: Enterprise-Grade
