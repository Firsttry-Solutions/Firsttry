# Credibility Gaps - Scope Expansion Required

**Date**: 2025-12-22  
**Status**: 5 of 7 gaps require scope beyond current test-only boundaries

---

## Summary

The credibility gap verification framework has identified **5 gaps that cannot be closed with test-only changes**. These require:
- Product code modifications, OR
- Runtime harness infrastructure, OR
- Third-party integration

---

## Gaps Requiring Product Changes

### GAP 1: PII Logging Safety ⚠️ CANNOT CLOSE

**Current Status**: ⚠️ UNKNOWN (207 logging statements found, PII exposure unverified)

**What's Needed**:
1. **Product Code Change**: Implement PII sanitization layer
   - Add logger middleware that masks sensitive fields
   - Create field-level PII detection rules
   - Example:
     ```typescript
     // src/utils/pii-logger.ts (NEW FILE NEEDED)
     export function sanitizeError(err: Error): string {
       return err.message
         .replace(/[a-f0-9]{64}/g, '***TOKEN***')
         .replace(/Bearer\s+\S+/g, '***BEARER***')
         .replace(/\d{3}-\d{2}-\d{4}/g, '***SSN***');
     }
     ```
   - Audit all error logging paths (50+ locations)

2. **Test Enhancement**: Error injection harness
   - Simulate errors in data processing
   - Verify no secrets leak to logs
   - Assert sanitization rules are applied

**Effort**: ~3-5 engineer days (product changes) + 2-3 days (testing)

**Blocker**: Cannot verify without implementing sanitization layer

---

### GAP 2: Tenant Isolation ⚠️ CANNOT CLOSE

**Current Status**: ⚠️ UNKNOWN (isolation assumed, unverified at runtime)

**What's Needed**:
1. **Test Harness**: Mock Atlassian Storage API
   ```typescript
   // tests/credibility/mocks/storage-api-mock.ts (NEW)
   // Simulate true isolation violations:
   // - Tenant A tries to read Tenant B's keys
   // - Storage returns cross-tenant data
   // - Test verifies proper error handling
   ```

2. **Runtime Testing**: Deploy to Forge sandbox with multi-tenant scenario
   - Create 2+ test instances (different installations)
   - Attempt cross-tenant access
   - Verify 403 Forbidden responses

3. **Audit Trail**: Atlassian audit logs verification
   - Ensure isolation violations are logged
   - Verify no silent failures

**Effort**: ~5-7 engineer days (harness + testing)

**Blocker**: Requires Atlassian Forge sandbox environment for multi-tenant testing

---

### GAP 4: Concurrency & Duplicate Invocation ⚠️ CANNOT CLOSE

**Current Status**: ⚠️ UNKNOWN (idempotency assumed, untested)

**What's Needed**:
1. **Event Simulator**: Concurrent event delivery
   ```typescript
   // tests/credibility/harness/event-simulator.ts (NEW)
   // Simulate:
   // - 10 concurrent JIRA webhook deliveries
   // - Same event ID (should be deduplicated)
   // - Different timings (race conditions)
   // - Verify only 1 process execution
   ```

2. **Product Enhancement**: Idempotency key implementation
   - Add `event_id + hash(payload)` as deduplication key
   - Store in storage layer with TTL
   - Example:
     ```typescript
     // src/handlers/deduplication.ts (NEW/MODIFIED)
     async function isProcessed(eventId: string): Promise<boolean> {
       const key = `dedup:${eventId}`;
       const value = await storage.get(key);
       if (!value) {
         await storage.set(key, '1', { ttl: 3600 }); // 1 hour
         return false; // Not processed
       }
       return true; // Already processed
     }
     ```

3. **Load Testing**: Concurrent event stress test
   - Generate 100+ concurrent webhook deliveries
   - Assert no data corruption
   - Assert no duplicate database writes

**Effort**: ~4-5 engineer days (harness + idempotency code)

**Blocker**: Requires event delivery simulator infrastructure

---

### GAP 5: Deterministic Shakedown ❌ CONFIRMED FAILURE

**Current Status**: ❌ FAIL (10 different digests across runs - non-determinism proven)

**What's Needed**:
1. **Determinism Audit**: Find non-deterministic sources
   - [ ] Check `Object.keys()` order (use sorted array)
   - [ ] Check `Set.forEach()` order (convert to sorted array)
   - [ ] Check `Promise.all()` ordering (not preserved)
   - [ ] Check Map iteration order
   - [ ] Check JSON.stringify() behavior

   Example:
   ```typescript
   // CURRENT (non-deterministic)
   const keys = Object.keys(obj); // Order not guaranteed

   // FIXED (deterministic)
   const keys = Object.keys(obj).sort(); // Consistent order
   ```

2. **Code Changes**: Fix all non-deterministic operations
   - Estimated 20-30 locations in codebase
   - Risk: Medium (potential behavior changes)

3. **Verification**: Add determinism CI check
   - Run code 10x in test
   - Assert identical digests
   - Fail CI if divergence detected

**Effort**: ~2-3 engineer days (audit + fixes)

**Blocker**: Cannot verify without code changes

**Impact**: Critical for reproducible deployments & auditing

---

### GAP 6: Data Growth & Quota Behavior ⚠️ CANNOT CLOSE

**Current Status**: ⚠️ UNKNOWN (quota behavior untested at scale)

**What's Needed**:
1. **Quota Simulator**: Long-duration stress test
   ```typescript
   // tests/credibility/harness/quota-simulator.ts (NEW)
   // Simulate:
   // - Gradually fill 0% → 100% quota
   // - Assert warning at 75%
   // - Assert error at 100%
   // - Assert graceful degradation
   ```

2. **Product Code**: Quota-aware operations
   - Pre-check quota before large operations
   - Implement circuit breaker at threshold
   - Example:
     ```typescript
     // src/utils/quota-manager.ts (NEW/MODIFIED)
     async function canWrite(bytes: number): Promise<boolean> {
       const used = await getStorageUsed();
       const limit = await getStorageLimit();
       return (used + bytes) <= limit;
     }
     ```

3. **Monitoring**: Quota usage metrics
   - Export quota_used_bytes, quota_limit_bytes
   - Alert at 80% threshold
   - Daily quota trend reporting

**Effort**: ~3-4 engineer days (simulator + monitoring)

**Blocker**: Requires Atlassian Storage API quota simulation

---

## Gaps Closable With Documentation Only

### GAP 3: Outbound Egress (PARTIAL PASS)

**Current Status**: ⚠️ MIXED (4 fetch calls found, not documented)

**What's Needed**:
- Create `docs/EXTERNAL_APIS.md` documenting:
  - URL patterns for each fetch() call
  - Authentication method
  - Data sensitivity level
  - Service SLA / reliability requirements
  - Fallback behavior if service is down

**Example**:
```markdown
# External API Dependencies

## 1. Admin Page Chart Data API
- **URL Pattern**: `https://api.example.com/charts/*`
- **Method**: Fetch via browser
- **Auth**: OAuth bearer token
- **Data**: Non-sensitive (aggregated metrics only)
- **SLA**: Best effort (no SLA)
- **Fallback**: Display cached data or error message

## 2. [Future APIs]
```

**Effort**: ~4 hours (documentation only, no code changes)

**Owner**: Product Manager / Tech Lead

---

## Gaps Fully Closed

### GAP 7: Support & Incident Reality ✅ CLOSED

**Current Status**: ✅ PASS (verified 8+ runs)

**Documentation**:
- ✅ docs/SUPPORT.md (exists, has contact info)
- ✅ docs/INCIDENT_RESPONSE.md (exists, has procedures)

**No action required**. Annual review recommended.

---

## Timeline to Full Closure

```
Immediate (Before Marketplace):
├─ GAP 3: Document external APIs (4 hours) → docs/EXTERNAL_APIS.md
└─ Estimated effort: 4 hours

Sprint 2 (Weeks 1-2):
├─ GAP 1: PII sanitization (5 days)
├─ GAP 5: Determinism audit & fixes (3 days)
└─ Estimated effort: 8 days

Sprint 3 (Weeks 3-4):
├─ GAP 2: Storage isolation tests (7 days)
├─ GAP 4: Concurrency harness (5 days)
└─ Estimated effort: 12 days

Sprint 4+ (Ongoing):
├─ GAP 6: Quota simulation (4 days)
├─ Monthly credibility re-verification
└─ Estimated effort: 4 days + 2 days/month
```

**Total Effort to Full Closure**: ~32 days (1.5 sprints)

---

## Decision Points

### Option A: Proceed to Marketplace (Today)
- ✅ GAP 7 (Support) - CLOSED
- ⚠️ GAP 3 (Egress) - Add documentation before launch
- ❌ GAP 1, 2, 4, 5, 6 - Remain untested

**Risk Level**: 🔴 HIGH

**Recommendation**: Not recommended without GAP 3 documentation

### Option B: Marketplace After Documentation (This Week)
- ✅ GAP 7 (Support) - CLOSED
- ✅ GAP 3 (Egress) - CLOSED (documentation)
- ⚠️ GAP 1, 2, 4, 5, 6 - Known unknowns

**Risk Level**: 🟡 MEDIUM

**Recommendation**: Acceptable with clear disclaimer in docs

### Option C: Full Closure (4 Weeks)
- ✅ All 7 gaps - CLOSED or UNKNOWN (fully tested)
- ✅ Marketplace with full credibility evidence
- ✅ Compliance documentation complete

**Risk Level**: 🟢 LOW

**Recommendation**: Preferred for enterprise customers

---

## Marketplace Disclosure Options

### Minimal (Option B - Recommended)
```markdown
## Supported Use Cases
This application has been verified for:
- [✅] Support infrastructure & incident response (GAP 7)
- [✅] External API dependencies documented (GAP 3)

## Known Limitations
The following have not been independently verified:
- PII logging safety (GAP 1) - Static analysis only
- Tenant isolation (GAP 2) - Design review only
- Concurrent event handling (GAP 4) - Not tested
- Deterministic behavior (GAP 5) - Known non-determinism
- Quota enforcement (GAP 6) - Not tested

Customers should request scope expansion testing for production deployments.
```

### Comprehensive (Option C)
```markdown
## Security Verification Status
All 7 credibility gaps have been audited and verified:

| Gap | Status | Evidence |
|-----|--------|----------|
| PII Logging | ✅ CLOSED | Implementation + testing |
| Tenant Isolation | ✅ CLOSED | Multi-tenant integration tests |
| External Egress | ✅ CLOSED | APIs documented |
| Concurrency | ✅ CLOSED | Load tests (100+ concurrent) |
| Determinism | ✅ CLOSED | 10-run digest verification |
| Quota Behavior | ✅ CLOSED | Stress tests to 100% quota |
| Support | ✅ CLOSED | 24/7 incident response |

[Full audit report](CREDIBILITY_AUDIT_FINAL.md)
```

---

## Approval & Sign-Off

**Status**: 🟡 READY FOR STAKEHOLDER REVIEW

**Next Step**: Product/Security team decision on:
1. Which gaps to close before marketplace launch
2. Which gaps to defer to future sprints
3. Marketplace messaging regarding credibility status

**Responsible**: [Product Manager / Security Lead]

---

**Last Updated**: 2025-12-22  
**Test Infrastructure**: tests/credibility/  
**Evidence Base**: audit/credibility_reports/
