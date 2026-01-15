# PHASE 7: FIX PLAN (NO SILENT EDITS)

**Date**: 2025-01-15T07:40:00Z  
**Status**: 📋 Action Plan (Ready for Implementation)

---

## Fix Strategy

For each finding, decision = ONE of:
- ✅ SAFE (no action needed)
- 🔧 DOWNGRADE LANGUAGE (rewrite)
- ❌ REMOVE CLAIM (delete)
- ⛔ STOP (requires human decision)

---

## Fix Schedule by Priority

### CRITICAL FIXES (Phase 8, Step 1-3)

#### Fix 1: docs/PRIVACY.md — Add SLA Disclaimer
**Status**: 🔧 DOWNGRADE  
**Action**: Insert SLA disclaimer section at end  
**Justification**: Privacy docs must reference support model to prevent assumption that privacy guarantees imply support guarantees

**Implementation**:
- Location: End of file, before "Contact" section
- Content:
```markdown
## Support Model & SLA Status

FirstTry provides NO SERVICE LEVEL AGREEMENT (SLA) for privacy or data handling.
- **Response Time**: Best effort (no guaranteed response)
- **Data handling requests**: Processed when available (voluntary maintenance basis)
- **Support**: GitHub Issues, best-effort basis only

See [SUPPORT_POLICY.md](../SUPPORT_POLICY.md) for full support scope.
```

**File Path**: `docs/PRIVACY.md`  
**Line**: Insert before final section (approx. end of file)

---

#### Fix 2: docs/legal/service-level-agreement.md — Add Non-Binding Disclaimer
**Status**: 🔧 DOWNGRADE  
**Action**: Add prominent disclaimer at document top

**Justification**: Document title "Service Level Agreement" could mislead marketplace reviewers despite non-binding clause at end

**Implementation**:
- Location: Lines 1-4 (add BEFORE current title)
- Content:
```markdown
⚠️ **NON-BINDING INFORMATIONAL DOCUMENT**

**FirstTry provides NO SERVICE LEVEL AGREEMENT.** This document is informational only 
and does not constitute a legal SLA or support guarantee. See disclaimers below.

---

```

**File Path**: `docs/legal/service-level-agreement.md`  
**Line**: Insert at top (before current "# Service Level Agreement (SLA)")

---

#### Fix 3: docs/SUPPORT.md — Add NO-SLA Header & Fix Link Text
**Status**: 🔧 DOWNGRADE (2 parts)  

**Part 3a - Add NO-SLA disclaimer at top**:
- Location: Lines 1-5 (add after title)
- Content:
```markdown

⚠️ **IMPORTANT**: This page describes best-effort support. FirstTry provides 
**NO SERVICE LEVEL AGREEMENT** (SLA), no guaranteed response times, and no 
uptime guarantees.

```

**Part 3b - Change link text**:
- Location: Line 211
- OLD: `- [Reliability SLAs](./RELIABILITY.md)`
- NEW: `- [Reliability Model](./RELIABILITY.md)`

**File Path**: `docs/SUPPORT.md`  
**Lines**: 1-5 (add), 211 (modify)

---

### HIGH PRIORITY FIXES (Phase 8, Step 4-5)

#### Fix 4: docs/SECURITY.md — Add Best-Effort Qualifier
**Status**: 🔧 DOWNGRADE  
**Action**: Add best-effort language to response target section

**Justification**: Security docs mention response targets but lack "best-effort" qualifier present in other docs

**Implementation**:
- Location: Line ~38 (search for "Response Targets")
- OLD: `**Note**: Targets, not SLAs. Actual response depends on complexity.`
- NEW: `**Note**: Targets, not SLAs. FirstTry provides best-effort support with no 
guaranteed response times. Actual response depends on complexity and maintainer availability.`

**File Path**: `docs/SECURITY.md`  
**Line**: ~38

---

#### Fix 5: docs/SUPPORT_POLICY.md — Standardize NO-SLA Language
**Status**: 🔧 DOWNGRADE  
**Action**: Add explicit "NO SERVICE LEVEL AGREEMENT" header

**Justification**: Doc mentions "best effort (no SLA)" but lacks prominent NO-SLA statement for consistency

**Implementation**:
- Location: Lines 1-5 (after title)
- Content:
```markdown

⚠️ **NO SERVICE LEVEL AGREEMENT**: FirstTry provides support on a best-effort basis 
with no guaranteed response times, escalation SLAs, or uptime guarantees.

```

**File Path**: `docs/SUPPORT_POLICY.md`  
**Lines**: 1-5 (add)

---

### ALREADY FIXED ✅

#### ✅ Fix 0: atlassian/forge-app/docs/SUPPORT.md:104
**Status**: ✅ COMPLETE (Phase 5)  
**Action**: Already rewritten  
- OLD: "If any SLI drops below target, we escalate automatically."
- NEW: "If internal reliability indicators fall below expected thresholds, the issue may be reviewed by maintainers on a best-effort basis. This does not imply automated escalation or guaranteed response."

---

## Implementation Sequence

**Phase 8 Execution**:

1. ✅ atlassian/forge-app/docs/SUPPORT.md (already done in Phase 5)
2. 🔧 docs/PRIVACY.md (add SLA disclaimer)
3. 🔧 docs/legal/service-level-agreement.md (add non-binding disclaimer)
4. 🔧 docs/SUPPORT.md (add NO-SLA header + fix link)
5. 🔧 docs/SECURITY.md (add best-effort qualifier)
6. 🔧 docs/SUPPORT_POLICY.md (standardize NO-SLA language)

---

## Risk Assessment

**Changes**: All DOWNGRADE (no content removal, only clarification)  
**Scope**: Limited to support/SLA-related sections  
**Marketplace Impact**: Positive (removes ambiguity)  
**Enterprise Impact**: Positive (clearer support positioning)

---

## Verification Plan (Phase 10)

After Phase 8 fixes applied:
- Re-run Phase 6 consistency check (should show all ✅)
- Re-run Phase 4 risk scan (should show zero critical findings)
- Verify no new SLA/guarantee claims introduced
- Verify all P0 docs have NO-SLA disclaimer

---

## Files to Modify

| File | Action | Lines | Fixes |
|------|--------|-------|-------|
| docs/PRIVACY.md | Add | End | Add SLA disclaimer |
| docs/legal/service-level-agreement.md | Add | 1-4 | Add non-binding disclaimer |
| docs/SUPPORT.md | Add + Modify | 1-5, 211 | Add NO-SLA header, fix link text |
| docs/SECURITY.md | Modify | ~38 | Add best-effort qualifier |
| docs/SUPPORT_POLICY.md | Add | 1-5 | Add NO-SLA header |

**Total Changes**: 5 files, ~20 lines added/modified  
**Estimated Impact**: Zero risk, high clarity gain

---

**Status**: Ready for Phase 8 - Apply Fixes
