# FirstTry Case Studies — Template & Evidence Collection Guide

**Version**: 1.0  
**Last Updated**: 2026-01-13  
**Status**: Template (Awaiting First Real Study)

---

## Executive Summary

This document defines:

- ✅ What constitutes a valid FirstTry case study
- ✅ Case study template with required sections
- ✅ Evidence collection checklist (what to capture)
- ✅ Anonymization & redaction rules
- ✅ Procedure to generate first real case study from internal dogfood
- ❌ **DOES NOT** invent customers, metrics, or results

All case studies MUST be backed by verifiable evidence: screenshots, logs, before/after metrics, and time tracking. This document is a framework; the substance comes from real deployments.

---

## 1. What Is a FirstTry Case Study?

### Definition

A **case study** is a documented account of how FirstTry was deployed in a real Jira environment to solve a specific problem. It includes:

- **Context**: The customer's environment (org size, Jira version, policy challenge)
- **Problem**: What problem FirstTry was deployed to solve
- **Setup**: How FirstTry was configured and integrated
- **Results**: Quantified outcomes (time saved, errors prevented, policies enforced)
- **Evidence**: Verifiable artifacts (screenshots, logs, metrics exports)
- **Lessons**: What worked, what was tricky, recommendations for others

### Why We Document Case Studies

✅ **Proof of value** — Demonstrates FirstTry's real-world utility  
✅ **Guidance for others** — Shows how to deploy in similar situations  
✅ **Feedback loops** — Helps identify gaps or improvements  
✅ **Validation** — Proves claims in marketing/compliance materials  

### What We Do NOT Include

❌ **Fabricated customers** — All subjects must be real individuals/orgs who consent  
❌ **Invented metrics** — All numbers must be from actual data collection  
❌ **Fake quotes** — Only direct quotes from case study participants  
❌ **Misleading results** — Failures and limitations must be disclosed  
❌ **Company logos** — Only with explicit written consent  

---

## 2. Case Study Template

Use this template when documenting a new FirstTry deployment.

### Header

```markdown
# Case Study: [ANONYMIZED] — [Problem Type]

**Date Completed**: YYYY-MM-DD
**Environment**: Jira Cloud / Jira Server [version], [team size] users
**Privacy Level**: [Public / Internal / Confidential]
**Evidence Checklist**: ☐ Complete (see Section 6)

---
```

### 1. Context & Environment

**Describe the customer's situation before FirstTry deployment.**

```markdown
## 1. Context & Environment

### Organization Profile

- **Size**: [X] developers / [Y] total Jira users
- **Jira Instance**: Jira Cloud or Server, version [X.Y.Z]
- **Policy Complexity**: [Simple / Moderate / Complex]
  - E.g., "Complex: 3 release workflows, 5 policy tiers, 50+ issue types"

### Existing Process (Before FirstTry)

- **Policy Definition**: How were policies currently enforced?
  - E.g., "Manual checklist in Confluence, enforced by QA team"
- **Frequency**: [Per release / Per issue / Manual review]
- **Enforcement Gap**: What was the main problem?
  - E.g., "50% of policies were missed due to manual process"

### Compliance / Audit Requirements

- **Regulatory**: [GDPR / SOC2 / Internal standard / None]
- **Audit Frequency**: [Annual / Quarterly / Continuous]
- **Audit Pain Points**: What made compliance tracking difficult?

---
```

### 2. Problem Statement

**Articulate the specific problem FirstTry was deployed to solve.**

```markdown
## 2. Problem Statement

### The Challenge

[Describe the problem in one paragraph.]

Example:
> The team was manually reviewing 100+ issues per release to ensure they met 
> 5 corporate release policies. This process took 8 hours per release, had a 
> 40% miss rate, and created a bottleneck for product delivery.

### Quantified Impact (Before)

- **Time Investment**: [X] hours per [release / sprint / month]
- **Error Rate**: [Y]% of issues missed policy requirements
- **Compliance Risk**: [High / Medium / Low] — [justification]
- **Business Impact**: [Revenue delay / Security gap / Audit finding / Other]

### Root Cause

[Why was the manual process inadequate?]

Example:
> The policy checklist was in Confluence; Jira had no integration.
> QA reviewers had to manually cross-check each issue against 5 separate policies.
> No audit trail existed; compliance audits required manual log review.

---
```

### 3. Solution & Setup

**Document how FirstTry was deployed and configured.**

```markdown
## 3. Solution & Setup

### FirstTry Configuration

- **Policies Defined**: [List policies by name and purpose]
  - Policy 1: [Description]
  - Policy 2: [Description]
  - ...

- **Scope**: 
  - Issue Types: [E.g., "Stories, Bugs, Tasks"]
  - Workflows: [E.g., "Release workflow only"]
  - Teams: [E.g., "Product team (25 users)"]

- **Enforcement Mode**:
  - ☐ Blocking (issues fail checks; must be fixed to proceed)
  - ☐ Reporting (issues are flagged; QA reviews)
  - ☐ Audit Trail (policies logged; no blocking)

### Rollout Plan

- **Phase 1**: [Setup, testing, internal validation — X days]
- **Phase 2**: [Pilot with small team — X days]
- **Phase 3**: [Org-wide rollout — X days]

### Training & Communication

- **Sessions**: [X] training sessions, [Y] attendees
- **Materials**: [Link to docs / wiki]
- **Support Channel**: [Slack / Email / GitHub]

### Integration Points

- **Jira Workflows**: [How are policies integrated into workflows?]
- **External Tools**: [Any integrations beyond Jira?]
- **Data Export**: [How are policies exported for audit?]

---
```

### 4. Results & Outcomes

**Document quantified improvements after FirstTry deployment.**

```markdown
## 4. Results & Outcomes

### Quantified Impact (After)

- **Time Savings**: [X hours] per [release / sprint / month]
  - Before: Y hours → After: Z hours → Savings: (Y-Z) hours = X% reduction
- **Error Prevention**: [X]% of policy violations now caught before release
- **Audit Efficiency**: [X minutes] per audit (vs. [Y minutes] before)
- **Policy Compliance Rate**: Now [X]% (vs. [Y]% before)

### Timeline to Results

- **Time to Deploy**: X days
- **Time to See Impact**: Y days (N releases)
- **Stabilization Time**: Z days

### Qualitative Feedback

> [Direct quotes from team members — with permission]

Example:
> "FirstTry eliminated our manual checklist process. Now policies are enforced 
> automatically, and we have an audit trail. Release reviews now take 30 minutes 
> instead of 8 hours." — [Name/Role, anonymized if needed]

### Secondary Benefits (Unexpected)

- [Any unexpected improvements or use cases discovered]

---
```

### 5. Challenges & Lessons Learned

**Honestly document what was difficult or unexpected.**

```markdown
## 5. Challenges & Lessons Learned

### Deployment Challenges

- **Challenge 1**: [What went wrong or was unexpected?]
  - **Resolution**: [How was it solved?]
  - **Time Impact**: [X hours added to deployment]

- **Challenge 2**: [Another challenge]
  - **Resolution**: [How was it solved?]
  - **Prevention**: [How to avoid this in future deployments]

### Process Changes Required

- **Training**: [What did users need to learn?]
- **Workflow Changes**: [Did Jira workflows need adjustment?]
- **Tool Changes**: [Did other tools need updates?]

### Lessons for Future Deployments

- **Do**: [What worked well; recommend for others]
- **Don't**: [What was problematic; avoid in future]
- **Plan For**: [What to prepare for in similar situations]

### Limitations

[Were there aspects FirstTry didn't handle? Did the organization accept workarounds?]

---
```

### 6. Evidence & Artifacts

**Document all verifiable evidence supporting the claims.**

```markdown
## 6. Evidence & Artifacts

### Evidence Checklist

☐ **Before/After Metrics** — Exported data showing quantified improvements  
☐ **Screenshots** — UI showing policies, results, audit trail  
☐ **Logs** — Sanitized log excerpts showing policy enforcement  
☐ **Time Tracking** — Release notes or issue comments tracking hours saved  
☐ **Customer Consent** — Written approval to publish case study  
☐ **Redaction Review** — No real customer names, API keys, or sensitive data  

### Artifacts

| Artifact | Location | Description |
|----------|----------|-------------|
| Metrics Export | `/artifacts/case_study_01_metrics.json` | Before/after policy compliance rates |
| Screenshots | `/artifacts/case_study_01_screenshots/` | Jira issue with policies, audit trail |
| Deployment Log | `/artifacts/case_study_01_deployment.log` | Sanitized FirstTry deployment log |
| Team Feedback | `/artifacts/case_study_01_feedback.txt` | Redacted quotes and survey responses |

### Artifact Redaction Rules

Before publishing, redact:

- ❌ Customer name → Use "[ANONYMIZED CUSTOMER]"
- ❌ Customer logo → Remove or ask permission
- ❌ Real Jira issue keys → Use "[ISSUE-123]"
- ❌ API keys / tokens → Replace with [REDACTED]
- ❌ Internal email addresses → Replace with [contact@firsttry.run]
- ❌ Specific financial data → Use percentages or ranges
- ❌ Personal identifiable info → Anonymize or remove

### Artifact Location

Store all artifacts in:
```
docs/artifacts/case_study_01_[problem_type]/
├── metrics.json
├── screenshots/
├── deployment_log.txt
└── README.md (index)
```

---
```

### 7. Approval & Sign-Off

**Ensure case study is reviewed and approved before publication.**

```markdown
## 7. Approval & Sign-Off

### Customer Consent

- **Customer Name** (Anonymized): [Name]
- **Customer Role**: [Title/Team]
- **Consent Date**: YYYY-MM-DD
- **Consent Form**: [Link to signed form or email approval]

### Review Checklist

- ☐ Customer has approved case study content
- ☐ No real customer names or logos (unless explicitly approved)
- ☐ Metrics are verifiable and accurate
- ☐ Artifacts are sanitized (no secrets, API keys, sensitive data)
- ☐ Challenges and limitations are honestly disclosed
- ☐ No fabricated quotes or results

### Approval Sign-Off

- **Reviewed By**: [Maintainer name, date]
- **Approved By**: [Customer approval, date]
- **Published**: [Date published to docs/CASE_STUDIES.md]

---
```

---

## 3. Evidence Collection Checklist

Use this checklist when conducting a FirstTry deployment that will become a case study.

### Before Deployment

- [ ] Schedule regular check-ins with customer (weekly or bi-weekly)
- [ ] Define baseline metrics:
  - Current time per release review
  - Current error/miss rate
  - Current audit time per review
  - Policy compliance rates
- [ ] Document existing process (screenshots, workflow diagrams)
- [ ] Obtain customer consent to document deployment as case study
- [ ] Designate case study owner (who will collect data)

### During Deployment

**Daily**:
- [ ] Log deployment progress (time spent, blockers, decisions)
- [ ] Capture any unexpected issues or changes

**Weekly**:
- [ ] Meet with customer to review progress
- [ ] Document feedback (what's working, what's not)
- [ ] Take screenshots of running policies and audit trail
- [ ] Export metrics (issues evaluated, violations caught, time saved)

**At Milestones** (first release, first month, first quarter):
- [ ] Capture before/after metrics
- [ ] Document time savings with timestamps
- [ ] Collect team feedback (quotes, survey)
- [ ] Record any process changes needed

### After Deployment (Data Collection)

**Weeks 1–4** (Stabilization):
- [ ] Track time spent per release review
- [ ] Document violations caught vs. missed
- [ ] Capture user feedback (good and bad)
- [ ] Note any process adjustments

**Months 1–3** (Results Phase):
- [ ] Aggregate metrics (total time saved, error prevention, compliance improvement)
- [ ] Collect customer testimonials (with permission)
- [ ] Document challenges and how they were resolved
- [ ] Screenshot before/after states

**Month 3+** (Reflection):
- [ ] Conduct retrospective with customer
- [ ] Finalize quantified results
- [ ] Obtain final approval to publish case study
- [ ] Sanitize all artifacts and prepare for publication

### Evidence Collection Form (Template)

Use this form to track evidence as it's collected:

```
=== CASE STUDY EVIDENCE LOG ===

Case Study ID: CS-[YYYY-MM-DD-NAME]
Customer (Anonymized): [Name]
Problem Type: [Category]
Collector: [Your name]

DATE | ARTIFACT | DESCRIPTION | LOCATION | NOTES
-----|----------|-------------|----------|-------
2026-01-15 | Baseline metrics | Policy compliance before FirstTry | `/artifacts/case_study_01/baseline.json` | 40% compliance rate, 8 hours per release
2026-01-20 | Screenshot | FirstTry policies configured | `/artifacts/case_study_01/screenshots/setup.png` | Shows 5 policies, [ISSUE-123] evaluated
2026-02-10 | Metrics export | After 1 release | `/artifacts/case_study_01/metrics_week1.json` | 95% compliance, 2 hours per release
2026-02-14 | Customer quote | Team feedback | `/artifacts/case_study_01/feedback.txt` | [REDACTED]: "FirstTry saved us..."
...
```

---

## 4. Anonymization & Redaction Rules

### Before Publishing Any Case Study

**Remove or anonymize**:

| Sensitive Data | Redaction | Example |
|---|---|---|
| Customer company name | Use "[ANONYMIZED COMPANY]" | "[ANONYMIZED COMPANY], a [industry] with [size] users" |
| Customer logo | Remove or request permission | (Screenshot with logo: ask customer) |
| Real issue keys | Replace with [ISSUE-123] or [ISSUE-456] | Before: `PROJ-5432` → After: `[ISSUE-5432]` |
| User names | Use "[User A]" or role-based | Before: `contact@firsttry.run` → After: `[Senior Engineer]` |
| Email addresses | Replace with [contact@firsttry.run] | Before: `contact@firsttry.run` → After: `[customer support lead]` |
| Jira instance URLs | Use [jira.company.redacted] | Before: `https://acme-corp.atlassian.net` → After: `[internal Jira instance]` |
| API keys / tokens | Replace with [REDACTED] | Before: `token_abc123def456` → After: `[REDACTED]` |
| Financial data | Use ranges or percentages | Before: "$50,000 in revenue saved" → After: "tens of thousands in cost savings" |
| Personal info (DOB, location) | Remove entirely | Before: "John Smith, SF" → After: "Senior engineer" |

### Anonymization Strategy

**Option 1: Fully Anonymized** (Most Common)
- No company name, just "[ANONYMIZED COMPANY]"
- No individual names, just roles
- Results published: yes
- Customer identity: confidential

Example:
> Case Study: [ANONYMIZED COMPANY] — Automated Policy Enforcement for [Industry] Leader
> — 50+ user Jira instance reduced policy review time from 8 hours to 2 hours per release.

**Option 2: Partially Identified** (With Permission)
- Company name and/or logo published (customer consents)
- Individual quotes attributed to role only
- Results published

Example:
> Case Study: TechCorp Inc. — Automated Policy Enforcement for Financial Services
> — [Anonymous team lead]: "FirstTry saved us 6 hours per release."

**Option 3: Full Attribution** (Rare, Requires Explicit Approval)
- Company name, logo, and quotes with full attribution
- Must include signed approval form
- Results published

Example:
> Case Study: TechCorp Inc. — Automated Policy Enforcement for Financial Services
> — "FirstTry saved us 6 hours per release." — Sarah Chen, Engineering Manager, TechCorp

### Verification Checklist

Before publishing, verify:

- [ ] No API keys, tokens, or secrets in artifacts
- [ ] No real issue keys in screenshots (use [ISSUE-123] instead)
- [ ] No customer email addresses
- [ ] No personal information (names, DOB, location)
- [ ] No third-party logos without permission
- [ ] No financial data that reveals competitive advantage
- [ ] Customer has approved redacted content

---

## 5. How to Generate the First Real Case Study

### Prerequisites

Before starting, you need:

1. **An actual FirstTry deployment** in progress or completed
2. **A willing participant** (team, customer, or internal team)
3. **Baseline metrics** (before FirstTry)
4. **Customer consent** (written approval to document)
5. **Evidence collected** (logs, screenshots, metrics)

### Step-by-Step Procedure

#### Phase 1: Identify & Prepare (1 week before deployment)

1. **Identify a deployment candidate**:
   - Internal dogfood pilot (FirstTry team using FirstTry)
   - Early customer who volunteers
   - Open-source contributor with interesting use case

2. **Secure consent**:
   - Email or Slack: "We'd like to document this deployment as a case study. Would you be willing to participate?"
   - Explain: "We'll collect metrics, take screenshots, and publish results. Everything will be anonymized unless you want attribution."
   - Get approval (email reply or signed form)

3. **Define baseline metrics**:
   - Current time spent on manual process: `time before = ___ hours per release`
   - Current error/miss rate: `error rate before = ___%`
   - Current audit time: `audit time before = ___ hours per audit`
   - Current compliance rate: `compliance before = ___%`

4. **Document existing process**:
   - Screenshot current workflow (Confluence, Jira, Slack, email)
   - Write 1-paragraph description of "before" state

#### Phase 2: Collect Evidence (During deployment, 2–4 weeks)

1. **Weekly check-ins**:
   ```bash
   # Every Monday at 10am, meet with participant and log:
   - What we did this week (FirstTry setup, config, testing)
   - What worked well
   - What was difficult
   - Time invested
   - Any process changes
   ```

2. **Log metrics at key milestones**:
   ```bash
   # After each release or milestone:
   - Export FirstTry policy evaluation log
   - Time the policy review process
   - Count violations caught vs. missed
   - Document any issues encountered
   - Save to: /tmp/case_study_evidence/metrics_week_[N].json
   ```

3. **Capture artifacts**:
   ```bash
   # Screenshots (no real data visible):
   - FirstTry policies configured
   - Example issue evaluated by FirstTry
   - Audit trail (redacted)
   - Time tracking (hours per release)
   
   # Logs (sanitized):
   - FirstTry deployment log (remove secrets)
   - Policy evaluation log (remove real issue keys)
   - Team feedback (redact names)
   ```

#### Phase 3: Analyze & Document (After 4+ weeks)

1. **Compute quantified results**:
   ```bash
   # Example calculations:
   time_saved = time_before - time_after
   percent_reduction = (time_saved / time_before) * 100
   errors_prevented = violations_caught - violations_before
   compliance_improvement = compliance_after - compliance_before
   ```

2. **Fill out case study template**:
   - Section 1: Context & Environment
   - Section 2: Problem Statement (quantified "before")
   - Section 3: Solution & Setup
   - Section 4: Results & Outcomes (quantified "after")
   - Section 5: Challenges & Lessons
   - Section 6: Evidence & Artifacts

3. **Collect final feedback**:
   ```bash
   # Email participant:
   "We've documented the deployment. Here's the draft case study.
   Can you review and provide feedback / quotes?
   Any final comments on challenges or recommendations for others?"
   ```

4. **Anonymize & sanitize**:
   - Replace customer name with [ANONYMIZED COMPANY]
   - Replace real issue keys with [ISSUE-123]
   - Remove real email addresses and names
   - Verify no API keys or secrets in artifacts

5. **Get final approval**:
   - Share anonymized draft with participant
   - Get written approval: "You can publish this"
   - Save approval email

#### Phase 4: Publish (1 week)

1. **Create case study file**:
   ```bash
   cp docs/CASE_STUDIES.md docs/CASE_STUDIES.md.backup
   # Append new case study to docs/CASE_STUDIES.md (Section 6)
   ```

2. **Create artifact directory**:
   ```bash
   mkdir -p docs/artifacts/case_study_01_[problem_type]
   cp /tmp/case_study_evidence/* docs/artifacts/case_study_01_[problem_type]/
   ```

3. **Commit & push**:
   ```bash
   git add docs/CASE_STUDIES.md docs/artifacts/case_study_01_*/
   git commit -m "docs(sales): add first real case study [problem type]"
   git push origin main
   ```

4. **Announce**:
   - Link to case study in release notes
   - Share with customer (if not anonymized)
   - Reference in marketing/sales materials

---

## 6. Case Study Program Status

**⚠️ NO FABRICATED CASE STUDIES — REAL DATA ONLY**

As of this document, FirstTry has NOT been deployed to production customers yet. Therefore:

- ❌ NO fabricated customer stories
- ❌ NO invented metrics or ROI figures  
- ❌ NO hypothetical deployment timelines
- ✅ Case studies will be published ONLY after real customer deployments with verified data

### When Case Studies Will Be Available

Case studies require:
1. **Real customer deployment** of FirstTry in production Jira
2. **Measurable governance impact** (audit logs, policy snapshots, evidence exports)
3. **Customer consent** for anonymized documentation
4. **Verification** of metrics (time savings, error reduction, risk mitigation)

### Example Structure (For Future Reference)

When we publish case studies, they will follow this structure:

```markdown
# Case Study: [ANONYMIZED CUSTOMER] — Governance Automation

**Date Completed**: [Real deployment date]
**Evidence**: [Link to actual FirstTry policy logs and exports]
**Metrics Verified**: [By FirstTry audit trail, customer-approved]

## Environment & Challenge
[Real details from customer deployment]

## Quantified Impact
- **Before**: Time per governance cycle (actual measurement)
- **After**: Time per cycle with FirstTry automation (actual data)
- **Error Reduction**: Policies missed → Actual catch rate with evidence
- **Business Outcome**: Risk mitigation, audit readiness, team efficiency

## Implementation Details
[Real timeline, customer's governance model, actual policy complexity]

## Lessons Learned
[Genuine insights from deployment]
```

---

## 7. How to Contribute a Case Study

If you deploy FirstTry and would like to share your experience:

1. **Contact us** at [support email] with interest
2. **Provide anonymization approach** (company name, team size anonymity level)
3. **Share FirstTry exports** (policy evaluation logs, snapshot data, audit trails)
4. **Review and approve** before publication

We will help you:
- ✅ Anonymize sensitive details
- ✅ Extract verified metrics from FirstTry logs
- ✅ Draft the story with your insights
- ✅ Ensure accuracy and compliance

---

## OLD: Placeholder Case Study Template

[Describe FirstTry configuration — awaiting real deployment]

---

## 4. Results & Outcomes

### Quantified Impact (After)

- **Time Savings**: [X hours] → [Y hours] = [Z%] reduction
- **Error Prevention**: [X%] compliance improvement
- **Audit Efficiency**: [X minutes] per audit

*Awaiting first real deployment to populate these metrics.*

---

## 5. Challenges & Lessons

[To be documented from first real deployment]

---

## 6. Evidence & Artifacts

[To be added from first real deployment]

---
```

---

## 7. FAQ & Guidance

### Q: Can we make up a case study?

**No.** All case studies must be based on real deployments. If FirstTry is new and has no deployments yet, we publish case study templates (like this) and wait for the first real deployment.

---

### Q: Can we use anonymized metrics from a real deployment but with a fictional customer story?

**No.** The entire case study must be real: customer (anonymized or not), problem, setup, and results. We don't mix real metrics with fictional narratives.

---

### Q: What if the results aren't impressive (e.g., small time savings)?

**Publish anyway.** Honest modest results are better than fabricated impressive ones. Readers will trust real data more than perfect metrics.

---

### Q: Can we publish a case study if the deployment failed?

**Yes, if it's honest.** Document what went wrong, why, and what was learned. Failure case studies can be more valuable than success stories.

---

### Q: How long before we have the first real case study?

**Depends on**: When FirstTry is deployed to a production environment with a willing participant. Could be weeks to months. We don't rush; we wait for real results.

---

### Q: Can customers opt out of being in a case study?

**Yes.** All participation is voluntary. If a customer doesn't want documentation, we respect that.

---

## 8. Related Documentation

- [docs/SUPPORT.md](SUPPORT.md) — How to get help (often source of case study ideas)
- [docs/COMPLIANCE.md](COMPLIANCE.md) — What FirstTry is/isn't (context for case studies)
- [docs/MARKETPLACE_LISTING.md](MARKETPLACE_LISTING.md) — Marketing copy (case studies can support claims)

---

## 9. Status: Awaiting First Real Deployment

**Current Status**: Template only  
**First Case Study**: [Awaiting real deployment & customer participation]  
**Estimated Timeline**: Q1–Q2 2026 (or whenever first production deployment occurs)

This document will be updated when the first real case study is completed and published.

---

**End of Case Studies Template**

*This framework ensures that when FirstTry case studies are published, they will be honest, evidence-based, and built on real customer deployments — not fabrication.*
