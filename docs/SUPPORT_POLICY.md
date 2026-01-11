# Support Policy

## Audience & Scope

**Audience**: FirstTry customers, IT operations teams, and organizations planning support engagement strategies.

**Scope**: This document describes how FirstTry support is provided and clarifies which issues are FirstTry's responsibility versus Atlassian's responsibility. No contractual service level agreements (SLAs) or response time guarantees are defined in repository documentation. It does NOT modify or supersede existing Atlassian support agreements or Forge platform support terms.

## Executive Summary

FirstTry support is provided through defined support channels. First-line support includes troubleshooting, configuration assistance, and documentation guidance. All support covers FirstTry-specific functionality; Forge platform and Jira Cloud infrastructure support remain Atlassian's responsibility. Detailed support engagement terms are negotiated separately and are not documented in this repository.

## What This Covers

- FirstTry support channels and contact methods
- Types of issues covered under FirstTry support
- Boundaries between FirstTry support and Atlassian/Forge support
- Escalation procedures

## What This Explicitly Does NOT Cover

- Modifications to existing Atlassian support agreements
- Forge platform infrastructure support (managed by Atlassian)
- Jira Cloud support for non-FirstTry issues
- Custom feature development or consulting services
- Data recovery or backup services
- Third-party integration support (outside FirstTry scope)
- Contractual SLAs or response time guarantees (not documented in repository)

## Core Assertions

- **FirstTry Support Scope Is Clearly Bounded**: FirstTry support covers FirstTry application issues. Forge platform and Jira Cloud infrastructure issues are Atlassian's responsibility.
  - Proof: [Support Policy — Support Channels](#support-channels) (this section)

- **Support Channel Is Email-Based**: FirstTry support is available through email ticketing systems for issue reporting, configuration questions, and documentation assistance.
  - Proof: NOT EVIDENCED IN REPO AS OF HEAD (support channel implementation details are external to repository)

- **Escalation Process Exists for Platform Issues**: Issues determined to be Forge or Jira Cloud responsibility are escalated to Atlassian support.
  - Proof: [Support Policy — Escalation](#escalation) (this section)

## Support Channels

FirstTry support is available through email ticketing systems. Organizations can contact support to report issues, ask configuration questions, and request documentation assistance.

**FirstTry Support Covers**:
- FirstTry dashboard gadget functionality issues
- Evidence snapshot failures or delays
- Freeze-lock verification errors
- Configuration questions
- Documentation guidance
- API integration issues

**NOT FirstTry Support (Escalate to Atlassian)**:
- Forge platform runtime errors
- Jira API rate limiting or throttling
- Jira Cloud authentication or authorization
- Cloud infrastructure networking or security
- Atlassian app marketplace approval process

**Out of Scope (Requires Separate Engagement)**:
- Custom feature development
- Integration with third-party governance or risk platforms
- Governance policy design or compliance strategy consulting
- Organizational change management or training
- Data migration from legacy systems
- Custom report development or export integrations

## Escalation

Issues determined to be Forge platform or Jira Cloud responsibility will be escalated to Atlassian support. FirstTry support will assist with the escalation process and keep the customer informed.

## Explicit Negative Assertions

- **This support policy does NOT define contractual SLAs or response time guarantees**: No response times, availability targets, or severity-based response commitments are documented in this repository. Support engagement terms are negotiated separately.

- **This support policy does NOT include support tiers with different response times**: No "Standard" or "Premium" support tiers are defined. Support engagement details are negotiated separately outside repository documentation.

- **This support policy does NOT include consulting services**: Support covers troubleshooting and operational guidance. Governance policy design, compliance strategy, or custom integrations require separate consulting engagements.

- **This support policy does NOT provide feature development or roadmap influence**: Support does not cover feature requests, custom modifications, or product backlog influence. Feature development is managed through standard Atlassian Forge channels.

- **This support policy does NOT cover Forge platform or Jira Cloud issues**: FirstTry support ends at FirstTry application code. Infrastructure, platform, and cloud service issues are Atlassian's responsibility.

## Proof Anchors

| Claim | Location |
|-------|----------|
| FirstTry support scope | [Support Policy — Support Channels](#support-channels) (this document) |
| Escalation to Atlassian | [Support Policy — Escalation](#escalation) (this document) |
| Forge platform responsibility | NOT EVIDENCED IN REPO; refer to [Atlassian Forge Support](https://developer.atlassian.com/platform/forge/support/) |
| Evidence storage mechanism | [atlassian/forge-app/manifest.yml:L62-L63](../atlassian/forge-app/manifest.yml#L62-L63) |

---

**Document Version**: 2.0 | **Updated**: 2026-01-11 | **Status**: Enterprise-Grade | **Compliance**: No SLAs, tiers, or response time guarantees
