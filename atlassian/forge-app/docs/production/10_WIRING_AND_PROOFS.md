# Wiring and Proofs Document

**Audit Date**: 2026-02-24 UTC  
**Repository**: atlassian/forge-app  
**Evidence Dir**: E=/tmp/ft_prod_ready_20260224T122109Z

---

## Overview

This document maps every wiring claim to source code evidence, runnable commands, and proof artifacts. All verdicts are **FAIL** if no code evidence exists.

---

## W1: Deterministic packHash Canonical Implementation

**Primary Source Files**:
- src/zip/deterministicZip.ts
- src/evidence/evidenceVault.ts
- src/metrics/riskIndex.ts

**Caller Files**:
- Inventory: E/02_inventory/rg_packhash.txt (144 lines of references)

**Proof Command Run**:
```
rg -n "packHash|computePackHash|verify\.js" src tools tests docs > E/02_inventory/rg_packhash.txt
```

**Verdict**: 🟡 **NOT PROVEN**  
**Reason**: Inventory shows 144 references to packHash terms. Need to verify:
1. Canonical JSON implementation exists
2. Determinism harness present
3. Call sites properly invoke hash computation
4. Build metadata injection functional

**Next Step**: Execute STEP 4 (build + test) to validate deterministic hash computation during build.

---

## W2: Ledger Integrity Validation Panel Wiring

**Primary Source Files**:
- src/procurement/claims_map.ts
- src/evidence/evidenceVault.ts
- Backend contract (unclear - requires export inspection)

**Caller Files**:
- UI code (location TBD)
- Export pipeline (location TBD)

**Proof Command Run**:
```
rg -n "ledger|claims|integrity" src > E/02_inventory/rg_ledger_terms.txt
```

**Verdict**: 🔴 **FAIL**  
**Reason**: Inventory does NOT contain explicit "ledger" term searches. Claim requires explicit validation of ledger field presence in exports and UI wiring.

**Evidence Required**:
- Export fixture with ledger field
- UI component displaying ledger status
- End-to-end test wiring these together

---

## W3: Drift Metrics Wiring

**Primary Source Files**:
- src/phase7/drift_compute.ts
- src/phase7/drift_model.ts
- src/phase7/drift_storage.ts

**Distinction**:
- **Repo drift** (forbidden files + lockfile): `npm run verify:lockfile:clean`, `npm run verify:no-tracked-changes`
- **Product drift** (model changes): May be in phase7 only

**Caller Files**:
- Build scripts (package.json verify:* commands)
- Tests (tests/drift* if present)

**Proof Command Run**:
```
rg -n "drift|DRIFT" src > E/02_inventory/rg_drift_terms.txt
```

**Verdict**: 🟡 **NOT PROVEN**  
**Reason**: Phase 7 indicates advanced drift metrics. Only repo drift via lockfile can be proven. Product drift (aging/scheduling) is Phase-5 scope, not Phase-4.

**Can Prove**:
- Lockfile drift detection via git diff
- Change tracking verification via post-test cleanup

**Cannot Prove** (Phase-5 scope):
- Automated aging metric scheduling
- Product state machine transitions

---

## W4: Fail-Closed Reason Code Pipeline

**Primary Source Files**:
- src code that generates reasonCode
- UI code that displays reasonCode
- Backend contract (export schema)

**Inventory Evidence**: E/02_inventory/rg_reason_codes.txt (762 lines)

**Pipeline Stages**:
1. **Production** (backend): Code that generates `reasonCode` / `backendReasonCode`
2. **Serialization** (export): Code that includes reason code in export JSON
3. **Consumption** (UI): Code that reads and displays reason code

**Proof Commands Run**:
```
rg -n "NOT_READY|NOT_DECLARED|reasonCode|backendReasonCode|eligibility" src > E/02_inventory/rg_reason_codes.txt
rg -n "NOT_READY|NOT_DECLARED|reasonCode|backendReasonCode" tests > E/02_inventory/rg_reason_codes_tests.txt
```

**Verdict**: 🟡 **NOT PROVEN**  
**Reason**: Inventory shows 762 references but requires:
1. Code inspection to trace data flow backend → export → UI
2. Test proof that all paths properly serialize/consume reason codes
3. Test that fail-closed markers (NOT_DECLARED_IN_SNAPSHOT, NOT_READY, etc.) are present and tested

**Next Step**: STEP 4 will attempt to run tests that specifically verify reason code wiring.

---

## W5: Offline Verifier Pack Wiring

**Primary Source Files**:
- tools/verify_ecl_state.mjs (mentioned in prior audit)
- tools/verify_*.sh (build verification scripts)
- Export pack test files (tests/export/*.test.ts)

**Proof Command Run**:
```
find tools -maxdepth 2 -type f \( -name "*verify*" -o -name "*export*" -o -name "*pack*" \) | sort > E/06_docs/tools_find_verifier_export.txt
ls -la tools | tee "$E/06_docs/tools_ls.txt"
```

**Callable Scripts**:
- (To be listed in STEP 5)

**Verdict**: 🟡 **NOT PROVEN**  
**Reason**: Tools directory exists but requires:
1. Listing all verifier/export scripts
2. Running --help on each
3. Smoke testing ones that don't require auth

**Next Step**: STEP 5 will inventory and test runnability.

---

## W6: Export Pipeline Wiring

**Primary Source Files**:
- src/procurement/export_bundle.ts (likely export generator)
- tests/export/*.test.ts (export tests - if present)

**Proof Command Run**:
```
rg -n "export|Export" src tools tests | grep -i "bundle\|pack\|zip" > E/02_inventory/rg_export_pipeline.txt
```

**Verdict**: 🟡 **NOT PROVEN**  
**Reason**: Requires inspection of export command end-to-end:
1. Export command entry point
2. Bundle generation logic
3. Artifact layout
4. Test coverage for export correctness

**Next Step**: STEP 5 investigation and STEP 4 tests.

---

## W7: UI Proof Markers Wiring

**Primary Source Files**:
- src/gadget-ui/src/build/ui_build_meta.json (metadata)
- src/gadget-ui/*.tsx (UI components that read metrics)
- src/gadget-ui/dist/app.js (built artifact)

**Required Markers**:
- FT_PROOF_UI_EFFECTIVE_KIND
- FT_PROOF_UI_EXPORT_GATE_EVALUATED
- backendReasonCode
- eligibilitySource
- computedEligibilityOk

**Proof Command Run** (to execute in STEP 4):
```
rg -n "FT_PROOF_UI_EFFECTIVE_KIND|FT_PROOF_UI_EXPORT_GATE_EVALUATED|backendReasonCode|eligibilitySource|computedEligibilityOk" \
   src/gadget-ui/src > E/05_ui/source_marker_locations.txt
grep -ao "FT_PROOF_UI_EFFECTIVE_KIND\|FT_PROOF_UI_EXPORT_GATE_EVALUATED\|backendReasonCode\|eligibilitySource\|computedEligibilityOk" src/gadget-ui/dist/*.js | wc -l > E/05_ui/dist_marker_counts.txt
```

**Verdict**: 🟡 **NOT PROVEN**  
**Reason**: Marker presence in dist requires running STEP 4 tooling scripts.

**Next Step**: STEP 3.3 verification script and STEP 4 execution.

---

## W8: Forge Scopes Claim

**Scopes to Prove**:
- Read-only access (requestJira with GET)
- No mutation (no PUT/POST/DELETE)
- No outbound networking beyond Jira API

**Proof Command Run**:
```
rg -n "requestJira|asApp|asUser" src > E/02_inventory/rg_jira_api_usage.txt
rg -n "fetch\(|axios|node-fetch|https?://" src tools > E/02_inventory/rg_outbound_network.txt
rg -n "PUT|POST|DELETE" src > E/02_inventory/rg_mutation_check_term.txt
```

**Inventory Counts**:
- Outbound network references: 156 lines
- Mutation signals: 266 lines
- Jira API usage: (to count)

**Verdict**: 🔴 **FAIL**  
**Reason**: 156 outbound network references detected. Requires detailed inspection to prove:
1. All network calls are to Atlassian Jira API
2. No unauthenticated egress
3. No data exfiltration

**Critical Issue**: 266 mutation signal matches. If these include PUT/POST/DELETE to user Jira projects, this violates read-only claim.

**Required Fix**: Code inspection + positive proof that mutations are internal only OR not present.

---

## W9: Docs Truthfulness

**Documentation Files**:
- SECURITY.md
- docs/SECURITY.md
- docs/PRIVACY.md
- docs/PRIVACY_POLICY.md
- docs/REVIEWER_FAQ.md
- Other support docs (from prior audit)

**Claims to Verify Against Code**:
1. "Read-only access" → check W8 for PUT/POST/DELETE presence
2. "No data egress" → check W8 for outbound network usage
3. "Deterministic builds" → check W1 for determinism harness
4. "Fail-closed on errors" → check W4 for fail-closed markers
5. "Offline verifiability" → check W5 for verifier pack

**Proof Command Run** (re-run from prior inventory):
```
rg -n "read.only|deterministic|fail.closed|offline.verifi|egress" docs SECURITY.md > E/02_inventory/rg_docs_key_claims.txt
```

**Verdict**: 🟡 **NOT PROVEN**  
**Reason**: Docs exist but require line-by-line mapping to code proof. If any doc claim contradicts inventory findings (e.g., "read-only" but 266 mutation signals found), docs must be corrected or FAIL result.

**Next Steps**: 
1. Read docs for key claims
2. Cross-reference with code evidence from W1-W8
3. Update docs if necessary (allowed under hardening/docs fix exception)

---

## Summary of Verdict per W-Section

| W-Section | Status | Blocker | Next Action |
|-----------|--------|---------|-------------|
| W1 (packHash) | NOT PROVEN | No | Run STEP 4 tests/build |
| W2 (ledger) | FAIL | Yes | Inspect export schema for ledger field |
| W3 (drift) | NOT PROVEN | No | STEP 4 + verify lockfile/change tracking |
| W4 (reason codes) | NOT PROVEN | No | STEP 4 tests + code trace |
| W5 (verifier) | NOT PROVEN | No | STEP 5 inventory + smoke tests |
| W6 (export) | NOT PROVEN | No | STEP 5 + 4 |
| W7 (UI markers) | NOT PROVEN | No | STEP 4 tooling scripts |
| W8 (scopes) | FAIL | Yes | Code inspection + justification |
| W9 (docs) | NOT PROVEN | No | STEP 6 + cross-reference |

---

## Critical Blockers Identified

1. **W2 Blocker**: Ledger field presence in exports not confirmed. Requires fixture inspection.
2. **W8 Blocker**: 156 outbound network references + 266 mutation signals require detailed justification. If mutations include Jira API PUT/POST/DELETE, read-only claim is FALSE.

**Action Required Before Production**:
- Inspect all 266 mutation signal matches in E/02_inventory/rg_mutation_signals.txt
- Confirm all are non-Jira OR confirm Jira mutations are NOT present
- If mutations exist on Jira side: update scopes claim and docs accordingly

---

## Evidence Location Reference

```
E/02_inventory/rg_packhash.txt              → W1 source inventory
E/02_inventory/rg_reason_codes.txt          → W4 source inventory
E/02_inventory/rg_outbound_network.txt      → W8 outbound scan (156 lines)
E/02_inventory/rg_mutation_signals.txt      → W8 mutation scan (266 lines)
E/05_ui/source_marker_locations.txt         → W7 source markers (pending STEP 4)
E/05_ui/dist_marker_counts.txt              → W7 dist markers (pending STEP 4)
E/06_docs/tools_find_verifier_export.txt    → W5 verifier inventory (pending STEP 5)
```

