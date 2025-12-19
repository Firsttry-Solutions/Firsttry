# PHASE 3 Scope Clarification Needed

**Date:** 2025-12-19  
**Phase:** 3 (Scheduled Jobs, Pipelines, Ledgers)  
**Status:** PENDING CLARIFICATION

---

## Findings & Questions

### 1. Manifest Scheduled Trigger Support

**Current State:**
- Manifest.yml is minimal (27 lines)
- Has dashboard gadget and resource pages only
- No webtrigger or scheduled:trigger modules defined yet

**Question:**
- What is the Forge CLI version in this workspace?
- Does current Forge setup support `scheduled:trigger` module type?
- If not, what is the correct module type for scheduled jobs in this Forge version?

**Action Needed:**
Run: `forge --version` and confirm supported module types

---

### 2. Org Discovery Mechanism

**Current State:**
- Ingest.ts receives orgKey from EventV1 payload
- No org index observed yet in storage.ts

**Question:**
- Should I create an org index during successful ingest?
- Key: `index/orgs` with sorted unique list?
- Or should I reuse an existing index ledger pattern from storage_index.ts?

**Action Needed:**
Confirm org indexing strategy

---

### 3. Install Timestamp Source

**Current State:**
- Phase 3 readiness gating needs `coverage/{org}/install_at`
- This may not exist until Phase 6 (admin button)

**Question:**
- Should readiness gate assume `install_at` doesn't exist in Phase 3 test case?
- Status should be `BLOCKED_MISSING_INSTALL_AT` or use `ingest/{org}/first_event_at` as surrogate?

**Action Needed:**
Confirm fallback strategy for `install_at` when missing

---

### 4. Event Count Source for Readiness (MIN_EVENTS_FOR_FIRST_REPORT = 10)

**Current State:**
- Daily aggregates store `total_events` count
- No single org-level event count key observed

**Question:**
- Should readiness gate compute event count from latest daily aggregate?
- Or maintain a separate org-level event count key during ingest?
- Preferred: Which is more maintainable?

**Action Needed:**
Confirm event count source logic

---

### 5. Existing Test Framework

**Current State:**
- Tests exist under atlassian/forge-app/tests/
- test_phase2_*.ts files use deterministic fixtures
- No shared mocking framework observed yet

**Question:**
- Should I use same test pattern (deterministic fixtures, no @forge/api mocking)?
- Is there a shared storage stub utility, or should I create one within test files only?

**Action Needed:**
Confirm test framework preferences

---

## Clarifications Resolved

1. ✅ Forge CLI v12.12.0 confirmed (supports scheduled:trigger)
2. ✅ Scheduled trigger module type: `scheduled:trigger` (Forge v12)
3. ✅ Org index strategy: Create `index/orgs` on successful ingest
4. ✅ Install_at fallback: Use `ingest/{org}/first_event_at` OR `BLOCKED_MISSING_INSTALL_AT` if absent
5. ✅ Event count source: Use latest daily aggregate's `total_events`
6. ✅ Test framework: Use deterministic fixtures (same as Phase 2)

---

## Proceeding With Phase 3 Implementation

Implementing in order:
1. Create phase_3_evidence.md skeleton
2. Update manifest with scheduled triggers
3. Implement run_ledgers + org index
4. Implement backfill_selector
5. Implement daily_pipeline + weekly_pipeline
6. Implement readiness_gate
7. Create comprehensive tests
8. Deploy and capture evidence

---

**Note:** This document prevents incorrect assumptions and ensures Phase 3 implementation is aligned with actual system capabilities and design preferences.
