# Pricing Rationale: FirstTry Governance

## Audience & Scope

**Audience**: Finance stakeholders, procurement teams, and licensing managers responsible for technology cost planning and budget allocation.

**Scope**: This document explains the rationale behind FirstTry cost model and licensing approach. It clarifies what is and is not included in product delivery, and provides transparent cost structure for budgeting purposes. It does NOT describe discount negotiations, custom pricing arrangements, or future pricing changes.

## Executive Summary

FirstTry is licensed through Atlassian Forge on a usage-based billing model. Costs derive from app storage consumption (evidence ledgers, snapshots), scheduled task execution (daily/weekly governance pipelines), and Forge runtime resource allocation. There are no per-user fees, per-instance charges, or feature-tier licensing models. All FirstTry customers pay identical base costs; differentiation in support level and implementation services is optional.

## What This Covers

- Forge billing model (app storage, scheduled tasks, runtime)
- Cost components and scaling factors
- What is included in the base product delivery
- Optional support and implementation services pricing
- Cost predictability and transparency

## What This Explicitly Does NOT Cover

- Discount or negotiated pricing arrangements
- Multi-year contract terms or volume discounts
- Consulting services beyond implementation assistance
- Custom feature development or modifications
- Data processing services or compliance consulting
- Future pricing model changes or roadmap-driven cost increases

## Pricing Model

### Base Product Licensing (Atlassian Forge)

FirstTry is deployed on Atlassian Forge. The cost structure derives from Forge platform billing, which charges for app storage consumption (evidence ledgers, snapshots) and scheduled task execution (daily/weekly governance pipelines).

**Cost Components**:
- App Storage: Evidence ledgers and governance snapshots
- Scheduled Tasks: Daily/weekly pipeline execution
- Runtime Execution: Function execution for status resolution
- API Calls: Jira API read operations (free tier includes 1000s per month)

**Cost Formula** (NOT EVIDENCED IN REPO; refer to [Atlassian Forge Billing](https://developer.atlassian.com/platform/forge/billing/)):
```
Total Monthly Cost = (App Storage × Rate) + (Task Invocations × Rate) + (Runtime Execution × Rate)
```

Actual costs depend on Forge platform rates and are managed through the Atlassian Forge billing dashboard.

## Implementation & Support Services

**Implementation Assistance**: Dashboard gadget configuration, scheduled pipeline tuning, and evidence ledger initialization are negotiated separately based on organizational needs.

**Support Services**: Support is provided according to [SUPPORT_POLICY.md](SUPPORT_POLICY.md). Support engagement terms are negotiated separately and not documented in repository.

## Cost Predictability & Budgeting

Organizations can monitor FirstTry usage and costs via:
- Atlassian Forge billing dashboard (app storage, task invocations, runtime execution)
- FirstTry evidence ledger (snapshot frequency and retention)
- Jira API usage logs (read operation count and rate limits)

Costs scale with deployment scale and snapshot frequency. Organizations should consult Atlassian Forge documentation and their Forge billing dashboard for current rates and cost estimates.

## Core Assertions

- **FirstTry Costs Derive from Forge Usage**: Billing is based on Atlassian Forge platform rates for app storage, scheduled task execution, and runtime execution. No feature-tier or customer-segment pricing exists.
  - Proof: [manifest.yml](../atlassian/forge-app/manifest.yml) (no tier or licensing logic)

- **No Per-User or Per-Instance Fees**: FirstTry costs derive only from Forge usage metrics (storage, task execution, runtime). Team size and instance count do not impact licensing costs.
  - Proof: [manifest.yml:L46-L63](../atlassian/forge-app/manifest.yml#L46-L63) (no user-facing or instance-specific logic)

- **Costs Depend on Deployment Scale and Usage**: Organizations with higher snapshot frequency or larger evidence ledgers will incur proportionally higher Forge resource costs. Costs scale with operational governance needs.
  - Proof: Forge platform resource consumption (storage, task invocations, runtime execution)

- **Actual Cost Rates Are External to Repository**: FirstTry documentation does not define Forge pricing rates or cost structures. Organizations must consult Atlassian Forge pricing documentation and their Forge billing dashboard for current costs.
  - Proof: NOT EVIDENCED IN REPO; refer to [Atlassian Forge Billing](https://developer.atlassian.com/platform/forge/billing/)

## Explicit Negative Assertions

- **This document does NOT define Forge billing rates or pricing formulas**: Actual Forge costs are determined by Atlassian and are not part of FirstTry documentation. FirstTry documentation does not contain pricing guarantees or cost predictions.

- **This document does NOT include support tier pricing or differentiated support costs**: Support engagement terms are negotiated separately outside repository documentation. See [SUPPORT_POLICY.md](SUPPORT_POLICY.md).

- **This pricing rationale does NOT include consulting services or custom integrations**: FirstTry provides governance visibility and evidence automation only. Consulting, custom development, and external integrations require separate negotiated engagements.

- **This document does NOT suggest feature-tier licensing or entitlement models**: All FirstTry capabilities are available to all customers. No "pro," "premium," or "enterprise" feature tiers exist.

- **This document does NOT predict future pricing changes or cost trends**: This rationale describes the current model only. Future Forge platform pricing changes or FirstTry model changes are external to repository documentation.

## Proof Anchors

| Claim | Location |
|-------|----------|
| Forge scheduling and task execution | [atlassian/forge-app/manifest.yml:L46-L57](../atlassian/forge-app/manifest.yml#L46-L57) |
| Read-only API scopes (no write operations) | [atlassian/forge-app/manifest.yml:L23-L27](../atlassian/forge-app/manifest.yml#L23-L27) |
| Actual Forge pricing rates | NOT EVIDENCED IN REPO |
| Support engagement terms | [SUPPORT_POLICY.md](SUPPORT_POLICY.md) |

---

**Document Version**: 2.0 | **Updated**: 2026-01-11 | **Status**: Enterprise-Grade | **Compliance**: No numeric cost guarantees

## Explicit Negative Assertions

- **This product does NOT use feature-tier or entitlement-based pricing**: All organizations pay identical per-unit costs for storage, task execution, and runtime. No "pro," "enterprise," or "premium" product tiers exist.

- **This pricing model does NOT include per-user or per-instance licensing fees**: FirstTry costs are based solely on Forge platform usage. Team size, Jira instance count, and user count do not affect FirstTry licensing costs.

- **This product does NOT bundle consulting or professional services**: Implementation and support services are optional and billed separately. The base product is software only.

- **This product does NOT lock organizations into multi-year contracts or prepaid commitments**: FirstTry uses month-to-month Forge billing. Organizations can discontinue at any time without penalty.

- **This pricing model does NOT change based on subscription level or custom agreements**: All customers pay the same usage-based rates. Volume discounts, strategic pricing, or custom arrangements are negotiated outside this document.

## Proof Anchors

| Claim | Location |
|-------|----------|
| Forge manifest scopes (read-only, no special rates) | [atlassian/forge-app/manifest.yml:L58-L61](../atlassian/forge-app/manifest.yml#L58-L61) |
| Scheduled pipelines (daily/weekly frequency) | [atlassian/forge-app/manifest.yml:L46-L57](../atlassian/forge-app/manifest.yml#L46-L57) |
| Evidence storage mechanism (app storage) | [atlassian/forge-app/manifest.yml:L62-L63](../atlassian/forge-app/manifest.yml#L62-L63) |
| Forge billing documentation | NOT EVIDENCED IN REPO AS OF HEAD |
| Support service definitions | [atlassian/forge-app/legal/SUPPORT_POLICY.md](../atlassian/forge-app/legal/SUPPORT_POLICY.md) |

---

**Document Version**: 1.0 | **Updated**: 2026-01-11 | **Status**: Enterprise-Grade
