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

FirstTry is deployed on Atlassian Forge. The cost structure is:

| Component | Driver | Cost Model |
|-----------|--------|-----------|
| **App Storage** | Evidence ledgers, governance snapshots | GB/month usage |
| **Scheduled Tasks** | Daily/weekly pipeline execution | Per invocation + compute time |
| **Runtime Execution** | Function runtime for status resolver | Per-request + execution time |
| **API Calls** | Jira API read operations | Per API call (1000s included free tier) |

**Cost Formula**:
```
Total Monthly Cost = (App Storage × Rate) + (Task Invocations × Rate) + (Runtime Execution × Rate)
```

**Example Scenarios** (illustrative, not guaranteed):
- **Small Deployment** (daily snapshots, light dashboard usage): $50-150/month
- **Medium Deployment** (daily + weekly snapshots, moderate dashboard load): $150-500/month
- **Large Deployment** (multi-daily snapshots, high-frequency dashboard access): $500-2000/month

### Optional Services

Support and implementation services are billed separately:

| Service | Description | Cost Model |
|---------|-------------|-----------|
| **Implementation Assistance** | Dashboard gadget setup, pipeline tuning | Fixed hourly rate or project fee |
| **Standard Support** | Email/ticket-based support, 24-hour response | Annual subscription fee |
| **Premium Support** | Phone/chat support, 4-hour response | Annual subscription fee |
| **Custom Integration** | Integration with external governance systems | Consulting engagement |

## Cost Justification: Why Usage-Based Model?

1. **Fairness**: Organizations using FirstTry lightly pay proportionally less than organizations running high-frequency governance pipelines. This aligns cost with value consumed.

2. **Transparency**: Costs scale predictably with usage. Organizations can forecast costs based on deployment scale and snapshot frequency.

3. **Flexibility**: No upfront license fees or multi-year commitments. Organizations can scale up or down based on governance needs.

4. **Incentive Alignment**: Usage-based model incentivizes FirstTry product efficiency (low storage footprint, fast execution), benefiting all customers.

## What Is Included in Base Product

- ✅ Real-time governance status dashboard gadget
- ✅ Deterministic freeze-lock verification capability
- ✅ Daily and weekly governance snapshot pipelines
- ✅ Evidence storage and ledger management (within Forge app storage quota)
- ✅ Forge manifest validation and reviewer readiness gate
- ✅ NPM dependency audit integration
- ✅ Read-only Jira API access (scopes: `storage:app`, `read:jira-work`)

## What Is NOT Included in Base Product

- ❌ Consulting on governance policy definition
- ❌ Compliance interpretation or audit preparation services
- ❌ Custom report formats or export integrations
- ❌ Integration with external governance or risk platforms
- ❌ Training or organizational change management
- ❌ Feature-tier licensing or entitlement enforcement
- ❌ Data backup or recovery services beyond Forge platform

## Cost Predictability & Budgeting

### Factors Affecting Costs

**Variable Factors** (impact cost):
- Number and frequency of governance snapshots (daily/weekly/custom)
- Dashboard gadget usage frequency
- Evidence ledger retention period
- Jira instance API rate (read operations)
- Concurrent dashboard users

**Fixed Factors** (do not affect cost):
- Number of Jira projects or issues
- User count or team size
- Organization size or deployment scale
- Feature tier or licensing model (none exists)
- Support level (optional, negotiated separately)

### Cost Predictability & Budgeting

### Factors Affecting Costs

**Variable Factors** (impact cost):
- Number and frequency of governance snapshots (daily/weekly/custom)
- Dashboard gadget usage frequency
- Evidence ledger retention period
- Jira instance API rate (read operations)
- Concurrent dashboard users

**Fixed Factors** (do not affect cost):
- Number of Jira projects or issues
- User count or team size
- Organization size or deployment scale
- Feature tier or licensing model (none exists)
- Support level (optional, negotiated separately)

## Core Assertions

- **FirstTry Uses Uniform Usage-Based Billing**: All customers pay identical per-unit rates for Forge resources (storage, tasks, execution). No feature-tier or customer-segment pricing exists.
  - Proof: [manifest.yml](../atlassian/forge-app/manifest.yml) (no tier logic)

- **Costs Are Predictable and Transparent**: Organizations can forecast costs based on snapshot frequency and storage consumption using published Forge rate cards.
  - Proof: NOT EVIDENCED IN REPO; refer to [Atlassian Forge Pricing](https://developer.atlassian.com/platform/forge/billing/)

- **No Per-User or Per-Instance Fees**: FirstTry costs derive only from Forge usage metrics (storage, task execution). Team size and instance count do not impact licensing costs.
  - Proof: [manifest.yml:L46-L63](../atlassian/forge-app/manifest.yml#L46-L63) (scopes and scheduled tasks, no user-facing logic)

- **Pricing Model Aligns Incentives**: Usage-based pricing incentivizes product efficiency, benefiting all customers through lower costs for the same functionality.
  - Proof: ROI calculation framework (audit automation cost reduction)

## Cost Monitoring

Organizations can monitor FirstTry costs via:
- Atlassian Forge billing dashboard (app storage, task invocations)
- FirstTry evidence ledger (snapshot frequency and size)
- Jira API usage logs (read operation count)

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
| Forge billing documentation | NOT EVIDENCED IN REPO AS OF HEAD; refer to [Atlassian Forge Pricing](https://developer.atlassian.com/platform/forge/billing/) |
| Support service definitions | [atlassian/forge-app/legal/SUPPORT_POLICY.md](../atlassian/forge-app/legal/SUPPORT_POLICY.md) |

---

**Document Version**: 1.0 | **Updated**: 2026-01-11 | **Status**: Enterprise-Grade
