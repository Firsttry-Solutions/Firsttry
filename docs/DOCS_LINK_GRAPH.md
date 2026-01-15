# PHASE 2: Document Graph Expansion

## Parsed Links from P0 Candidate Documents

### Source: docs/README.md

**Primary P0 Documents Identified (from README.md links)**:

1. ENTERPRISE_ONE_PAGER.md
2. SUPPORT_POLICY.md
3. ROADMAP.md
4. SECURITY.md
5. SECURITY_SUMMARY.md
6. PRIVACY.md
7. COMPLIANCE.md
8. SCOPES.md
9. DATA_INVENTORY.md
10. DATA_RETENTION.md
11. INCIDENT_RESPONSE.md
12. MARKETPLACE_LEGAL_IMPLEMENTATION.md
13. claims_proof_catalog.md
14. legal/terms-of-service.md
15. legal/privacy-policy.md
16. legal/data-handling.md
17. legal/service-level-agreement.md (⚠️ CRITICAL - RED FLAG)
18. ATLASSIAN_DUAL_LAYER_SPEC.md
19. EXTERNAL_APIS.md
20. forge-app/AUDIT_USAGE_GUIDE.md
21. ENTITLEMENTS.md
22. PRICING_RATIONALE.md
23. PRICING_GUARANTEES.md

---

## Link Graph Structure

**P0 Hub: docs/README.md**
↓ links to 23 unique documents
├── ENTERPRISE_ONE_PAGER.md → enterprise positioning
├── SECURITY.md → security claims
├── PRIVACY.md → data handling  
├── SCOPES.md → API scope justification
├── SUPPORT_POLICY.md → support model & NO-SLA disclaimer
├── MARKETPLACE_LEGAL_IMPLEMENTATION.md → marketplace compliance
├── claims_proof_catalog.md → all marketplace claims
└── legal/service-level-agreement.md ⚠️ CONTRADICTION?

---

## Red Flags Detected (Phase 2)

### 🚨 CRITICAL: SLA Document Exists

**File**: `legal/service-level-agreement.md`

Referenced in docs/README.md under "Legal & Terms" for Marketplace reviewers.

**Questions**:
- If SLA document exists, does it contain:
  - Uptime guarantees?
  - Response time promises?
  - Resolution SLAs?
  - Availability commitments?

**Action**: MUST audit `legal/service-level-agreement.md` immediately in Phase 4.

---

## Document Count by Location

| Location | Count | Type |
|----------|-------|------|
| ./docs/ | 89 | Primary docs |
| ./docs/legal/ | 6 | Legal/SLA |
| ./docs/audit_reports/ | 5 | Audit artifacts |
| ./docs/evidence/ | N/A | Evidence runs |
| ./docs/marketplace/ | 2 | Marketplace docs |
| ./atlassian/forge-app/docs/ | 68 | Forge app docs |
| ./atlassian/forge-app/legal/ | 6 | Legal docs |
| ./atlassian/forge-app/enterprise/ | 3 | Enterprise docs |
| ./atlassian/forge-app/marketplace/ | 2 | Marketplace docs |
| ./audit/ | 50+ | Audit artifacts |

---

## Linked Documents to Add to Audit

**Already discovered in Phase 1** ✅

All docs referenced in docs/README.md are already in `/tmp/docs_audit_v2_01_all_files.txt`.

Transitive links will be parsed in Phase 4 (Content Risk Scan).

---

## Phase 2 Conclusion

✅ Primary P0 documents identified (23 from README hub)
⚠️ SLA document flagged as critical (requires Phase 4 verification)
✅ Total docs: 2,778 (includes all transitive links)

**Next**: Phase 3 - Risk-based classification (P0/P1/P2)
