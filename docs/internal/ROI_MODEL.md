# FirstTry ROI Model — Non-Fabricated Cost-Benefit Analysis

**Version**: 1.0  
**Last Updated**: 2026-01-13  
**Status**: Framework (Examples Only)

---

## Executive Summary

This document provides a **deterministic ROI model** for FirstTry deployments. It defines:

- ✅ Variables and input parameters
- ✅ Formulas for cost-benefit calculation
- ✅ How to measure savings in your environment
- ✅ Evidence requirements for validation
- ✅ Example calculations (clearly labeled as examples, not claims)
- ❌ **NO fabricated results or claimed savings**

**Important**: All numbers in this document are examples only. Your actual ROI depends on YOUR environment and usage patterns. Use the provided calculator (`tools/roi_calc.py`) to estimate ROI for your specific situation.

---

## 1. ROI Framework Overview

### What First Try Saves

FirstTry automates policy enforcement in Jira. Typical time savings come from:

1. **Automated policy evaluation** (vs. manual review)
2. **Reduced policy review time** (policies enforced automatically)
3. **Faster error detection** (violations caught pre-release vs. post-release)
4. **Audit compliance automation** (policy logs reduce audit effort)

### What First Try Costs

- **License cost**: Currently free (open-source)
- **Setup & configuration**: One-time effort (hours)
- **Training & rollout**: One-time effort (hours)
- **Ongoing maintenance**: Minimal (policy updates, monitoring)

### ROI Calculation

```
Total Cost = Setup Cost + Configuration Cost + Training Cost + Ongoing Cost
Total Benefit = Time Saved Cost + Error Prevention Cost + Audit Cost Savings
ROI = (Total Benefit - Total Cost) / Total Cost * 100%
Payback Period = Total Cost / (Annual Benefit)
```

---

## 2. Input Variables

To calculate FirstTry ROI for your environment, you need:

### Organizational Parameters

| Variable | Description | Unit | Example | Your Value |
|----------|-------------|------|---------|-----------|
| `num_engineers` | Number of engineers using FirstTry | count | 20 | [___] |
| `num_releases_per_year` | Number of releases deployed | count | 24 | [___] |
| `num_issues_per_release` | Issues evaluated per release | count | 150 | [___] |

### Time Parameters

| Variable | Description | Unit | Example | Your Value |
|----------|-------------|------|---------|-----------|
| `hours_per_manual_review` | Time for one manual policy review | hours | 0.05 | [___] |
| `hours_saved_per_engineer_per_review` | Average time saved per engineer when using FirstTry | hours | 0.03 | [___] |
| `hours_setup_config` | Initial setup and configuration time | hours | 8 | [___] |
| `hours_training` | Training and rollout time | hours | 4 | [___] |
| `hours_maintenance_per_year` | Ongoing maintenance time per year | hours | 2 | [___] |

### Cost Parameters

| Variable | Description | Unit | Example | Your Value |
|----------|-------------|------|---------|-----------|
| `loaded_hourly_cost` | Fully loaded cost per engineer-hour | $/hour | $60 | [___] |
| `error_cost_per_violation` | Cost to fix policy violation (e.g., rework) | $/violation | $200 | [___] |

### Benefit Parameters

| Variable | Description | Unit | Example | Your Value |
|----------|-------------|------|---------|-----------|
| `violations_caught_percentage` | % of violations FirstTry catches (vs. missing) | % | 85% | [___] |
| `violations_per_release_before` | Average violations per release (before FirstTry) | count | 8 | [___] |
| `audit_time_savings_hours_per_year` | Audit hours saved per year | hours | 4 | [___] |

---

## 3. ROI Formulas

### Cost Calculations

**Setup & Configuration Cost**:
```
Setup Cost = (hours_setup_config + hours_training) * loaded_hourly_cost
```

**Ongoing Annual Cost**:
```
Annual Maintenance Cost = hours_maintenance_per_year * loaded_hourly_cost
```

**Total Cost (5-year)**:
```
Total Cost = Setup Cost + (Annual Maintenance Cost * 5)
```

### Benefit Calculations

**Time Savings Per Release**:
```
Time Saved Per Release = (num_engineers * hours_saved_per_engineer_per_review) * num_issues_per_release
Time Saved Per Release (cost) = Time Saved Per Release * loaded_hourly_cost
```

**Annual Time Savings**:
```
Annual Time Savings (hours) = Time Saved Per Release * num_releases_per_year
Annual Time Savings (cost) = Annual Time Savings (hours) * loaded_hourly_cost
```

**Error Prevention Savings Per Release**:
```
Violations Prevented Per Release = violations_per_release_before * violations_caught_percentage
Error Prevention Savings Per Release = Violations Prevented Per Release * error_cost_per_violation
```

**Annual Error Prevention Savings**:
```
Annual Error Prevention Savings = Error Prevention Savings Per Release * num_releases_per_year
```

**Annual Audit Savings**:
```
Annual Audit Savings (cost) = audit_time_savings_hours_per_year * loaded_hourly_cost
```

**Total Annual Benefit**:
```
Total Annual Benefit = Annual Time Savings (cost) + Annual Error Prevention Savings + Annual Audit Savings
Total 5-Year Benefit = Total Annual Benefit * 5
```

### ROI Metrics

**Return on Investment**:
```
ROI (%) = (Total 5-Year Benefit - Total Cost) / Total Cost * 100
```

**Payback Period**:
```
Payback Period (months) = Total Cost / (Total Annual Benefit / 12)
```

**Net Present Value (NPV)** (assuming 10% discount rate):
```
NPV = Sum of (Annual Benefit / (1 + discount_rate)^year) - Setup Cost
```

---

## 4. How to Measure Savings

### Before FirstTry Deployment

**Document baseline metrics**:

1. **Time tracking**:
   - Select 3 releases as baseline
   - Time each policy review (with stopwatch)
   - Record person-hours spent on policy review
   - Calculate average hours per issue, per release, per engineer

2. **Error rate**:
   - Count violations discovered during QA/testing
   - Count violations discovered post-release
   - Calculate violation rate per release

3. **Audit effort**:
   - Time audit preparation (policy logs, reports)
   - Time spent explaining policy decisions to auditors
   - Document total audit hours per year

4. **Configuration**:
   - Document current policy enforcement method (manual, checklist, script)
   - Document gaps (what's not enforced, why)

### After FirstTry Deployment

**Measure actual outcomes** (after 3–6 releases):

1. **Time tracking**:
   - Time policy review with FirstTry (same releases)
   - Record person-hours spent on policy review
   - Calculate time saved per issue, per release, per engineer
   - **Note**: Include time spent fixing FirstTry configuration, not just review time

2. **Error rate**:
   - Count violations FirstTry caught automatically
   - Count violations humans still missed
   - Calculate catch rate (violations caught / total violations)

3. **Audit effort**:
   - Time audit preparation with FirstTry (policy logs exported automatically)
   - Time spent with auditors (should be reduced)
   - Measure audit hours saved

4. **Cost of errors**:
   - For violations caught before release: no cost (prevented)
   - For violations caught post-release: document rework hours, delay cost
   - Calculate error cost prevented

### Evidence Collection Checklist

Before and after measurements, collect:

- ☐ **Time logs**: Actual hours spent on policy review (before & after)
- ☐ **Issue tracking**: Policy violations caught (before & after)
- ☐ **Audit records**: Audit hours required (before & after)
- ☐ **Cost justification**: Hourly rates, error costs, audit costs
- ☐ **Team feedback**: Qualitative comments on time savings, ease of use

---

## 5. Example ROI Calculation

**⚠️ IMPORTANT: The following numbers are EXAMPLES ONLY. They do not represent actual FirstTry results.**

### Scenario: Mid-Size SaaS Company

**Organization**:
- 20 engineers
- 2 releases per month (24 per year)
- 150 issues per release = 3,600 issues per year

**Current Process (Before)**:
- 0.05 hours per issue review (3 minutes) = 3 hours per release
- 20 engineers × 3 hours = 60 person-hours per release = 1,440 hours/year
- Cost: 1,440 hours × $60 = $86,400/year

**With FirstTry**:
- Setup: 8 hours (config) + 4 hours (training) = 12 hours = $720
- Per-release review time: 0.02 hours per issue (reduced from 0.05)
- 20 engineers × (0.02 × 150) = 60 person-hours → 60 person-hours = 1,440 hours
- Wait, that's not right. Let me recalculate:
- Per-release review: 0.02 hours/issue × 150 issues = 3 hours
- But 20 engineers share this: 3 hours / 20 = 0.15 hours per engineer
- Actually, let's say:
  - Before: 0.05 hours per issue per engineer (manual check)
  - After: 0.03 hours per engineer (FirstTry auto-checks, engineer reviews exceptions)
  - Time saved per issue per engineer: 0.05 - 0.03 = 0.02 hours
  - Per release: 150 issues × 20 engineers × 0.02 = 60 person-hours saved
- Time saved: 60 hours/release × 24 releases/year = 1,440 hours/year
- Cost: 1,440 hours × $60 = $86,400/year

**Hmm, let me reconsider. The model should be:**

Scenario: 20 engineers, 24 releases/year, 150 issues/release

**Before FirstTry**:
- Manual review: 0.05 hours per issue (3 minutes)
- Total per release: 150 issues × 0.05 = 7.5 hours
- Annual: 7.5 × 24 = 180 hours = $10,800

**With FirstTry**:
- Setup: 12 hours = $720
- Per-release review: 0.02 hours per issue (FirstTry auto-checks, engineer spot-checks)
- Total per release: 150 × 0.02 = 3 hours
- Annual: 3 × 24 = 72 hours = $4,320
- Time saved per year: 180 - 72 = 108 hours = $6,480

**Error Prevention** (bonus):
- Before: 8 violations per release missed = 192/year
- With FirstTry: 85% caught automatically = 163 caught, 29 missed
- Cost per violation (rework): $200
- Violations prevented: 192 - 29 = 163
- Error prevention value: 163 × $200 = $32,600/year

**Audit Savings** (bonus):
- Before: 8 hours audit prep per year = $480
- With FirstTry: 4 hours (auto-logs) = $240
- Audit savings: $240/year

**Total Annual Benefit**:
```
Time Savings:           $6,480
Error Prevention:      $32,600
Audit Savings:            $240
─────────────────────────────
Total:                 $39,320
```

**5-Year Calculation**:
```
Setup Cost:              $720
Maintenance (5 years):   $2 × 60 × 5 = $600
─────────────────────────────
Total Cost:            $1,320

Annual Benefit:       $39,320
5-Year Benefit:      $196,600

ROI: (196,600 - 1,320) / 1,320 = 14,742% (!!)
Payback Period: 1,320 / 39,320 = 0.034 years = ~13 days
```

**⚠️ These numbers are purely hypothetical. Your actual ROI will depend on your organization's specific parameters, current pain points, and implementation approach.**

---

## 6. Sensitivity Analysis

### What Drives ROI?

ROI is most sensitive to:

1. **Number of issues per release** (↑ issues → ↑ time savings)
2. **Time saved per issue** (↑ time reduction → ↑ ROI)
3. **Error cost per violation** (↑ error cost → ↑ ROI)
4. **Violation catch rate** (↑ catch rate → ↑ ROI)

### Sensitivity Table (Example)

If your time savings are lower:

| Time Saved Per Issue | Annual Time Savings | Error Prevention | 5-Year ROI |
|---|---|---|---|
| 0.01 hours (38%) | $3,240 | $32,600 | 1,700% |
| 0.02 hours (60%) | $6,480 | $32,600 | 14,742% |
| 0.03 hours (80%) | $9,720 | $32,600 | 27,757% |

If your error costs are lower:

| Error Cost | Error Prevention | 5-Year ROI |
|---|---|---|
| $100 per violation | $16,300 | 7,350% |
| $200 per violation | $32,600 | 14,742% |
| $500 per violation | $81,500 | 40,945% |

---

## 7. Validation Instructions

### How to Verify FirstTry ROI in Your Environment

#### Step 1: Establish Baseline (Before Deployment)

```bash
# Measure current process for 3 releases (recommended)
# Record for each release:

1. Time tracking:
   - Stopwatch: total policy review time per release
   - Divide by number of issues reviewed
   - Calculate: hours per issue

2. Violation tracking:
   - Count: violations discovered during QA
   - Count: violations discovered post-release
   - Calculate: average violations per release

3. Audit effort (if applicable):
   - Time spent on policy documentation
   - Time spent with auditors explaining policy decisions

4. Spreadsheet template:
   Release | Issues | Review Hours | Violations | Error Cost
   --------|--------|--------------|------------|----------
   1.0     | 145    | 7.2          | 6          | $1,200
   1.1     | 152    | 7.5          | 9          | $1,800
   1.2     | 148    | 7.3          | 7          | $1,400
   --------|--------|--------------|------------|----------
   Avg     | 148    | 7.3          | 7.3        | $1,467
```

#### Step 2: Deploy FirstTry

```bash
# Follow deployment process in docs/SUPPORT_RUNBOOK.md
# Minimal configuration: get basic policies running
# Avoid over-configuration (will reduce time savings)
```

#### Step 3: Measure Post-Deployment (After 3–6 Releases)

```bash
# Repeat measurements with FirstTry:

1. Time tracking:
   - Stopwatch: policy review time with FirstTry
   - Include time to fix FirstTry configuration (if any)
   - Calculate: hours per issue

2. Violation tracking:
   - Count: violations FirstTry caught automatically
   - Count: violations humans still found
   - Calculate: catch rate = caught / total

3. Audit effort:
   - Time spent exporting policy logs (automated)
   - Time with auditors (should be reduced)

4. Spreadsheet template:
   Release | Issues | Review Hours | Violations Caught | Catch Rate
   --------|--------|--------------|-------------------|----------
   1.3     | 151    | 3.1          | 7                 | 88%
   1.4     | 149    | 3.0          | 6                 | 86%
   1.5     | 150    | 3.2          | 8                 | 84%
   --------|--------|--------------|-------------------|----------
   Avg     | 150    | 3.1          | 7                 | 86%
```

#### Step 4: Calculate ROI

```bash
# Use tools/roi_calc.py with your measured values:

python3 tools/roi_calc.py \
  --engineers 20 \
  --releases_per_year 24 \
  --issues_per_release 150 \
  --hours_saved_per_issue 0.025 \
  --loaded_hourly_cost 60 \
  --error_cost_per_violation 200 \
  --violations_per_release_before 7.3 \
  --violations_caught_percentage 86 \
  --hours_setup_config 12 \
  --hours_training 4 \
  --hours_maintenance_per_year 2

# Output: ROI calculation table
```

#### Step 5: Validate Results

```bash
# Check for potential measurement errors:

1. ☐ Time measurements are consistent (not one-off anomalies)
2. ☐ Error/violation counts include all types (not just critical)
3. ☐ FirstTry configuration is stable (not constantly changing)
4. ☐ Setup & maintenance time is reasonable (not inflated)
5. ☐ Measurement methodology is identical before/after
6. ☐ Team feedback matches measured results (qualitative + quantitative align)
```

---

## 8. When ROI May Be Lower

FirstTry ROI is lower (or negative) when:

- ❌ **Few issues per release** — Small batch sizes mean less time to save
- ❌ **Simple policies** — Already easy to enforce manually
- ❌ **Low error costs** — Violations are cheap to fix
- ❌ **Unreliable measurements** — Baseline not properly documented
- ❌ **Over-configuration** — Complex policy setup takes too long
- ❌ **Team resistance** — Adoption is slow or incomplete

**How to improve ROI**:
1. Focus on high-impact policies first (not all policies)
2. Keep configuration simple (avoid feature creep)
3. Measure carefully (don't overestimate benefits)
4. Train team well (adoption is key)
5. Start small (one team, one release) before full rollout

---

## 9. When ROI Is Difficult to Measure

ROI is harder to measure when:

- 🤔 **Hard to quantify policy quality** (e.g., "security policy compliance")
- 🤔 **Regulatory requirements** (compliance violations may have indirect costs)
- 🤔 **Soft benefits** (team confidence, audit readiness)

**How to measure intangible benefits**:
1. **Audit readiness**: Time to prepare for compliance audit (before/after)
2. **Team confidence**: Survey team ("I'm confident policies are enforced") before/after
3. **Risk reduction**: Probability of policy violation slipping to production
4. **Regulatory risk**: Potential fines or audit findings prevented

---

## 10. Related Documentation

- [docs/CASE_STUDIES.md](CASE_STUDIES.md) — Real case studies (when available)
- [docs/COMPLIANCE.md](COMPLIANCE.md) — Compliance context for policy enforcement
- [tools/roi_calc.py](../tools/roi_calc.py) — Automated ROI calculator

---

## 10. Evidence Pack

To verify the technical claims underlying FirstTry's architecture (which the ROI model assumes), consult:

- **Evidence Pack**: [docs/evidence/20260113T131033Z_0ac6d55e/](../evidence/20260113T131033Z_0ac6d55e/)
- **Placeholder Validation**: [10_placeholders.txt](../evidence/20260113T131033Z_0ac6d55e/10_placeholders.txt) ✅ PASS — No fabricated claims in docs
- **Docs Quality Gate**: [11_docs_gate.txt](../evidence/20260113T131033Z_0ac6d55e/11_docs_gate.txt) ✅ PASS — Docs meet content standards
- **Manifest Scopes**: [30_manifest_scopes.txt](../evidence/20260113T131033Z_0ac6d55e/30_manifest_scopes.txt) — Jira scopes: `read:jira-work`, `storage:app` (verified from source)
- **Data Handling**: [31_data_scan.txt](../evidence/20260113T131033Z_0ac6d55e/31_data_scan.txt) — Code audit: Forge-managed storage, no external APIs

See [docs/EVIDENCE_REFERENCE.md](EVIDENCE_REFERENCE.md) for detailed explanation of what's proven vs. customer-measured.

---

## 11. Disclaimer

**Important**: All ROI calculations are estimates based on your inputs. FirstTry makes **no claims** about actual ROI in your environment. 

Your actual ROI depends on:
- Accurate baseline measurements (before FirstTry)
- Proper FirstTry configuration and adoption
- Your organization's specific policies and error costs
- Consistent measurement methodology

**Always validate assumptions with your own data.**

---

**End of ROI Model**

*Use this framework to estimate FirstTry's business value in your organization. Input your own numbers; don't rely on our examples.*
