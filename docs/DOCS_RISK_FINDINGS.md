# PHASE 3-4: RISK-BASED CLASSIFICATION & CONTENT RISK SCAN

## Classification Summary

**Total P0 Documents Audited**: 15  
**Total Risk Findings**: 18  
**Risk Categories**: SLA/Guarantee, Auto-Escalation, SEV Levels, Promise Language  

---

## PHASE 3: Risk Classification

### P0 — Reviewer-Critical (Marketplace + Enterprise)

| File | Priority | Audience | Justification |
|------|----------|----------|---------------|
| docs/SUPPORT.md | P0 | Marketplace, Enterprise | Public support policy, SLA reference |
| docs/SECURITY.md | P0 | Enterprise Security | Security claims verification |
| docs/PRIVACY.md | P0 | Enterprise Compliance | Data handling, retention claims |
| docs/MARKETPLACE_LEGAL_IMPLEMENTATION.md | P0 | Marketplace Reviewers | Compliance checklist |
| docs/RELIABILITY.md | P0 | Enterprise + Marketplace | SLA/uptime positioning |
| docs/legal/service-level-agreement.md | P0 | Legal + Enterprise | SLA document (non-binding) |
| atlassian/forge-app/docs/SUPPORT.md | P0 | Marketplace + Enterprise | Alternative support policy |

### P1 — Enterprise-Facing

- docs/ENTERPRISE_ONE_PAGER.md
- docs/SCOPES.md
- docs/COMPLIANCE.md
- docs/DATA_RETENTION.md
- docs/DATA_INVENTORY.md
- docs/INCIDENT_RESPONSE.md

### P2 — Internal/Informational

- Audit reports, design docs, roadmaps, implementation guides
- (Remaining 2,761 files)

---

## PHASE 4: CONTENT RISK FINDINGS

### Finding Summary

| Category | Count | Severity | Action |
|----------|-------|----------|--------|
| SLA_GUARANTEE | 11 | 🔴 CRITICAL | Remove/Downgrade |
| AUTO_ESCALATION | 1 | 🔴 CRITICAL | Remove |
| SEV_LEVELS | 1 | 🟡 MEDIUM | Clarify/Remove |
| PROMISE | 2 | 🟡 MEDIUM | Review |

---

### CRITICAL FINDINGS (Immediate Action Required)

#### Finding 1: AUTO_ESCALATION in SUPPORT.md
**File**: `atlassian/forge-app/docs/SUPPORT.md`  
**Line**: 104  
**Category**: AUTO_ESCALATION  
**Quote**: "If any SLI drops below target, we escalate automatically."  
**Risk**: Implies automatic escalation capability → misleading about support model  
**Severity**: 🔴 CRITICAL  
**Fix**: REMOVE — Replace with "If any SLI drops below target, we review and may escalate" (not automatic)

**Verification Status**: UNVERIFIABLE — No code evidence that escalation is automatic

---

#### Finding 2: SLA_GUARANTEE in service-level-agreement.md
**File**: `docs/legal/service-level-agreement.md`  
**Multiple Lines**: 1, 9, 11, 30, 38, 51  
**Category**: SLA_GUARANTEE  
**Quotes**:
- Line 1: "# Service Level Agreement (SLA)" — Document title
- Line 9: "FirstTry does not claim 99.9% uptime..."
- Line 11: "Firsttry intends to acknowledge support requests within 2–5 business days"
- Line 30: "Firsttry intends to acknowledge within 2–5 business days"
- Line 38: "This SLA does not apply to..."
- Line 51: "This SLA...is informational and non-binding..."

**Risk**: SLA document exists + contains response time targets (2-5 days) → could be misinterpreted as binding

**Severity**: 🔴 CRITICAL  
**Fix**: DOWNGRADE — Add explicit disclaimer on Line 1-5: "This is NOT a legal SLA. It describes intentions only."  
**Alternative**: MOVE to `/docs/ARCHIVE/` and remove from public reference

---

#### Finding 3: SLA_GUARANTEE Reference in docs/SUPPORT.md
**File**: `docs/SUPPORT.md`  
**Line**: 211  
**Category**: SLA_GUARANTEE  
**Quote**: "- [Reliability SLAs](./RELIABILITY.md)"  
**Risk**: References "Reliability SLAs" in link text → implies SLA exists  
**Severity**: 🔴 CRITICAL  
**Fix**: DOWNGRADE — Change link text to "- [Reliability Model](./RELIABILITY.md)"

---

#### Finding 4: SEV1 Language in SUPPORT.md
**File**: `atlassian/forge-app/docs/SUPPORT.md`  
**Line**: 131  
**Category**: SEV_LEVELS  
**Quote**: "3. If SEV1 unresolved after an agreed acknowledgement, escalate within repository issue to maintainers"  
**Risk**: Defines SEV1 severity levels → implies structured SLA response  
**Severity**: 🟡 MEDIUM  
**Fix**: DOWNGRADE — Replace "SEV1" with "critical issue" (remove formal SLA terminology)

---

### MODERATE FINDINGS (Review Required)

#### Finding 5: SLA/NO-SLA Disclaimers (Good but Scattered)
**Files**:
- atlassian/forge-app/docs/SUPPORT.md:13 → "no SLA"
- atlassian/forge-app/docs/SUPPORT.md:21 → "Best effort (no SLA)"
- atlassian/forge-app/docs/SUPPORT.md:27 → "no guaranteed SLA"
- atlassian/forge-app/docs/SUPPORT.md:62 → "NO SERVICE LEVEL AGREEMENT (SLA)"
- atlassian/forge-app/docs/SUPPORT.md:65 → "no guaranteed timeframe"

**Risk**: Multiple inconsistent disclaimers → marketplace reviewers may miss the primary disclaimer

**Severity**: 🟡 MEDIUM  
**Fix**: CONSOLIDATE — Add single prominent SLA disclaimer at TOP of file:
```
⚠️ **NO SERVICE LEVEL AGREEMENT**: FirstTry provides support on a best-effort basis 
with no guaranteed response times, resolution SLAs, or uptime guarantees.
```

---

#### Finding 6: "No commitment" Language
**File**: `atlassian/forge-app/docs/SUPPORT.md`  
**Line**: 41  
**Category**: PROMISE  
**Quote**: "✅ **Feature Requests**: Suggestions for future enhancements (no commitment)"

**Risk**: Using checkmark (✅) next to "Feature Requests" suggests supported → "(no commitment)" disclaimer may be missed

**Severity**: 🟡 MEDIUM  
**Fix**: DOWNGRADE — Replace checkmark with ℹ️ (info) or ℹ️ (pending)

---

#### Finding 7: SLA Targets in docs/RELIABILITY.md
**File**: `docs/RELIABILITY.md`  
**Line**: 7-9  
**Category**: SLA_GUARANTEE  
**Quote**: "FirstTry does not claim 99.9% uptime; it runs within Jira Cloud and Forge..."

**Risk**: Mentions uptime percentages → could be misinterpreted as targets

**Severity**: 🟡 MEDIUM (Mitigated by "does not claim")  
**Fix**: SAFE — Document already disclaims percentages. No change needed.

---

#### Finding 8: Response Targets in docs/SECURITY.md
**File**: `docs/SECURITY.md`  
**Line**: 38  
**Category**: SLA_GUARANTEE  
**Quote**: "**Note**: Targets, not SLAs. Actual response depends on complexity."

**Risk**: References "response targets" → may be confused with SLA targets

**Severity**: 🟡 MEDIUM (Mitigated by "not SLAs" disclaimer)  
**Fix**: SAFE — Document already disclaims SLA status. Consider clarifying "intentions only."

---

## Risk Classification by Severity

### 🔴 CRITICAL (Must Fix Before Marketplace Submission)

1. **auto-escalation claim** (SUPPORT.md:104)
   - Status: UNVERIFIABLE
   - Action: REMOVE

2. **SLA document title + response targets** (service-level-agreement.md)
   - Status: UNVERIFIABLE (targets not implemented in code)
   - Action: DOWNGRADE + ADD DISCLAIMER

3. **SLA link reference** (docs/SUPPORT.md:211)
   - Status: UNVERIFIABLE (title implies SLA status)
   - Action: DOWNGRADE LINK TEXT

### 🟡 MEDIUM (Should Fix)

4. **SEV1/SEV2 terminology** (SUPPORT.md:131)
   - Status: Informational only
   - Action: REPLACE WITH "critical issue"

5. **Scattered SLA disclaimers** (Multiple files)
   - Status: Present but inconsistent
   - Action: CONSOLIDATE

6. **"No commitment" with checkmark** (SUPPORT.md:41)
   - Status: Could be misleading
   - Action: DOWNGRADE ICON

---

## No False SLA Claims Found ✅

**Positive Finding**: Both SUPPORT.md files explicitly state:
- "NO SERVICE LEVEL AGREEMENT"
- "Best effort only"
- "No guaranteed response time"
- "No uptime guarantees"

**However**: The existence of the `service-level-agreement.md` document + auto-escalation claim + scattered disclaimers create **marketplace risk**.

---

## Evidence Files Generated

- `/tmp/docs_audit_v2_01_all_files.txt` — File list (2,778 files)
- `/tmp/phase4_findings.txt` — Detailed risk scan
- `/workspaces/Firsttry/docs/DOCS_LINK_GRAPH.md` — Link graph
- `/workspaces/Firsttry/docs/DOCS_RISK_FINDINGS.md` — This document

---

## Next Steps (Phases 5-11)

**PHASE 5**: Verify each claim is IMPLEMENTED / DOCUMENTED / CONCEPTUAL  
**PHASE 6**: Cross-check consistency  
**PHASE 7**: Create fix plan  
**PHASE 8**: Apply fixes  
**PHASE 9**: Re-verify marketplace safety  
**PHASE 10-11**: Final validation + report  

**Decision Required**: Proceed with fixes or STOP for human review?
