# P9C Internal Overclaim Report (NON-BLOCKING)

ℹ️ **INFORMATIONAL REPORT** - Internal corpus findings (non-blocking).

**Total files with findings**: 302

**Total findings**: 1931

## .github/workflows-disabled/firsttry-quality.yml

- **Line 30** `[HARD_FORBIDDEN]`
  > `# Guaranteed baseline tools (match what make check expects)`

## .github/workflows-disabled/policy-gates.yml

- **Line 399** `[HARD_FORBIDDEN]`
  > `SUSPICIOUS_CLAIMS=$(grep -r "guarantee\|promise\|certif" docs/ --include="*.md" 2>/dev/null || true)`

## A1_A2_COMPLETION_SUMMARY.md

- **Line 101** `[HARD_FORBIDDEN]`
  > `## Isolation Guarantees (Deterministically Proven)`

- **Line 103** `[HARD_FORBIDDEN]`
  > `| Guarantee | Enforcement | Proof |`

## AUDIT_SUMMARY.txt

- **Line 17** `[SLA_UNQUALIFIED]`
  > `✗ SLA tiers, contact verification missing`

- **Line 143** `[SLA_UNQUALIFIED]`
  > `- SLA Tiers (4h)`

- **Line 276** `[SLA_UNQUALIFIED]`
  > `[ ] Add SLA tiers to SECURITY.md`

## AUTO_PARITY_COMPLETE.md

- **Line 108** `[HARD_FORBIDDEN]`
  > `### Safety Guarantees`

## BENCHMARK_RESULTS_SUMMARY.md

- **Line 246** `[HARD_FORBIDDEN]`
  > `| Enterprise-ready tier | pro+full (7.4% variance, 61% cache improvement) |`

## CACHING_DELIVERY_FINAL.md

- **Line 201** `[HARD_FORBIDDEN]`
  > `## Correctness Guarantees`

- **Line 351** `[HARD_FORBIDDEN]`
  > `- **Correctness**: BLAKE2b-based invalidation guarantees`

## CACHING_QUICK_REF.md

- **Line 128** `[HARD_FORBIDDEN]`
  > `## Performance Guarantees`

- **Line 132** `[HARD_FORBIDDEN]`
  > `✅ No false positives: **BLAKE2b guarantees**`

## CI_CD_HARDENING_COMPLETE.md

- **Line 137** `[HARD_FORBIDDEN]`
  > `- ✅ Conditional Execution: `if: always()` for completion guarantee`

## COMPLIANCE_AUDIT_FINAL_SUMMARY.md

- **Line 48** `[SLA_UNQUALIFIED]`
  > `- ✅ `docs/legal/service-level-agreement.md` — SLA expectations documented`

- **Line 87** `[SLA_UNQUALIFIED]`
  > `- **Evidence**: Privacy Policy, ToS, Data Handling, SLA all present`

- **Line 141** `[HARD_FORBIDDEN]`
  > `| **All claims provable** | ✅ PASS | Every claim traced to code, manifest, or Atlassian guarantee |`

- **Line 217** `[SLA_UNQUALIFIED]`
  > `| Legal coverage | ✅ | `docs/legal/{privacy,terms,data,sla}.md` |`

- **Line 236** `[HARD_FORBIDDEN]`
  > `- ✅ All documentation claims verified against Forge guarantees`

## COMPLIANCE_PACKAGE_INDEX.md

- **Line 23** `[HARD_FORBIDDEN]`
  > `- [docs/ENTERPRISE_READINESS.md](docs/ENTERPRISE_READINESS.md) — Guarantees vs limitations`

- **Line 67** `[HARD_FORBIDDEN]`
  > `- [docs/ENTERPRISE_READINESS.md](docs/ENTERPRISE_READINESS.md) — Guarantees vs limitations`

## CREDIBILITY_AUDIT_FINAL.md

- **Line 104** `[SLA_UNQUALIFIED]`
  > `- Include: URL patterns, authentication method, data sensitivity, SLA requirements`

- **Line 165** `[HARD_FORBIDDEN]`
  > `- Promise.all() → add ordering guarantees`

## CREDIBILITY_CLOSURE_SUMMARY.md

- **Line 23** `[SLA_UNQUALIFIED]`
  > `| GAP 7 | Support Reality | ✅ **PASS** | Support contact documented; no unqualified SLA |`

- **Line 78** `[HARD_FORBIDDEN]`
  > `**Mitigation**: Rely on Forge's documented isolation guarantees`

## CREDIBILITY_DELIVERY_SUMMARY.md

- **Line 101** `[SLA_UNQUALIFIED]`
  > `- Specify: URL patterns, auth method, data sensitivity, SLA`

## CREDIBILITY_GAPS_SCOPE_EXPANSION.md

- **Line 137** `[HARD_FORBIDDEN]`
  > `const keys = Object.keys(obj); // Order not guaranteed`

- **Line 210** `[SLA_UNQUALIFIED]`
  > `- Service SLA / reliability requirements`

## CREDIBILITY_INDEX.md

- **Line 189** `[HARD_FORBIDDEN]`
  > `- Impact: Critical (isolation guarantee)`

## DASHBOARD_MEGA_AUDIT_COMPLETE.md

- **Line 201** `[HARD_FORBIDDEN]`
  > `- Data integrity guarantee`

## DASHBOARD_PREDEPLOY_AUDIT_REPORT.md

- **Line 20** `[HARD_FORBIDDEN]`
  > `- ✅ **No-throw guarantee:** 19 feature-level tests all passing`

## DASHBOARD_UI_IMPROVEMENTS_COMPLETE.md

- **Line 68** `[HARD_FORBIDDEN]`
  > `- **Upper-Middle:** Trust guarantees (Operational Boundaries) — ✨ NEW EMPHASIS`

- **Line 82** `[HARD_FORBIDDEN]`
  > `- Highlights read-only guarantees upfront`

## DELIVERABLES_MANIFEST.md

- **Line 215** `[SLA_UNQUALIFIED]`
  > `- SLA Tiers (4h)`

## DELIVERY_INSTRUCTIONS.md

- **Line 175** `[HARD_FORBIDDEN]`
  > `> "These behaviors are governed by Atlassian Forge and Jira Cloud platform guarantees and are NOT...`

## DOCUMENTATION_AUDIT_REPORT.md

- **Line 14** `[SLA_UNQUALIFIED]`
  > `- **Critical Files**: Exist (privacy-policy, terms-of-service, data-handling, SLA)`

- **Line 39** `[SLA_UNQUALIFIED]`
  > `| **Legal coverage clarity** | In legal/ directory | ✅ REQUIRED | Exists (privacy, ToS, SLA, data...`

- **Line 90** `[SLA_UNQUALIFIED]`
  > `- SLA: `docs/legal/service-level-agreement.md``

- **Line 138** `[HARD_FORBIDDEN]`
  > `- Storage isolation (Forge guarantees)`

## DOCUMENTATION_CLAIMS_VERIFICATION.md

- **Line 3** `[HARD_FORBIDDEN]`
  > `**Purpose**: Verify every claim in new documentation is provable from code, manifest, or Atlassia...`

- **Line 71** `[HARD_FORBIDDEN]`
  > `- Forge platform guarantee (external: Atlassian official)`

- **Line 86** `[HARD_FORBIDDEN]`
  > `- Forge platform guarantee (external: Atlassian official)`

- **Line 98** `[HARD_FORBIDDEN]`
  > `- Forge platform guarantee (external: Atlassian official)`

- **Line 106** `[HARD_FORBIDDEN]`
  > `- Atlassian Cloud guarantees TLS 1.2+ (platform requirement)`

- **Line 150** `[HARD_FORBIDDEN]`
  > `- Forge platform guarantee (Atlassian official)`

- **Line 178** `[HARD_FORBIDDEN]`
  > `5. **Atlassian Platform Guarantees** (external) — For infrastructure/platform claims`

- **Line 201** `[HARD_FORBIDDEN]`
  > `- ✅ Provable from code, manifest, or platform guarantees`

## ENTERPRISE_AUDIT_COMPLETE.md

- **Line 60** `[HARD_FORBIDDEN]`
  > `## 🎯 Verdict: **82/100 - ENTERPRISE-READY**`

- **Line 102** `[HARD_FORBIDDEN]`
  > `├── Final Verdict (ENTERPRISE-READY WITH CONDITIONS)`

## ENTERPRISE_COMPLIANCE_CONTRACT_FINAL_STATUS.md

- **Line 34** `[HARD_FORBIDDEN]`
  > `- [x] **docs/ENTERPRISE_READINESS.md** (267 lines) — Guarantees vs limitations, known gaps`

- **Line 142** `[HARD_FORBIDDEN]`
  > `- Clear separation of guarantees vs limitations`

## ENTERPRISE_COMPLIANCE_DELIVERY_COMPLETE.md

- **Line 100** `[HARD_FORBIDDEN]`
  > `- No unverifiable promises ("guaranteed," "promised," etc.)`

- **Line 102** `[HARD_FORBIDDEN]`
  > `- Clear separation of guarantees vs limitations`

## ENTERPRISE_DELIVERY_EXEC_SUMMARY.md

- **Line 180** `[SLA_UNQUALIFIED]`
  > `- [ ] Production SLA agreement (ready)`

- **Line 186** `[HARD_FORBIDDEN]`
  > `**FirstTry is enterprise-ready** with proven capabilities across:`

## ENTERPRISE_DELIVERY_INDEX.md

- **Line 328** `[SLA_UNQUALIFIED]`
  > `- [ ] Enterprise SLA tracking`

- **Line 334** `[HARD_FORBIDDEN]`
  > `**FirstTry is now enterprise-ready** with comprehensive validation across:`

## ENTERPRISE_IMPLEMENTATION_FINAL.md

- **Line 89** `[HARD_FORBIDDEN]`
  > `**Status:** Enterprise-ready with optional LocalStack setup for development`

## FASTPATH_SCANNER_GUIDE.md

- **Line 175** `[HARD_FORBIDDEN]`
  > `| Portability | Requires build | ✓ Always available |`

## FINAL_DELIVERY_SUMMARY.md

- **Line 148** `[HARD_FORBIDDEN]`
  > `- Determinism guarantee details`

- **Line 238** `[HARD_FORBIDDEN]`
  > `- Enterprise guarantees`

- **Line 273** `[HARD_FORBIDDEN]`
  > `- Validates determinism guarantee explained`

- **Line 319** `[HARD_FORBIDDEN]`
  > `- Determinism Guarantee: "Shakedown can be run 10, 100, or 1000 times with identical results"`

- **Line 361** `[HARD_FORBIDDEN]`
  > `- Enterprise Guarantees: 5 key guarantees verified`

- **Line 715** `[HARD_FORBIDDEN]`
  > `The system guarantees:`

## FINAL_PROOF.md

- **Line 52** `[SLA_UNQUALIFIED]`
  > `- ✅ docs/SECURITY_CONTACT.md (contact, SLA commitments)`

## FIRSTTRY_ENTERPRISE_AUDIT.md

- **Line 13** `[HARD_FORBIDDEN]`
  > `**OVERALL READINESS: 82/100 (ENTERPRISE-READY WITH CAVEATS)**`

- **Line 457** `[HARD_FORBIDDEN]`
  > `### **STATUS: ENTERPRISE-READY WITH CONDITIONS**`

## GITHUB_PAGES_DEPLOYMENT_PROOF.md

- **Line 286** `[SLA_UNQUALIFIED]`
  > `│   ├── legal/ (privacy, terms, data-handling, SLA)`

## HARDENING_PROOF.md

- **Line 12** `[HARD_FORBIDDEN]`
  > `- ✅ Deterministic CI setup (Node 20 guaranteed before npm test)`

- **Line 50** `[HARD_FORBIDDEN]`
  > `**Impact**: Guarantees Node.js v20 is installed before any npm commands, eliminating version drif...`

## IMPLEMENTATION_INDEX.md

- **Line 14** `[HARD_FORBIDDEN]`
  > `- Overall score: 82/100 (Enterprise-ready with caveats)`

## MAXIMUM_CREDIBILITY_DELIVERY.md

- **Line 110** `[HARD_FORBIDDEN]`
  > `Determinism: GUARANTEED ✅`

- **Line 133** `[HARD_FORBIDDEN]`
  > `Certification: DETERMINISM GUARANTEED ✅`

- **Line 251** `[HARD_FORBIDDEN]`
  > `- **Status**: DETERMINISM GUARANTEED ✅`

## MEGA_PROMPT_V5_CONVERGENCE_PROOF.md

- **Line 264** `[HARD_FORBIDDEN]`
  > `**Status**: Ready for marketplace submission with guaranteed integrity verification.`

## OPTION_A_COMPLETION_SUMMARY.md

- **Line 55** `[HARD_FORBIDDEN]`
  > `- Data integrity guaranteed in all scenarios`

## P6_DELIVERY_REPORT.md

- **Line 28** `[HARD_FORBIDDEN]`
  > `- Guarantees deterministic regeneration forever`

- **Line 175** `[HARD_FORBIDDEN]`
  > `| Backward Compatibility | Guaranteed ✅ |`

## P6_IMPLEMENTATION_SUMMARY.md

- **Line 333** `[HARD_FORBIDDEN]`
  > `- ✅ Backward compatibility guaranteed`

## P6_POLICY_LIFECYCLE_COMPLETE.md

- **Line 56** `[HARD_FORBIDDEN]`
  > `#### Pinning Guarantees:`

- **Line 87** `[HARD_FORBIDDEN]`
  > `#### Regeneration Guarantees:`

- **Line 127** `[HARD_FORBIDDEN]`
  > `#### Migration Guarantees:`

- **Line 160** `[HARD_FORBIDDEN]`
  > `#### Gate Guarantees:`

- **Line 200** `[HARD_FORBIDDEN]`
  > `#### Shadow Evaluation Guarantees:`

- **Line 269** `[HARD_FORBIDDEN]`
  > `**Compatibility Guarantees:**`

- **Line 445** `[HARD_FORBIDDEN]`
  > `- ✅ Backward compatibility guaranteed`

## P7_COMPLETION_SUMMARY.md

- **Line 28** `[HARD_FORBIDDEN]`
  > `- Created three plans with explicit guarantees`

- **Line 59** `[HARD_FORBIDDEN]`
  > `- Guarantee: If truncated, disclosure fields MUST be populated`

- **Line 86** `[HARD_FORBIDDEN]`
  > `- Ungated guarantees table (truth, evidence, verification always available)`

- **Line 86** `[HARD_FORBIDDEN]`
  > `- Ungated guarantees table (truth, evidence, verification always available)`

- **Line 106** `[HARD_FORBIDDEN]`
  > `- **P7.9:** Plan guarantees (2 tests)`

- **Line 152** `[HARD_FORBIDDEN]`
  > `└── PRICING_GUARANTEES.md      485 lines (Guarantees table)`

- **Line 252** `[HARD_FORBIDDEN]`
  > `✓ P7.9: Plan Guarantees (2)`

- **Line 318** `[HARD_FORBIDDEN]`
  > `- **Transparent Pricing:** Three clear tiers with published guarantees`

- **Line 392** `[HARD_FORBIDDEN]`
  > `### For Guarantees`

- **Line 483** `[HARD_FORBIDDEN]`
  > `- **Guarantees:** docs/PRICING_GUARANTEES.md`

## P7_DELIVERY_INDEX.md

- **Line 5** `[HARD_FORBIDDEN]`
  > `**Phase P7: Entitlements & Usage Metering** provides enterprise-ready SaaS monetization for the A...`

- **Line 20** `[HARD_FORBIDDEN]`
  > `- **[docs/PRICING_GUARANTEES.md](docs/PRICING_GUARANTEES.md)** - Plans comparison, procurement la...`

- **Line 41** `[HARD_FORBIDDEN]`
  > `- Plan guarantees (2 tests)`

- **Line 116** `[HARD_FORBIDDEN]`
  > `**Critical guarantee:** Exports blocked are HARD blocks (fail-closed)`

- **Line 135** `[HARD_FORBIDDEN]`
  > `**Guarantee:** If `historyTruncated === true`, disclosure fields MUST be populated. Never silent ...`

- **Line 165** `[HARD_FORBIDDEN]`
  > `- What plans NEVER affect (correctness surface guarantee)`

- **Line 170** `[HARD_FORBIDDEN]`
  > `- Compliance & guarantees section`

- **Line 176** `[HARD_FORBIDDEN]`
  > `- Ungated guarantees table (truth, evidence, verification always available)`

- **Line 176** `[HARD_FORBIDDEN]`
  > `- Ungated guarantees table (truth, evidence, verification always available)`

- **Line 198** `[HARD_FORBIDDEN]`
  > `9. **Plan Guarantees (2 tests)** - Plans can't weaken baseline, correctness surface respected`

## P7_EXECUTIVE_SUMMARY.md

- **Line 7** `[HARD_FORBIDDEN]`
  > `Enterprise-ready SaaS entitlements system that enables monetization through tiered plans WITHOUT ...`

- **Line 48** `[HARD_FORBIDDEN]`
  > `| **Lines of Docs** | 1,155 (guides + guarantees) |`

- **Line 54** `[HARD_FORBIDDEN]`
  > `## Key Guarantees`

- **Line 56** `[HARD_FORBIDDEN]`
  > `| Guarantee | Why | Evidence |`

- **Line 108** `[HARD_FORBIDDEN]`
  > `- `docs/PRICING_GUARANTEES.md` - 485-line table (plans, guarantees, procurement)`

- **Line 147** `[HARD_FORBIDDEN]`
  > `- ✅ Well documented (1,155 lines of guides and guarantees)`

## P7_FINAL_VALIDATION_REPORT.md

- **Line 21** `[HARD_FORBIDDEN]`
  > `- Plan guarantees (2)`

- **Line 103** `[HARD_FORBIDDEN]`
  > `- Ungated guarantees table`

- **Line 217** `[HARD_FORBIDDEN]`
  > `✓ P7.9: Plan Enforcement Guarantees - 2 tests`

## PARITY_RUNNER_OPTIMIZED.md

- **Line 99** `[HARD_FORBIDDEN]`
  > `**Guaranteed artifact creation:**`

## PHASE2D_ENTERPRISE_FEATURES.md

- **Line 399** `[HARD_FORBIDDEN]`
  > `FirstTry is now **fully enterprise-ready** with:`

## PHASE4_REMEDIATION_EVIDENCE.md

- **Line 9** `[HARD_FORBIDDEN]`
  > `Phase 4 (Change Awareness Timeline) has been implemented in complete compliance with the SEALED S...`

## PHASE_17_EVIDENCE_BACKFILL_COMPLETE.md

- **Line 15** `[HARD_FORBIDDEN]`
  > `- Guarantees:`

- **Line 207** `[HARD_FORBIDDEN]`
  > `- Phase-5 scheduler is earliest guaranteed point where cloudId is available`

## PHASE_1_COMPLETION_SUMMARY.txt

- **Line 11** `[HARD_FORBIDDEN]`
  > `PHASE 1 has been successfully completed. The Atlassian Forge app now includes a production-grade ...`

- **Line 31** `[HARD_FORBIDDEN]`
  > `- Bounded storage guarantee (90-day TTL prevents unbounded growth)`

- **Line 61** `[HARD_FORBIDDEN]`
  > `- Idempotency guarantee`

## PHASE_1_EVIDENCE.md

- **Line 44** `[HARD_FORBIDDEN]`
  > `- Bounded storage guarantee: 90-day TTL on all keys prevents unbounded growth`

- **Line 110** `[HARD_FORBIDDEN]`
  > `- Idempotency guarantee: Duplicate events return 200 "duplicate" without re-storing`

- **Line 253** `[HARD_FORBIDDEN]`
  > `### Bounded Storage Guarantee`

- **Line 355** `[HARD_FORBIDDEN]`
  > `## 6. Idempotency Guarantee`

- **Line 369** `[HARD_FORBIDDEN]`
  > `**Guarantee:** Each event_id is stored exactly once per (org_key, repo_key) tuple. Retransmitted ...`

- **Line 418** `[HARD_FORBIDDEN]`
  > `4. **90-Day TTL (Forge Default):** Bounded storage guaranteed; no indefinite retention.`

## PHASE_1_VERIFICATION.txt

- **Line 28** `[HARD_FORBIDDEN]`
  > `REQUIREMENT 3: Idempotency Guarantee`

- **Line 51** `[HARD_FORBIDDEN]`
  > `✅ TTL Guarantee: All keys have 90-day TTL (Forge default)`

- **Line 77** `[HARD_FORBIDDEN]`
  > `- Idempotency guarantee`

## PHASE_2_DELIVERY_SUMMARY.md

- **Line 102** `[HARD_FORBIDDEN]`
  > `**Determinism Guarantee:**`

- **Line 141** `[HARD_FORBIDDEN]`
  > `Proof:  Canonical JSON + sorting guarantee`

## PHASE_2_QUICK_REF.md

- **Line 114** `[HARD_FORBIDDEN]`
  > `## Determinism Guarantee`

## PHASE_4_COMPLETE_FINAL_DELIVERY.md

- **Line 132** `[HARD_FORBIDDEN]`
  > `### Type-Level Guarantees`

- **Line 150** `[HARD_FORBIDDEN]`
  > `### Runtime Guarantees`

- **Line 305** `[HARD_FORBIDDEN]`
  > `- All guarantees are CODE-ENFORCED, not promise-based`

## PHASE_6_V2_DELIVERY_INDEX.md

- **Line 58** `[HARD_FORBIDDEN]`
  > `- **Core guarantee:** Same state → same hash`

- **Line 136** `[HARD_FORBIDDEN]`
  > `- Tenant isolation guarantees`

- **Line 154** `[HARD_FORBIDDEN]`
  > `- Determinism guarantee`

## PHASE_6_V2_DESIGN.md

- **Line 140** `[HARD_FORBIDDEN]`
  > `### 3.3 Idempotency Guarantee`

- **Line 316** `[HARD_FORBIDDEN]`
  > `### 9.1 Isolation Guarantees`

## PHASE_6_V2_SESSION_SUMMARY.md

- **Line 162** `[HARD_FORBIDDEN]`
  > `### Immutability Guarantee ✅`

- **Line 202** `[HARD_FORBIDDEN]`
  > `### Write-Once Guarantee ✅`

- **Line 242** `[HARD_FORBIDDEN]`
  > `- [x] Immutability guaranteed`

- **Line 355** `[HARD_FORBIDDEN]`
  > `- Write-once guarantee maintained through 500+ snapshots`

## PHASE_6_V2_SPEC.md

- **Line 590** `[HARD_FORBIDDEN]`
  > `## 12. Determinism Guarantee`

## PHASE_6_V2_STAGE_1_COMPLETION.md

- **Line 101** `[HARD_FORBIDDEN]`
  > `- 30 tests for critical determinism guarantee`

- **Line 118** `[HARD_FORBIDDEN]`
  > `- Idempotency + scheduling guarantees`

- **Line 121** `[HARD_FORBIDDEN]`
  > `- Tenant isolation guarantees`

- **Line 141** `[HARD_FORBIDDEN]`
  > `- Determinism guarantee`

- **Line 162** `[HARD_FORBIDDEN]`
  > `- **Determinism:** Canonical JSON + SHA256 guarantees identical hash for identical state`

- **Line 213** `[HARD_FORBIDDEN]`
  > `| determinism.test.ts | 401 | Determinism guarantee |`

## PHASE_6_V2_STAGE_2_RESUBMISSION_READY.md

- **Line 107** `[HARD_FORBIDDEN]`
  > `✅ Core functionality (read-only guarantee maintained)`

## PHASE_8_V2_DELIVERY.md

- **Line 88** `[HARD_FORBIDDEN]`
  > `- **Availability:** ALWAYS AVAILABLE (even if no missing data)`

- **Line 205** `[HARD_FORBIDDEN]`
  > `5. M5 is ALWAYS AVAILABLE (no critical dependencies)`

## PHASE_8_V2_FINAL_VERIFICATION.md

- **Line 19** `[HARD_FORBIDDEN]`
  > `- ✅ Canonical SHA-256 hashing (reproducibility guaranteed)`

- **Line 119** `[HARD_FORBIDDEN]`
  > `| **M5** | Missing datasets | Expected datasets | ALWAYS AVAILABLE | ✅ |`

- **Line 128** `[HARD_FORBIDDEN]`
  > `M5: ALWAYS AVAILABLE (tracks missing data itself)    ✅ Implemented`

- **Line 431** `[HARD_FORBIDDEN]`
  > `- ✅ Deterministic reproducibility guaranteed by canonical hashing`

## PHASE_8_V2_QUICK_REF.md

- **Line 15** `[HARD_FORBIDDEN]`
  > `| **M5** | Visibility Gap Over Time | missing_datasets / expected_datasets | ALWAYS AVAILABLE | T...`

- **Line 65** `[HARD_FORBIDDEN]`
  > `| M5 | N/A | Always available |`

## PHASE_9_5E_COMPLETION.md

- **Line 110** `[HARD_FORBIDDEN]`
  > `### Key Guarantees`

- **Line 112** `[HARD_FORBIDDEN]`
  > `| Guarantee | Mechanism | Test |`

- **Line 131** `[SLA_UNQUALIFIED]`
  > `| **9.5-C** | Snapshot Reliability SLA | 54/54 | ✅ |`

- **Line 144** `[SLA_UNQUALIFIED]`
  > `├── 9.5-C: Snapshot Reliability SLA`

## PHASE_9_5E_DELIVERY.md

- **Line 118** `[HARD_FORBIDDEN]`
  > `- ✅ TC-9.5-E-10: Determinism guaranteed (2 tests)`

## PHASE_9_5E_INDEX.md

- **Line 191** `[HARD_FORBIDDEN]`
  > `| **TC-9.5-E-5:** No Jira Writes ⭐ | 3 | **CRITICAL: Zero mutations guaranteed** |`

- **Line 249** `[HARD_FORBIDDEN]`
  > `## Guaranteed Constraints ✅`

- **Line 344** `[HARD_FORBIDDEN]`
  > `| **9.5-E** | Auto-repair disclosure | Self-recovery events | ✅ (guaranteed) |`

## PHASE_9_5E_SPEC.md

- **Line 443** `[SLA_UNQUALIFIED]`
  > `**Phase 9.5-C: Snapshot Reliability SLA** (54/54 tests)`

## PHASE_9_5F_COMPLETION.md

- **Line 263** `[SLA_UNQUALIFIED]`
  > `├── Phase 9.5-C: Snapshot Reliability SLA (54 tests)`

- **Line 317** `[HARD_FORBIDDEN]`
  > `## Guarantees Delivered`

- **Line 339** `[HARD_FORBIDDEN]`
  > `- Compile-time guarantees`

## PHASE_9_5F_FINAL_SUMMARY.md

- **Line 61** `[HARD_FORBIDDEN]`
  > `- Core functions, UI, guarantees`

- **Line 181** `[HARD_FORBIDDEN]`
  > `## Critical Guarantees`

- **Line 201** `[HARD_FORBIDDEN]`
  > `- Compile-time guarantees`

- **Line 234** `[SLA_UNQUALIFIED]`
  > `| **9.5-C: Snapshot Reliability SLA** | 54 | ✅ PASS |`

## PHASE_9_5F_INDEX.md

- **Line 295** `[HARD_FORBIDDEN]`
  > `## 8. Key Guarantees`

- **Line 317** `[HARD_FORBIDDEN]`
  > `- Compile-time guarantees`

## PHASE_9_5F_MANIFEST.md

- **Line 89** `[HARD_FORBIDDEN]`
  > `├── Key Guarantees`

- **Line 116** `[HARD_FORBIDDEN]`
  > `├── Key Guarantees`

- **Line 136** `[HARD_FORBIDDEN]`
  > `├── Guarantees Delivered`

- **Line 152** `[HARD_FORBIDDEN]`
  > `├── Critical Guarantees`

- **Line 156** `[HARD_FORBIDDEN]`
  > `├── Critical Guarantees`

- **Line 175** `[HARD_FORBIDDEN]`
  > `├── Critical Guarantees`

- **Line 287** `[HARD_FORBIDDEN]`
  > `## Key Guarantees`

## PHASE_9_5F_SPEC.md

- **Line 360** `[HARD_FORBIDDEN]`
  > `## 5. Key Guarantees`

- **Line 439** `[HARD_FORBIDDEN]`
  > `| Determinism guaranteed | ✅ | TC-9.5-F-11 tests |`

## PHASE_9_5_SYSTEM_INDEX.md

- **Line 35** `[SLA_UNQUALIFIED]`
  > `### Phase 9.5-C: Snapshot Reliability SLA ✅`

- **Line 93** `[SLA_UNQUALIFIED]`
  > `├─ 9.5-C: Snapshot Reliability SLA (54/54 tests)`

- **Line 329** `[HARD_FORBIDDEN]`
  > `## GUARANTEED CONSTRAINTS`

## S3_INTEGRATION_COMPLETE.md

- **Line 5** `[HARD_FORBIDDEN]`
  > `Successfully integrated **S3/R2 storage** with the FirstTry benchmark harness for secure, enterpr...`

- **Line 268** `[HARD_FORBIDDEN]`
  > `| **Security** | ✅ Enterprise-ready |`

## SECURITY.md

- **Line 58** `[HARD_FORBIDDEN]`
  > `## Tenant Isolation Guarantee (Phase P1.4)`

- **Line 82** `[HARD_FORBIDDEN]`
  > `- **Guarantee:** Tenant ID cannot be spoofed or overridden`

- **Line 95** `[HARD_FORBIDDEN]`
  > `- **Guarantee:** Exports contain only current tenant's data`

- **Line 117** `[HARD_FORBIDDEN]`
  > `| Property | Guarantee | Evidence |`

## SEV2_DEPLOYMENT_GUIDE.md

- **Line 367** `[HARD_FORBIDDEN]`
  > `- **hasMore() conservative:** Only true if more pages guaranteed`

## SEV2_FINAL_VERIFICATION.md

- **Line 129** `[HARD_FORBIDDEN]`
  > `- hasMore() logic: Conservative (only true if more guaranteed)`

## SEV2_IMPLEMENTATION_COMPLETE.md

- **Line 75** `[HARD_FORBIDDEN]`
  > `- Conservative hasMore() logic: Only return true if more pages GUARANTEED`

- **Line 158** `[HARD_FORBIDDEN]`
  > `- Scope validation (read-only guaranteed)`

## SHAKEDOWN_COMPLETE.md

- **Line 172** `[HARD_FORBIDDEN]`
  > `- Determinism guarantee`

- **Line 246** `[HARD_FORBIDDEN]`
  > `### Enterprise Guarantees Criteria`

- **Line 297** `[HARD_FORBIDDEN]`
  > `- `docs/SHAKEDOWN.md` - Test philosophy, determinism guarantee`

## SHAKEDOWN_COMPLETE_REPORT_SUITE.md

- **Line 70** `[SLA_UNQUALIFIED]`
  > `**Best For**: Performance tuning, SLA verification, capacity planning`

## SHAKEDOWN_DELIVERY.md

- **Line 135** `[HARD_FORBIDDEN]`
  > `- Overview, philosophy, and guarantees`

- **Line 181** `[HARD_FORBIDDEN]`
  > `- Determinism guarantee explanation`

- **Line 186** `[HARD_FORBIDDEN]`
  > `**Key Documentation Guarantees:**`

- **Line 261** `[HARD_FORBIDDEN]`
  > `## Enterprise Guarantees Provided`

- **Line 293** `[HARD_FORBIDDEN]`
  > `- ✅ SHAKEDOWN.md: Test philosophy, determinism guarantee`

## SHAKEDOWN_DETAILED_REPORTS.md

- **Line 188** `[HARD_FORBIDDEN]`
  > `// With frozen time, deterministic behavior guaranteed`

- **Line 1251** `[HARD_FORBIDDEN]`
  > `✅ **Determinism guaranteed**`

## SHAKEDOWN_DOMAIN_SUMMARY.md

- **Line 23** `[HARD_FORBIDDEN]`
  > `| **TOTAL** | **9 Domains** | **46** | **✅ 100%** | **Enterprise-Ready** |`

- **Line 59** `[HARD_FORBIDDEN]`
  > `Policies evaluate deterministically on-demand and via cron triggers. Pipeline orchestration execu...`

- **Line 67** `[HARD_FORBIDDEN]`
  > `| SHK-012 | Pipeline order | ✅ | LOAD→FETCH→EVAL→LOG guaranteed |`

- **Line 71** `[HARD_FORBIDDEN]`
  > `- **Auditability**: Guaranteed step order ensures traceability`

- **Line 362** `[HARD_FORBIDDEN]`
  > `✅ **Deterministic behavior guaranteed**`

## SHAKEDOWN_INDEX.md

- **Line 125** `[HARD_FORBIDDEN]`
  > `### Enterprise Guarantees`

- **Line 262** `[HARD_FORBIDDEN]`
  > `### Enterprise Guarantees`

## SHAKEDOWN_MANIFEST.md

- **Line 23** `[HARD_FORBIDDEN]`
  > `- "How to run", architecture, determinism guarantee`

- **Line 177** `[HARD_FORBIDDEN]`
  > `- Determinism guarantee`

## SHAKEDOWN_PERFORMANCE_REPORT.md

- **Line 365** `[HARD_FORBIDDEN]`
  > `| **Determinism guarantee** | 100% reproducible | 10/10 shakedown runs match |`

## SHAKEDOWN_QUICKSTART.md

- **Line 75** `[HARD_FORBIDDEN]`
  > `## Enterprise Guarantees`

- **Line 156** `[HARD_FORBIDDEN]`
  > `- **SHAKEDOWN.md** - Test philosophy and guarantees`

## SHAKEDOWN_REPORTS_INDEX.md

- **Line 135** `[HARD_FORBIDDEN]`
  > `- Status: GUARANTEED ✅`

- **Line 212** `[SLA_UNQUALIFIED]`
  > `2. Reference determinism verification in SLA docs`

## SHAKEDOWN_REPORT_INDEX.md

- **Line 21** `[HARD_FORBIDDEN]`
  > `- **Determinism**: Guaranteed (10/10 runs identical)`

- **Line 80** `[SLA_UNQUALIFIED]`
  > `**Use Case**: Performance tuning, capacity planning, SLA verification`

- **Line 99** `[HARD_FORBIDDEN]`
  > `- Determinism guarantee explanation`

- **Line 238** `[HARD_FORBIDDEN]`
  > `Determinism: GUARANTEED`

- **Line 259** `[HARD_FORBIDDEN]`
  > `- **Status**: ✅ Determinism guaranteed`

## SHAKEDOWN_STATUS.md

- **Line 98** `[HARD_FORBIDDEN]`
  > `5. `docs/SHAKEDOWN.md` - Test philosophy, guarantees`

## SHAKEDOWN_TEST_RESULTS.md

- **Line 133** `[HARD_FORBIDDEN]`
  > `**Result**: ✅ All passing - Determinism guarantee verified (10/10 runs identical)`

- **Line 137** `[HARD_FORBIDDEN]`
  > `## Determinism Guarantee — VERIFIED ✅`

- **Line 236** `[HARD_FORBIDDEN]`
  > `- Enterprise guarantees verification`

## STEP_6_2_COMPLETION_REPORT.md

- **Line 12** `[HARD_FORBIDDEN]`
  > `**Step-6.2** successfully creates a **mechanical, testable guarantee** that hardcoded section hea...`

- **Line 101** `[HARD_FORBIDDEN]`
  > `**This is pure test enforcement - mechanical guarantee without code changes.**`

- **Line 146** `[HARD_FORBIDDEN]`
  > `- Maintains the guarantee through TypeScript contracts`

- **Line 167** `[HARD_FORBIDDEN]`
  > `## GUARANTEE PROVIDED`

- **Line 173** `[HARD_FORBIDDEN]`
  > `This guarantee is enforced by:`

- **Line 267** `[HARD_FORBIDDEN]`
  > `1. **The guarantee is mechanical** - No further manual action needed`

- **Line 280** `[HARD_FORBIDDEN]`
  > `The hardcoded section heading guarantee for Phase 4-5 is now:`

## STEP_6_2_COMPLETION_SUMMARY.txt

- **Line 2** `[HARD_FORBIDDEN]`
  > `STEP-6.2: MECHANICAL HARDCODED SECTION HEADING GUARANTEE`

- **Line 64** `[HARD_FORBIDDEN]`
  > `This is pure test enforcement - mechanical guarantee without code changes.`

- **Line 93** `[HARD_FORBIDDEN]`
  > `- Prevents false positives while maintaining guarantee`

- **Line 111** `[HARD_FORBIDDEN]`
  > `GUARANTEE PROVIDED`

- **Line 114** `[HARD_FORBIDDEN]`
  > `After Step-6.2, this guarantee is MECHANICAL and TESTABLE:`

- **Line 157** `[HARD_FORBIDDEN]`
  > `The Phase 4-5 hardcoded section heading guarantee is now:`

## STEP_6_2_DELIVERY.md

- **Line 1** `[HARD_FORBIDDEN]`
  > `# STEP-6.2: MECHANICAL HARDCODED SECTION HEADING GUARANTEE`

- **Line 11** `[HARD_FORBIDDEN]`
  > `Step-6.2 achieves the objective of making the "no hardcoded section headings" guarantee **mechani...`

- **Line 92** `[HARD_FORBIDDEN]`
  > `**Why this matters:** Prevents false positives while still enforcing the guarantee.`

- **Line 127** `[HARD_FORBIDDEN]`
  > `which guarantees the value matches PHASE5_SECTION_HEADINGS.`

- **Line 194** `[HARD_FORBIDDEN]`
  > `- Step-6.2: Creates mechanical tests to guarantee the contract is kept`

- **Line 229** `[HARD_FORBIDDEN]`
  > `## GUARANTEE PROVIDED`

- **Line 231** `[HARD_FORBIDDEN]`
  > `**After Step-6.2, the guarantee is MECHANICAL:**`

- **Line 267** `[HARD_FORBIDDEN]`
  > `Step-6.2 successfully creates a mechanical, testable guarantee that hardcoded section headings ca...`

## STEP_6_2_DELIVERY_INDEX.md

- **Line 5** `[HARD_FORBIDDEN]`
  > `**Objective:** Create mechanical tests to enforce hardcoded section heading guarantee`

- **Line 108** `[HARD_FORBIDDEN]`
  > `- Prevents false positives while maintaining guarantee`

- **Line 118** `[HARD_FORBIDDEN]`
  > `## GUARANTEE PROVIDED`

- **Line 120** `[HARD_FORBIDDEN]`
  > `> After Step-6.2, the hardcoded section heading guarantee is **MECHANICAL**:`

- **Line 191** `[HARD_FORBIDDEN]`
  > `1. ✅ Hardcoded section heading guarantee is now **mechanical**`

- **Line 196** `[HARD_FORBIDDEN]`
  > `The Phase 4-5 hardcoded section heading guarantee is now enforced by automated tests and cannot b...`

## STEP_6_2_NAVIGATION.md

- **Line 76** `[HARD_FORBIDDEN]`
  > `Creates **7 automated tests** that enforce a mechanical guarantee:`

- **Line 196** `[HARD_FORBIDDEN]`
  > `## THE GUARANTEE`

- **Line 212** `[HARD_FORBIDDEN]`
  > `**This guarantee is enforced by:**`

- **Line 236** `[HARD_FORBIDDEN]`
  > `**Step-6.2 is pure test enforcement - mechanical guarantee without code changes.**`

- **Line 256** `[HARD_FORBIDDEN]`
  > `4. **Deploy with confidence** - the guarantee is now mechanical`

- **Line 311** `[HARD_FORBIDDEN]`
  > `**STEP-6.2: MECHANICAL HARDCODED SECTION HEADING GUARANTEE**`

## STEP_6_2_QUICK_REF.md

- **Line 12** `[HARD_FORBIDDEN]`
  > `Creates automated, mechanical tests that enforce the guarantee: **Hardcoded section heading liter...`

- **Line 65** `[HARD_FORBIDDEN]`
  > `## THE GUARANTEE`

- **Line 69** `[HARD_FORBIDDEN]`
  > `This guarantee is **mechanical** - enforced by automated tests, not manual code review.`

- **Line 85** `[HARD_FORBIDDEN]`
  > `With Step-6.2 complete, the hardcoded section heading guarantee is **mechanical and testable**.`

## SUBMISSION_INSTRUCTIONS.md

- **Line 146** `[HARD_FORBIDDEN]`
  > `- Cryptographic guarantee: code cannot change without invalidating the lock`

## TELEMETRY.md

- **Line 61** `[HARD_FORBIDDEN]`
  > `If you need a stronger guarantee or a full data schema, please inspect `src/firsttry/telemetry.py...`

## TRUTHFUL_VERSION_DISPLAY_COMPLETE.md

- **Line 169** `[HARD_FORBIDDEN]`
  > `- ✅ Negative guarantees documented in code`

- **Line 399** `[HARD_FORBIDDEN]`
  > `**Non-Negotiable Guarantees Met:**`

## VERSION_DISPLAY_VERIFICATION_FINAL.md

- **Line 113** `[HARD_FORBIDDEN]`
  > `- Added read-only guarantee comments (no side effects)`

- **Line 241** `[HARD_FORBIDDEN]`
  > `- Read-only guarantees proven`

## ZERO_RUN_CACHE_COMPLETE.md

- **Line 21** `[HARD_FORBIDDEN]`
  > `✅ **Smart invalidation**: BLAKE2b-based correctness guarantees`

- **Line 339** `[HARD_FORBIDDEN]`
  > `## Correctness Guarantees`

## atlassian/forge-app/.github/workflows/credibility-gates.yml

- **Line 81** `[SLA_UNQUALIFIED]`
  > `if grep -r -i "SOC\s\?2\|ISO\s\?\d\{4,5\}\|Cloud Fortified\|99\.9%.*uptime\|\bSLA\b" *.md | grep ...`

- **Line 82** `[SLA_UNQUALIFIED]`
  > `echo "ERROR: Unsupported certification/SLA claims found"`

## atlassian/forge-app/.github/workflows/policy-drift-gate.yml

- **Line 110** `[HARD_FORBIDDEN]`
  > `echo "Security guarantees verified:"`

## atlassian/forge-app/CI_VERIFICATION_HARNESS.md

- **Line 291** `[HARD_FORBIDDEN]`
  > `## Verification Guarantee`

- **Line 300** `[HARD_FORBIDDEN]`
  > `**The system guarantees:**`

## atlassian/forge-app/DELIVERY_CHECKLIST.md

- **Line 10** `[HARD_FORBIDDEN]`
  > `## Phase P4: Evidence & Regeneration Guarantees`

- **Line 57** `[HARD_FORBIDDEN]`
  > `### Guarantees Enforced`

- **Line 153** `[HARD_FORBIDDEN]`
  > `### Explicit Guarantees Only`

## atlassian/forge-app/MEGA_PROMPT_V3_COMPLETION_SUMMARY.md

- **Line 223** `[HARD_FORBIDDEN]`
  > `### Security Guarantees Verified`

- **Line 225** `[HARD_FORBIDDEN]`
  > `| Guarantee | Verification Method | Status |`

## atlassian/forge-app/P2_DELIVERY_SUMMARY.md

- **Line 11** `[HARD_FORBIDDEN]`
  > `An enterprise-grade **"truth-in-output" contract** that guarantees every exported report is hones...`

## atlassian/forge-app/P2_README.md

- **Line 1** `[HARD_FORBIDDEN]`
  > `# ✅ PHASE P2: OUTPUT TRUTH GUARANTEE - IMPLEMENTATION VERIFIED`

## atlassian/forge-app/PHASE5_STEP4_1_COMPLETION_REPORT.md

- **Line 20** `[HARD_FORBIDDEN]`
  > `- ✅ Never-throws guarantee (FAIL_CLOSED architecture)`

- **Line 134** `[HARD_FORBIDDEN]`
  > `Guarantee: Never operates on wrong tenant's data`

- **Line 143** `[HARD_FORBIDDEN]`
  > `Guarantee: Trigger age is deterministic and sourced from Phase-4`

- **Line 152** `[HARD_FORBIDDEN]`
  > `Guarantee: Multiple concurrent invocations converge to single winner`

- **Line 161** `[HARD_FORBIDDEN]`
  > `Guarantee: Backoff prevents rapid retry loops`

- **Line 170** `[HARD_FORBIDDEN]`
  > `Guarantee: Forge runtime is protected from exceptions`

- **Line 178** `[HARD_FORBIDDEN]`
  > `Guarantee: No duplicate logic, consistent behavior`

- **Line 186** `[HARD_FORBIDDEN]`
  > `Guarantee: State remains consistent under concurrency`

## atlassian/forge-app/PHASE5_STEP4_COMPLETION.md

- **Line 118** `[HARD_FORBIDDEN]`
  > `## 4. SINGLE CODE PATH GUARANTEE`

- **Line 184** `[HARD_FORBIDDEN]`
  > `## 6. SAFETY GUARANTEES`

## atlassian/forge-app/PHASE5_STEP4_IMPLEMENTATION_SUMMARY.md

- **Line 170** `[HARD_FORBIDDEN]`
  > `**Single Code Path Guarantee:**`

## atlassian/forge-app/PHASE5_STEP5_ADMIN_UI_DESIGN.md

- **Line 369** `[HARD_FORBIDDEN]`
  > `- **No predictions** or time guarantees`

## atlassian/forge-app/PHASE5_STEP5_COMPLETION_REPORT.txt

- **Line 103** `[HARD_FORBIDDEN]`
  > `SINGLE CODE PATH GUARANTEE:`

## atlassian/forge-app/PHASE5_STEP6_COMPLETION_REPORT.txt

- **Line 491** `[HARD_FORBIDDEN]`
  > `Both formats guarantee:`

## atlassian/forge-app/PHASE5_STEP6_EXPORTS_DESIGN.md

- **Line 24** `[HARD_FORBIDDEN]`
  > `- **Guarantees:**`

- **Line 557** `[HARD_FORBIDDEN]`
  > `3. **Single code path matters** — Both scheduler and manual UI use same `generatePhase5Report()` ...`

## atlassian/forge-app/PHASE5_STEP6_HEADINGS_CONSTANTS_IMPLEMENTATION.md

- **Line 60** `[HARD_FORBIDDEN]`
  > `**Guarantees:** PDF always uses headings from the shared constant`

- **Line 77** `[HARD_FORBIDDEN]`
  > `**Guarantees:** Section order is deterministic and unchangeable`

- **Line 94** `[HARD_FORBIDDEN]`
  > `**Guarantees:** Prevents sneaky editorializations (e.g., "Insights" instead of "Observations")`

- **Line 106** `[HARD_FORBIDDEN]`
  > `**Guarantees:** Constants match type contract (catches contract drift)`

- **Line 133** `[HARD_FORBIDDEN]`
  > `## What This Guarantees`

## atlassian/forge-app/PHASE5_STEPS1_2_COMPLETION.md

- **Line 26** `[HARD_FORBIDDEN]`
  > `**Type Safety Guarantees:**`

- **Line 148** `[HARD_FORBIDDEN]`
  > `- **Guarantee:** Invalid reports cannot ship`

## atlassian/forge-app/PHASE_4_GAPS_A_F_ENFORCEMENT.md

- **Line 13** `[HARD_FORBIDDEN]`
  > `Phase 4 is permanently locked against misuse through **hard enforcement of 6 critical gaps (A-F)*...`

## atlassian/forge-app/PHASE_6_V2_DELIVERY_COMPLETE.md

- **Line 151** `[HARD_FORBIDDEN]`
  > `- ✅ Immutable storage with write-once guarantee`

- **Line 264** `[HARD_FORBIDDEN]`
  > `## 🎯 KEY GUARANTEES`

- **Line 267** `[HARD_FORBIDDEN]`
  > `- Write-once guarantee`

- **Line 427** `[HARD_FORBIDDEN]`
  > `1. Review immutability guarantees in design`

- **Line 439** `[HARD_FORBIDDEN]`
  > `A: Yes, write-once guarantee with no modifications possible after creation.`

## atlassian/forge-app/PHASE_6_V2_FINAL_DELIVERY_REPORT.md

- **Line 15** `[HARD_FORBIDDEN]`
  > `- Immutable storage with write-once guarantee`

- **Line 127** `[HARD_FORBIDDEN]`
  > `- [x] No-write guarantee enforced`

- **Line 173** `[HARD_FORBIDDEN]`
  > `**Benefit:** Captures requirements, establishes immutability guarantee`

- **Line 303** `[HARD_FORBIDDEN]`
  > `### Immutability Guarantee`

- **Line 329** `[HARD_FORBIDDEN]`
  > `## 🔐 SECURITY GUARANTEES`

- **Line 332** `[HARD_FORBIDDEN]`
  > `✅ WRITE-ONCE GUARANTEE`

- **Line 381** `[HARD_FORBIDDEN]`
  > `### Feature 1: Write-Once Guarantee`

- **Line 440** `[HARD_FORBIDDEN]`
  > `- Verify immutability guarantee`

## atlassian/forge-app/PHASE_6_V2_QUICK_REFERENCE.md

- **Line 105** `[HARD_FORBIDDEN]`
  > `No-Write Guarantee:`

## atlassian/forge-app/PHASE_6_V2_STAGE_2_COMPLETION_SUMMARY.md

- **Line 265** `[HARD_FORBIDDEN]`
  > `✅ **Write-Once Guarantee**`

- **Line 323** `[HARD_FORBIDDEN]`
  > `- Write-once guarantee maintained through all operations`

- **Line 341** `[HARD_FORBIDDEN]`
  > `✅ Read-only snapshot guarantee`

- **Line 385** `[HARD_FORBIDDEN]`
  > `- [x] Immutability guaranteed`

- **Line 562** `[HARD_FORBIDDEN]`
  > `**Q: What's the no-write guarantee?**`

- **Line 601** `[HARD_FORBIDDEN]`
  > `- ✅ Immutability guarantee with no-write enforcement`

- **Line 610** `[HARD_FORBIDDEN]`
  > `**Quality:** Enterprise-grade with immutability guarantee`

## atlassian/forge-app/PHASE_6_V2_STAGE_2_TEST_PLAN.md

- **Line 14** `[HARD_FORBIDDEN]`
  > `4. **Immutability Guarantee** - Write-once, read-only enforcement`

## atlassian/forge-app/PHASE_7_COMPLETE_IMPLEMENTATION.md

- **Line 102** `[HARD_FORBIDDEN]`
  > `- Determinism guarantees`

- **Line 348** `[HARD_FORBIDDEN]`
  > `- ✅ Deterministic guarantees met`

## atlassian/forge-app/PHASE_7_SEMANTIC_ROLLBACK.md

- **Line 301** `[HARD_FORBIDDEN]`
  > `## Phase 7 Semantic Guarantees`

## atlassian/forge-app/PHASE_7_STATUS.txt

- **Line 131** `[HARD_FORBIDDEN]`
  > `✅ Deterministic guarantees met (identical inputs → identical output)`

- **Line 204** `[HARD_FORBIDDEN]`
  > `- Determinism guarantees`

## atlassian/forge-app/PHASE_7_V2_DELIVERY_SUMMARY.md

- **Line 177** `[HARD_FORBIDDEN]`
  > `9. Determinism guarantees`

## atlassian/forge-app/PHASE_7_V2_VERIFICATION.md

- **Line 201** `[HARD_FORBIDDEN]`
  > `- [x] Section 9: Determinism guarantees`

## atlassian/forge-app/PHASE_9_5B_IMPLEMENTATION_SUMMARY.md

- **Line 249** `[SLA_UNQUALIFIED]`
  > `### 2. Phase 9.5-C Integration (Snapshot Reliability SLA)`

## atlassian/forge-app/PHASE_9_5B_INDEX.md

- **Line 202** `[SLA_UNQUALIFIED]`
  > `| Phase 9.5-C | Snapshot Reliability SLA (IS FirstTry's snapshot capability reliable) |`

## atlassian/forge-app/PHASE_9_5C_IMPLEMENTATION_SUMMARY.md

- **Line 5** `[SLA_UNQUALIFIED]`
  > `Phase 9.5-C: Snapshot Reliability SLA has been fully implemented and tested. This phase implement...`

- **Line 406** `[SLA_UNQUALIFIED]`
  > `- **Phase 9.5-C:** Snapshot Reliability SLA ← **YOU ARE HERE**`

## atlassian/forge-app/PHASE_9_5C_INDEX.md

- **Line 1** `[SLA_UNQUALIFIED]`
  > `# PHASE 9.5-C: SNAPSHOT RELIABILITY SLA - COMPLETE`

- **Line 61** `[SLA_UNQUALIFIED]`
  > `| **30-day** | Monthly trend | SLA assessment |`

## atlassian/forge-app/PHASE_9_5D_COMPLETION_REPORT.md

- **Line 318** `[SLA_UNQUALIFIED]`
  > `| 9.5-C | Snapshot Reliability SLA | 54 | ✅ |`

- **Line 456** `[SLA_UNQUALIFIED]`
  > `> "SLA requirement: X days of evidence. Status: MET/NOT MET"`

- **Line 478** `[SLA_UNQUALIFIED]`
  > `2. Add to SLA contracts`

## atlassian/forge-app/PHASE_9_5D_INDEX.md

- **Line 227** `[SLA_UNQUALIFIED]`
  > `- SLA dashboards: Duration and percentage metrics`

- **Line 373** `[SLA_UNQUALIFIED]`
  > `| 9.5-C | Snapshot reliability SLA | Provides `first_snapshot_at` |`

## atlassian/forge-app/PHASE_9_5_COMPLETE.md

- **Line 16** `[SLA_UNQUALIFIED]`
  > `3. **Phase 9.5-C:** Snapshot Reliability SLA (Is FirstTry reliable?)`

- **Line 47** `[SLA_UNQUALIFIED]`
  > `### Phase 9.5-C: Snapshot Reliability SLA ✅`

- **Line 60** `[SLA_UNQUALIFIED]`
  > `- SLA compliance tracking`

- **Line 113** `[SLA_UNQUALIFIED]`
  > `├─→ SLA Dashboards (Metrics and trends)`

- **Line 128** `[SLA_UNQUALIFIED]`
  > `| **If** FirstTry is reliable | Phase 9.5-C | Snapshot SLA |`

- **Line 318** `[SLA_UNQUALIFIED]`
  > `> "SLA metrics are tracked, blind spots are identified, and audit readiness is measured."`

## atlassian/forge-app/PHASE_P1_DELIVERY_COMPLETE.md

- **Line 14** `[HARD_FORBIDDEN]`
  > `| Phase | Guarantee | Tests | Status |`

- **Line 73** `[HARD_FORBIDDEN]`
  > `### ✅ All Guarantees Implemented & Tested`

- **Line 350** `[HARD_FORBIDDEN]`
  > `## Security Guarantees Summary`

- **Line 352** `[HARD_FORBIDDEN]`
  > `| Guarantee | Implemented | Tested | Enforced |`

## atlassian/forge-app/PHASE_P2_IMPLEMENTATION_COMPLETE.md

- **Line 1** `[HARD_FORBIDDEN]`
  > `# PHASE P2: OUTPUT TRUTH GUARANTEE - IMPLEMENTATION COMPLETE`

## atlassian/forge-app/PHASE_P3_IMPLEMENTATION_COMPLETE.md

- **Line 11** `[HARD_FORBIDDEN]`
  > `- ✅ Zero breaking changes to P1/P2 guarantees`

- **Line 170** `[HARD_FORBIDDEN]`
  > `## Technical Guarantees`

- **Line 195** `[HARD_FORBIDDEN]`
  > `- Tenant isolation guarantees retained`

- **Line 294** `[HARD_FORBIDDEN]`
  > `- ✅ All P1/P2 guarantees preserved`

- **Line 305** `[HARD_FORBIDDEN]`
  > `The implementation is minimal, focused, and preserves all P1/P2 guarantees while adding operation...`

## atlassian/forge-app/SCHEDULER_HARDENING_DESIGN.md

- **Line 36** `[HARD_FORBIDDEN]`
  > `### Properties Guaranteed`

- **Line 79** `[HARD_FORBIDDEN]`
  > `### Properties Guaranteed`

- **Line 129** `[HARD_FORBIDDEN]`
  > `### Properties Guaranteed`

- **Line 176** `[HARD_FORBIDDEN]`
  > `### Properties Guaranteed`

- **Line 228** `[HARD_FORBIDDEN]`
  > `### Properties Guaranteed`

- **Line 268** `[HARD_FORBIDDEN]`
  > `### Properties Guaranteed`

- **Line 315** `[HARD_FORBIDDEN]`
  > `### Properties Guaranteed`

## atlassian/forge-app/SCHEDULER_HARDENING_SUMMARY.md

- **Line 57** `[HARD_FORBIDDEN]`
  > `## Security Properties Guaranteed`

## atlassian/forge-app/SCHEDULER_INTEGRATION_GUIDE.md

- **Line 223** `[HARD_FORBIDDEN]`
  > `Guarantees:`

## atlassian/forge-app/SECURITY.md

- **Line 8** `[HARD_FORBIDDEN]`
  > `FirstTry - Audit Evidence Snapshot for Jira is committed to the highest standards of security and...`

- **Line 12** `[HARD_FORBIDDEN]`
  > `The P1 phase implements five critical security guarantees required for enterprise deployment. The...`

- **Line 14** `[HARD_FORBIDDEN]`
  > `### P1.1: Logging Safety Guarantee`

- **Line 33** `[HARD_FORBIDDEN]`
  > `### P1.2: Data Retention Guarantee`

- **Line 59** `[HARD_FORBIDDEN]`
  > `### P1.3: Export Truth Guarantee`

- **Line 89** `[HARD_FORBIDDEN]`
  > `### P1.4: Tenant Isolation Guarantee`

- **Line 122** `[HARD_FORBIDDEN]`
  > `### P1.5: Policy Drift Protection Guarantee`

- **Line 259** `[HARD_FORBIDDEN]`
  > `- **GDPR-aligned**: Implements 90-day data deletion guarantee (app responsibility for data in For...`

## atlassian/forge-app/SEV2_IMPLEMENTATION_SUMMARY.md

- **Line 179** `[HARD_FORBIDDEN]`
  > `- Preserve all tenant isolation guarantees`

## atlassian/forge-app/STEPS_A_B_FINAL_DELIVERY.md

- **Line 154** `[HARD_FORBIDDEN]`
  > `✅ GUARANTEE: Parity is mechanically enforced`

- **Line 155** `[HARD_FORBIDDEN]`
  > `✅ GUARANTEE: Breaking parity breaks tests`

- **Line 156** `[HARD_FORBIDDEN]`
  > `✅ GUARANTEE: No editorializations can slip through`

## atlassian/forge-app/STEP_6_1_CLOSURE_FINAL_REPORT.md

- **Line 41** `[HARD_FORBIDDEN]`
  > `**Guarantee:** If Admin UI hardcodes section headings instead of using the constant, TypeScript c...`

- **Line 346** `[HARD_FORBIDDEN]`
  > `- Guarantees mechanically enforced`

- **Line 369** `[HARD_FORBIDDEN]`
  > `3. ✅ **Explicit Guarantees** — Parity enforcement mechanism is documented`

## atlassian/forge-app/VERIFICATION_COMPLETION_REPORT.md

- **Line 224** `[HARD_FORBIDDEN]`
  > `### CI Guarantee`

## atlassian/forge-app/audit/FREEZE_PROCESS.md

- **Line 65** `[HARD_FORBIDDEN]`
  > `1. They bypass reproducibility guarantees`

## atlassian/forge-app/audit/REVIEWER_READY_REPORT.md

- **Line 36** `[HARD_FORBIDDEN]`
  > `### ✅ READ-ONLY GUARANTEE VERIFIED`

- **Line 242** `[HARD_FORBIDDEN]`
  > `| Security | 10/10 | Read-only guarantee verified, no egress |`

- **Line 265** `[SLA_UNQUALIFIED]`
  > `**Response SLA**: 24 hours`

## atlassian/forge-app/audit/dashboard_upgrade/OUT/01_before_ui_app_part1.txt

- **Line 112** `[HARD_FORBIDDEN]`
  > `// STEP 0: Report Bridge mode and invoke availability (both always available now)`

## atlassian/forge-app/audit/dashboard_upgrade/OUT/FIX00_main_head.txt

- **Line 111** `[HARD_FORBIDDEN]`
  > `// STEP 0: Report Bridge mode and invoke availability (both always available now)`

## atlassian/forge-app/audit/proof/SCHEDULER_CONSOLIDATION_PLAN.md

- **Line 50** `[HARD_FORBIDDEN]`
  > `**Behavioral Guarantees:**`

## atlassian/forge-app/audit/state_assessment/run_20260109_113220Z/08_static.txt

- **Line 8** `[HARD_FORBIDDEN]`
  > `src/exports/snapshot_export.ts:2: * PHASE 6 v2 + P2: SNAPSHOT EXPORT WITH OUTPUT TRUTH GUARANTEES`

- **Line 50** `[HARD_FORBIDDEN]`
  > `src/output/output_contract.ts:2: * PHASE P2: OUTPUT TRUTH GUARANTEE`

## atlassian/forge-app/audit/state_assessment/run_20260109_121627Z/05_unpushed_full_diff.txt

- **Line 182** `[HARD_FORBIDDEN]`
  > `+src/exports/snapshot_export.ts:2: * PHASE 6 v2 + P2: SNAPSHOT EXPORT WITH OUTPUT TRUTH GUARANTEES`

- **Line 224** `[HARD_FORBIDDEN]`
  > `+src/output/output_contract.ts:2: * PHASE P2: OUTPUT TRUTH GUARANTEE`

## atlassian/forge-app/audit/state_assessment/run_20260109_122543Z/11_workflows_full_text.txt

- **Line 2385** `[HARD_FORBIDDEN]`
  > `30	            # Guaranteed baseline tools (match what make check expects)`

- **Line 3333** `[HARD_FORBIDDEN]`
  > `399	          SUSPICIOUS_CLAIMS=$(grep -r "guarantee\|promise\|certif" docs/ --include="*.md" 2>/...`

## atlassian/forge-app/audit/state_assessment/run_20260109_122543Z/16_static_http_method_scan.txt

- **Line 11** `[HARD_FORBIDDEN]`
  > `src/exports/snapshot_export.ts:2: * PHASE 6 v2 + P2: SNAPSHOT EXPORT WITH OUTPUT TRUTH GUARANTEES`

- **Line 53** `[HARD_FORBIDDEN]`
  > `src/output/output_contract.ts:2: * PHASE P2: OUTPUT TRUTH GUARANTEE`

## atlassian/forge-app/docs/COMPLIANCE_FACT_SHEET.md

- **Line 4** `[HARD_FORBIDDEN]`
  > `**Phase Level:** P4 (Evidence & Regeneration Guarantees)`

- **Line 12** `[HARD_FORBIDDEN]`
  > `FirstTry is an Atlassian Jira Cloud Forge App providing governance automation with forensic-grade...`

- **Line 53** `[HARD_FORBIDDEN]`
  > `### Immutability Guarantees`

- **Line 61** `[HARD_FORBIDDEN]`
  > `## 4. Evidence Immutability Guarantees (P4)`

- **Line 84** `[HARD_FORBIDDEN]`
  > `## 5. Regeneration Guarantees (P4)`

- **Line 113** `[HARD_FORBIDDEN]`
  > `FirstTry maintains all P3 guarantees:`

- **Line 236** `[HARD_FORBIDDEN]`
  > `- ✅ P1-P3 guarantees maintained`

- **Line 308** `[HARD_FORBIDDEN]`
  > `**Version:** P4 Evidence & Regeneration Guarantees`

- **Line 326** `[HARD_FORBIDDEN]`
  > `| **Invariant** | Guarantee that must hold true at all times, enforced by code |`

- **Line 331** `[HARD_FORBIDDEN]`
  > `| **P1-P4** | Phases of evidence and regeneration guarantees |`

## atlassian/forge-app/docs/DATA_RETENTION.md

- **Line 165** `[HARD_FORBIDDEN]`
  > `**Format Guarantees**: JSON schema may change across app versions`

## atlassian/forge-app/docs/DATA_RETENTION_POLICY.md

- **Line 73** `[HARD_FORBIDDEN]`
  > `3. Cleanup runs (guarantees deletion within 90 days max)`

## atlassian/forge-app/docs/EVIDENCE_INTEGRITY.md

- **Line 17** `[HARD_FORBIDDEN]`
  > `- Determinism is enforced within the harness and CI; runtime behavior in production may differ be...`

## atlassian/forge-app/docs/EVIDENCE_MODEL.md

- **Line 11** `[HARD_FORBIDDEN]`
  > `Phase P4 implements forensic-grade evidence bundling and regeneration guarantees. Every output is...`

- **Line 140** `[HARD_FORBIDDEN]`
  > `### Immutability Guarantee`

- **Line 523** `[HARD_FORBIDDEN]`
  > `### What P4 Guarantees`

## atlassian/forge-app/docs/EXPORT_FORMAT.md

- **Line 22** `[HARD_FORBIDDEN]`
  > `- Consumers should check `schema_version` in the export. Backward compatibility guarantees will b...`

## atlassian/forge-app/docs/EXTERNAL_APIS.md

- **Line 74** `[HARD_FORBIDDEN]`
  > `**Platform Guarantee**: Atlassian Forge runtime enforces:`

- **Line 101** `[HARD_FORBIDDEN]`
  > `**Platform Guarantee**: Forge runtime enforces:`

## atlassian/forge-app/docs/HEARTBEAT_DELIVERABLES_INDEX.md

- **Line 72** `[HARD_FORBIDDEN]`
  > `├─ Storage guarantees`

## atlassian/forge-app/docs/HEARTBEAT_INTEGRATION.md

- **Line 345** `[HARD_FORBIDDEN]`
  > `## Storage Guarantees`

## atlassian/forge-app/docs/HEARTBEAT_QUICK_REF.md

- **Line 76** `[HARD_FORBIDDEN]`
  > `## Key Guarantees (Trust Boundaries)`

- **Line 101** `[HARD_FORBIDDEN]`
  > `### No Precision Guarantees`

## atlassian/forge-app/docs/HEARTBEAT_TRUST_DASHBOARD.md

- **Line 283** `[SLA_UNQUALIFIED]`
  > `**Not a Compliance Tool:** This dashboard is a transparency dashboard, not an audit log. Do not r...`

- **Line 421** `[HARD_FORBIDDEN]`
  > `- [x] No claimed guarantees not proven`

## atlassian/forge-app/docs/HEARTBEAT_VERIFICATION.md

- **Line 370** `[HARD_FORBIDDEN]`
  > `- [x] Storage guarantees`

## atlassian/forge-app/docs/INCIDENT_RESPONSE.md

- **Line 43** `[HARD_FORBIDDEN]`
  > `**NO GUARANTEED RESPONSE TIMES**`

- **Line 356** `[HARD_FORBIDDEN]`
  > `This incident response process is provided on a **best-effort basis** with **no guaranteed respon...`

## atlassian/forge-app/docs/MARKETPLACE_REVIEWER_NO_BACKFORTH_AUDIT.md

- **Line 70** `[SLA_UNQUALIFIED]`
  > `- None explicit, but lack of SLA may be flagged by reviewers expecting contact hours. [no direct ...`

- **Line 119** `[SLA_UNQUALIFIED]`
  > `- Unclear/unremediable retention & deletion: DATA_RETENTION.md states indefinite retention and th...`

- **Line 151** `[HARD_FORBIDDEN]`
  > `- [P2-2] Add `docs/EVIDENCE_INTEGRITY.md` describing signing, checksums, regeneration guarantees....`

## atlassian/forge-app/docs/MARKETPLACE_SUBMISSION_EVIDENCE_INDEX.md

- **Line 107** `[HARD_FORBIDDEN]`
  > `**Reviewer Question**: What are the real security guarantees?`

## atlassian/forge-app/docs/OUTPUT_CONTRACT.md

- **Line 1** `[HARD_FORBIDDEN]`
  > `# PHASE P2: OUTPUT TRUTH GUARANTEE`

- **Line 373** `[HARD_FORBIDDEN]`
  > `### Migration Guarantee`

- **Line 544** `[HARD_FORBIDDEN]`
  > `- Phase P2: Output Truth Guarantee (this document)`

## atlassian/forge-app/docs/P4_P5_COMPLETE_REFERENCE.md

- **Line 44** `[HARD_FORBIDDEN]`
  > `# Review evidence immutability guarantees`

- **Line 58** `[HARD_FORBIDDEN]`
  > `### Phase P4 - Evidence & Regeneration Guarantees`

- **Line 128** `[HARD_FORBIDDEN]`
  > `**Key Guarantees:**`

- **Line 153** `[HARD_FORBIDDEN]`
  > `**Key Guarantees:**`

- **Line 156** `[HARD_FORBIDDEN]`
  > `- Collision-free: SHA256 guarantees uniqueness`

- **Line 184** `[HARD_FORBIDDEN]`
  > `**Key Guarantees:**`

- **Line 201** `[HARD_FORBIDDEN]`
  > `// Guarantees: Same bundle → same output always`

- **Line 211** `[HARD_FORBIDDEN]`
  > `**Key Guarantees:**`

- **Line 243** `[HARD_FORBIDDEN]`
  > `**Key Guarantees:**`

- **Line 273** `[HARD_FORBIDDEN]`
  > `**Key Guarantees:**`

- **Line 379** `[HARD_FORBIDDEN]`
  > `**Guarantees:**`

- **Line 501** `[HARD_FORBIDDEN]`
  > `1. Regeneration Guarantee (Non-Negotiable Contract)`

- **Line 520** `[HARD_FORBIDDEN]`
  > `**When to Read:** Understanding regeneration guarantees and failure modes`

- **Line 530** `[HARD_FORBIDDEN]`
  > `4. Evidence Immutability Guarantees`

- **Line 531** `[HARD_FORBIDDEN]`
  > `5. Regeneration Guarantees`

- **Line 570** `[HARD_FORBIDDEN]`
  > `- Guarantees enforced`

- **Line 734** `[HARD_FORBIDDEN]`
  > `- **Regeneration Guarantees:** See [REGENERATION_GUARANTEES.md](docs/REGENERATION_GUARANTEES.md)`

- **Line 755** `[HARD_FORBIDDEN]`
  > `- ✅ Deterministic regeneration guarantees`

## atlassian/forge-app/docs/P4_P5_IMPLEMENTATION_SUMMARY.md

- **Line 15** `[HARD_FORBIDDEN]`
  > `**Phase P4 - Evidence & Regeneration Guarantees:**`

- **Line 58** `[HARD_FORBIDDEN]`
  > `- **Guarantee:** Identical evidence → identical hash always`

- **Line 79** `[HARD_FORBIDDEN]`
  > `- **Guarantee:** No external calls, no state changes, deterministic`

- **Line 90** `[HARD_FORBIDDEN]`
  > `- **Guarantee:** Explicit error always raised, no retries, no fallback`

- **Line 100** `[HARD_FORBIDDEN]`
  > `- **Guarantee:** Watermark applied automatically on verification failure`

- **Line 155** `[HARD_FORBIDDEN]`
  > `- ✅ All guarantees validated by tests`

- **Line 210** `[HARD_FORBIDDEN]`
  > `15. P1-P3 guarantees maintained ✅ YES`

- **Line 263** `[HARD_FORBIDDEN]`
  > `- Evidence immutability guarantees`

- **Line 264** `[HARD_FORBIDDEN]`
  > `- Regeneration guarantees (pure function, deterministic)`

- **Line 283** `[HARD_FORBIDDEN]`
  > `- Key guarantees table`

- **Line 336** `[HARD_FORBIDDEN]`
  > `## Guarantees Enforced`

- **Line 340** `[HARD_FORBIDDEN]`
  > `| Guarantee | Mechanism | Enforcement | Test |`

- **Line 347** `[HARD_FORBIDDEN]`
  > `| Regeneration Deterministic | Pure function guarantee | Same output always | TC-P4-3.2 |`

- **Line 358** `[HARD_FORBIDDEN]`
  > `| Guarantee | Mechanism | Enforcement | Evidence |`

## atlassian/forge-app/docs/P5_PROCUREMENT_ACCELERATION.md

- **Line 24** `[HARD_FORBIDDEN]`
  > `- Evidence immutability guarantees (from P4)`

- **Line 25** `[HARD_FORBIDDEN]`
  > `- Regeneration guarantees (from P4)`

- **Line 53** `[HARD_FORBIDDEN]`
  > `- ✅ P1-P3 guarantees maintained?`

- **Line 158** `[HARD_FORBIDDEN]`
  > `## Key Guarantees`

- **Line 160** `[HARD_FORBIDDEN]`
  > `| Guarantee | Evidence |`

## atlassian/forge-app/docs/PHASE5_AUDIT_EXPORT.md

- **Line 33** `[HARD_FORBIDDEN]`
  > `5. **App Behavior Guarantees**`

- **Line 95** `[HARD_FORBIDDEN]`
  > `### Immutability Guarantee`

## atlassian/forge-app/docs/PHASE_7_V2_IMPLEMENTATION_PLAN.md

- **Line 300** `[HARD_FORBIDDEN]`
  > `| Pagination unstable | Test 10k events with stable ordering guarantee |`

## atlassian/forge-app/docs/PHASE_7_V2_SPEC.md

- **Line 386** `[HARD_FORBIDDEN]`
  > `## 9. Determinism Guarantees`

## atlassian/forge-app/docs/PHASE_9_5B_DELIVERY.md

- **Line 545** `[SLA_UNQUALIFIED]`
  > `- [PHASE_9_5C_SPEC.md](PHASE_9_5C_SPEC.md) - Snapshot Reliability SLA`

## atlassian/forge-app/docs/PHASE_9_5B_SPEC.md

- **Line 477** `[SLA_UNQUALIFIED]`
  > `- **Phase 9.5-C:** Snapshot Reliability SLA (is FirstTry's snapshot capability reliable)`

## atlassian/forge-app/docs/PHASE_9_5C_DELIVERY.md

- **Line 1** `[SLA_UNQUALIFIED]`
  > `# PHASE 9.5-C DELIVERY SUMMARY: SNAPSHOT RELIABILITY SLA`

- **Line 602** `[SLA_UNQUALIFIED]`
  > `- **Phase 9.5-C:** Snapshot Reliability SLA (is FirstTry itself reliable?)`

## atlassian/forge-app/docs/PHASE_9_5C_SPEC.md

- **Line 1** `[SLA_UNQUALIFIED]`
  > `# PHASE 9.5-C SPECIFICATION: SNAPSHOT RELIABILITY SLA`

- **Line 139** `[SLA_UNQUALIFIED]`
  > `- No "SLA met/missed" judgment`

## atlassian/forge-app/docs/PHASE_9_5D_DELIVERY.md

- **Line 206** `[SLA_UNQUALIFIED]`
  > `3. **SLA Dashboard** - Metrics integration`

- **Line 219** `[HARD_FORBIDDEN]`
  > `4. Current time (always available)`

## atlassian/forge-app/docs/PHASE_9_5D_SPEC.md

- **Line 28** `[SLA_UNQUALIFIED]`
  > `Phase 9.5-D provides mathematically rigorous answers to these questions using data from Phase 9.5...`

- **Line 144** `[SLA_UNQUALIFIED]`
  > `4. **SLA Dashboards**`

- **Line 370** `[SLA_UNQUALIFIED]`
  > `| **9.5-C** | Snapshot Reliability SLA | Provides `first_snapshot_at` |`

## atlassian/forge-app/docs/PHASE_P1_4_TENANT_ISOLATION_COMPLETE.md

- **Line 17** `[HARD_FORBIDDEN]`
  > `- ✅ SECURITY.md documentation with verifiable guarantees`

- **Line 87** `[HARD_FORBIDDEN]`
  > `**Key Format Guarantee:**`

- **Line 173** `[HARD_FORBIDDEN]`
  > `**Addition:** Tenant Isolation Guarantee section`

- **Line 196** `[HARD_FORBIDDEN]`
  > `### Mathematical Guarantee`

- **Line 299** `[HARD_FORBIDDEN]`
  > `- ✅ Guarantees are verifiable via tests`

- **Line 408** `[HARD_FORBIDDEN]`
  > `- "Tenant Isolation Guarantee (Phase P1.4)" section`

## atlassian/forge-app/docs/PHASE_P1_5_POLICY_DRIFT_COMPLETE.md

- **Line 197** `[HARD_FORBIDDEN]`
  > `- P1.1: Logging Safety Guarantee`

- **Line 198** `[HARD_FORBIDDEN]`
  > `- P1.2: Data Retention Guarantee`

- **Line 199** `[HARD_FORBIDDEN]`
  > `- P1.3: Export Truth Guarantee`

- **Line 200** `[HARD_FORBIDDEN]`
  > `- P1.4: Tenant Isolation Guarantee`

- **Line 201** `[HARD_FORBIDDEN]`
  > `- **P1.5: Policy Drift Protection Guarantee** (comprehensive guide)`

## atlassian/forge-app/docs/PHASE_P1_COMPLETE_SUMMARY.md

- **Line 23** `[HARD_FORBIDDEN]`
  > `FirstTry - Audit Evidence Snapshot for Jira has successfully implemented the complete Phase P1 en...`

- **Line 26** `[HARD_FORBIDDEN]`
  > `**Guarantee:** No sensitive data in logs`

- **Line 32** `[HARD_FORBIDDEN]`
  > `**Guarantee:** All data automatically deleted after 90 days`

- **Line 38** `[HARD_FORBIDDEN]`
  > `**Guarantee:** Exports include metadata about data completeness`

- **Line 44** `[HARD_FORBIDDEN]`
  > `**Guarantee:** Storage data is isolated by tenant (Jira Cloud ID)`

- **Line 50** `[HARD_FORBIDDEN]`
  > `**Guarantee:** Policy changes cannot happen silently without explicit review`

- **Line 74** `[HARD_FORBIDDEN]`
  > `- **Adversarial:** Tests designed to find ways around the guarantee (166 tests)`

- **Line 189** `[HARD_FORBIDDEN]`
  > `## Guarantees Made`

- **Line 375** `[HARD_FORBIDDEN]`
  > `Phase P1 Enterprise Safety Baseline is complete and ready for production deployment. The implemen...`

- **Line 378** `[HARD_FORBIDDEN]`
  > `- **Secure:** Multiple safety guarantees enforced simultaneously`

## atlassian/forge-app/docs/PHASE_P1_DOCUMENTATION_INDEX.md

- **Line 24** `[HARD_FORBIDDEN]`
  > `- Guarantees made`

- **Line 32** `[HARD_FORBIDDEN]`
  > `**Guarantee:** No sensitive data in logs`

- **Line 41** `[HARD_FORBIDDEN]`
  > `- 📝 [SECURITY.md](../SECURITY.md#p11-logging-safety-guarantee) - Overview in SECURITY.md`

- **Line 57** `[HARD_FORBIDDEN]`
  > `**Guarantee:** All data automatically deleted after 90 days`

- **Line 66** `[HARD_FORBIDDEN]`
  > `- 📝 [SECURITY.md](../SECURITY.md#p12-data-retention-guarantee) - Overview`

- **Line 83** `[HARD_FORBIDDEN]`
  > `**Guarantee:** Exports include metadata about data completeness`

- **Line 92** `[HARD_FORBIDDEN]`
  > `- 📝 [SECURITY.md](../SECURITY.md#p13-export-truth-guarantee) - Overview`

- **Line 109** `[HARD_FORBIDDEN]`
  > `**Guarantee:** Storage data is isolated by tenant (Jira Cloud ID)`

- **Line 118** `[HARD_FORBIDDEN]`
  > `- 📝 [SECURITY.md](../SECURITY.md#p14-tenant-isolation-guarantee) - Overview`

- **Line 135** `[HARD_FORBIDDEN]`
  > `**Guarantee:** Policies cannot silently change without explicit review`

- **Line 144** `[HARD_FORBIDDEN]`
  > `- 📝 [SECURITY.md](../SECURITY.md#p15-policy-drift-protection-guarantee) - Overview`

- **Line 256** `[HARD_FORBIDDEN]`
  > `→ See [PHASE_P1_4_TENANT_ISOLATION_COMPLETE.md](PHASE_P1_4_TENANT_ISOLATION_COMPLETE.md) - "Isola...`

- **Line 265** `[HARD_FORBIDDEN]`
  > `### Security Guarantees`

- **Line 266** `[HARD_FORBIDDEN]`
  > `→ [PHASE_P1_COMPLETE_SUMMARY.md](PHASE_P1_COMPLETE_SUMMARY.md) - "Guarantees Made" section`

- **Line 381** `[HARD_FORBIDDEN]`
  > `1. **Confused about a guarantee?** → Read the corresponding phase guide`

## atlassian/forge-app/docs/PHASE_P1_PROGRESS.md

- **Line 79** `[HARD_FORBIDDEN]`
  > `### ✅ P1.3: Export Truth Guarantee (COMPLETE)`

- **Line 121** `[HARD_FORBIDDEN]`
  > `- Document isolation guarantee`

- **Line 226** `[HARD_FORBIDDEN]`
  > `### ✅ Requirement 3: Export Truth Guarantee`

## atlassian/forge-app/docs/PLATFORM_DEPENDENCIES.md

- **Line 118** `[HARD_FORBIDDEN]`
  > `- Execution guarantees (best effort)`

- **Line 123** `[HARD_FORBIDDEN]`
  > `- Execution guarantees (may skip on platform issues)`

- **Line 127** `[HARD_FORBIDDEN]`
  > `- **Execution Timing**: No guarantee of exact time (e.g., "daily" may run any time that day)`

- **Line 251** `[SLA_UNQUALIFIED]`
  > `### 10. Availability & SLA`

- **Line 257** `[SLA_UNQUALIFIED]`
  > `- Platform availability (no published SLA for Forge)`

- **Line 267** `[SLA_UNQUALIFIED]`
  > `- **Forge SLA**: No published SLA for Forge platform availability`

- **Line 358** `[SLA_UNQUALIFIED]`
  > `- No published Forge SLA`

## atlassian/forge-app/docs/PRODUCT_BOUNDARIES.md

- **Line 6** `[HARD_FORBIDDEN]`
  > `FirstTry defines clear **functional and security boundaries** to prevent scope creep and maintain...`

- **Line 30** `[HARD_FORBIDDEN]`
  > `| Write to Jira (`write:jira` scope) | Creates risk of data mutation; violates read-only guarante...`

## atlassian/forge-app/docs/PROOF_GRADE_STATE_REAUDIT_REPORT.md

- **Line 11** `[HARD_FORBIDDEN]`
  > `- **IS NOT**: a guarantee of Marketplace acceptance or Forge deploy success`

## atlassian/forge-app/docs/README_DOCS_INDEX.md

- **Line 88** `[HARD_FORBIDDEN]`
  > `| [../marketplace/badges/read_only_no_writes.svg](../marketplace/badges/read_only_no_writes.svg) ...`

## atlassian/forge-app/docs/REGENERATION_GUARANTEES.md

- **Line 1** `[HARD_FORBIDDEN]`
  > `# PHASE P4: REGENERATION GUARANTEES & INVARIANTS`

- **Line 9** `[HARD_FORBIDDEN]`
  > `## 1. The Regeneration Guarantee`

- **Line 261** `[HARD_FORBIDDEN]`
  > `## 9. Guarantees by Use Case`

- **Line 267** `[HARD_FORBIDDEN]`
  > `**Guarantee:**`

- **Line 295** `[HARD_FORBIDDEN]`
  > `**Guarantee:**`

- **Line 321** `[HARD_FORBIDDEN]`
  > `**Guarantee:**`

- **Line 354** `[HARD_FORBIDDEN]`
  > `### What IS Guaranteed`

- **Line 540** `[HARD_FORBIDDEN]`
  > `This is the basis of forensic-grade guarantees. Once this invariant is proven, auditors can trust...`

- **Line 565** `[HARD_FORBIDDEN]`
  > `**Lock:** These guarantees are non-negotiable.`

## atlassian/forge-app/docs/SECURITY.md

- **Line 110** `[HARD_FORBIDDEN]`
  > `### 3. Concurrency Guarantees`

- **Line 220** `[HARD_FORBIDDEN]`
  > `- Log retention guarantees`

- **Line 236** `[HARD_FORBIDDEN]`
  > `This document describes security properties **as implemented**. No guarantees are provided.`

## atlassian/forge-app/docs/SECURITY_AND_PRIVACY.md

- **Line 24** `[HARD_FORBIDDEN]`
  > `**Key Guarantee**: ✅ **No write scopes** (write:jira, manage:jira not declared)`

- **Line 129** `[HARD_FORBIDDEN]`
  > `**Guarantee**: Jira enforces user's own permission scope; FirstTry cannot escalate permissions.`

## atlassian/forge-app/docs/SUPPORT.md

- **Line 27** `[HARD_FORBIDDEN]`
  > `3. Maintainers will respond when available (best effort; no guaranteed SLA)`

- **Line 27** `[SLA_UNQUALIFIED]`
  > `3. Maintainers will respond when available (best effort; no guaranteed SLA)`

- **Line 62** `[SLA_UNQUALIFIED]`
  > `**IMPORTANT**: This app provides **NO SERVICE LEVEL AGREEMENT (SLA)**.`

- **Line 65** `[HARD_FORBIDDEN]`
  > `- **Response Time**: Best effort, no guaranteed timeframe`

- **Line 104** `[HARD_FORBIDDEN]`
  > `If internal reliability indicators fall below expected thresholds, the issue may be reviewed by m...`

## atlassian/forge-app/docs/TERMS.md

- **Line 15** `[HARD_FORBIDDEN]`
  > `The maintainers may suspend or terminate access for violations of these terms. Customer uninstall...`

## atlassian/forge-app/enterprise/SECURITY_WHITEPAPER.md

- **Line 11** `[HARD_FORBIDDEN]`
  > `FirstTry - Audit Evidence Snapshot for Jira is a **read-only** Jira Cloud app designed for collec...`

- **Line 79** `[HARD_FORBIDDEN]`
  > `**Design Guarantee**: FirstTry cannot request additional scopes at runtime.`

## atlassian/forge-app/tests/credibility/gap_matrix.json

- **Line 159** `[SLA_UNQUALIFIED]`
  > `"method": "Verify docs/ contains support contact; verify not fake; verify no implied SLA",`

- **Line 161** `[SLA_UNQUALIFIED]`
  > `"expected_pass_condition": "Real contact info; no unqualified SLA promises",`

## atlassian/forge-app/tests/docs/docs_compliance_schema.json

- **Line 33** `[HARD_FORBIDDEN]`
  > `"guaranteed uptime",`

## atlassian/forge-app/tests/operator_verification/ov_matrix.json

- **Line 187** `[HARD_FORBIDDEN]`
  > `"description": "Scan reports for prohibited terms: compliant, secure, safe, guaranteed, certified...`

## atlassian/forge-app/tests/shakedown/SHK_COMMAND_OUTPUTS.txt

- **Line 575** `[HARD_FORBIDDEN]`
  > `✅ SHK-094: Cache Fallback Truth Guarantees (shk_cache_fallback_truth.test.ts)`

## atlassian/forge-app/tests/shakedown/SHK_CREDIBILITY_REPORT.md

- **Line 16** `[HARD_FORBIDDEN]`
  > `- Cache fallback truth guarantees (marked degradation, no misleading outputs)`

- **Line 123** `[HARD_FORBIDDEN]`
  > `### ✅ FINDING 5: Cache Fallback Truth Guarantees`

- **Line 296** `[HARD_FORBIDDEN]`
  > `## DETERMINISM GUARANTEE`

## atlassian/forge-app/tests/shakedown/SHK_FINAL_REPORT.md

- **Line 204** `[HARD_FORBIDDEN]`
  > `✅ **PASS** (8+ assertions) — Production key builder verified, tenant isolation guaranteed.`

- **Line 499** `[HARD_FORBIDDEN]`
  > `Determinism: GUARANTEED ✅`

- **Line 583** `[HARD_FORBIDDEN]`
  > `║  ✅ Idempotency guaranteed across retries                    ║`

## atlassian/forge-app/tests/shakedown/SHK_README.md

- **Line 91** `[HARD_FORBIDDEN]`
  > `## Determinism Guarantee`

- **Line 268** `[HARD_FORBIDDEN]`
  > `- [SHAKEDOWN.md](../../docs/SHAKEDOWN.md) - Enterprise philosophy and guarantees`

- **Line 270** `[HARD_FORBIDDEN]`
  > `- [docs/PRIVACY.md](../../docs/PRIVACY.md) - Privacy guarantees (tenant isolation tested)`

## audit/CLAIMS_PROOF_CATALOG.md

- **Line 60** `[HARD_FORBIDDEN]`
  > `| **RET-002** | Data deletion on uninstall is Atlassian-controlled, not FirstTry | [DATA_RETENTIO...`

- **Line 120** `[HARD_FORBIDDEN]`
  > `| **IR-002** | Triage response within 1-5 business days | [INCIDENT_RESPONSE.md](../docs/INCIDENT...`

- **Line 130** `[HARD_FORBIDDEN]`
  > `| **ER-001** | Workspace isolation enforced by Atlassian | [ENTERPRISE_READINESS.md](../docs/ENTE...`

- **Line 131** `[HARD_FORBIDDEN]`
  > `| **ER-002** | FirstTry does NOT guarantee automatic data deletion | [ENTERPRISE_READINESS.md](.....`

- **Line 135** `[HARD_FORBIDDEN]`
  > `| **ER-006** | No uptime SLA | [ENTERPRISE_READINESS.md](../docs/ENTERPRISE_READINESS.md#what-fir...`

- **Line 135** `[SLA_UNQUALIFIED]`
  > `| **ER-006** | No uptime SLA | [ENTERPRISE_READINESS.md](../docs/ENTERPRISE_READINESS.md#what-fir...`

## audit/CREDIBILITY_HARDENING_REPORT.md

- **Line 292** `[HARD_FORBIDDEN]`
  > `> "These behaviors are governed by Atlassian Forge and Jira Cloud platform guarantees and are not...`

- **Line 296** `[HARD_FORBIDDEN]`
  > `These behaviors are governed by Atlassian Forge platform guarantees`

## audit/DOCS_TRUTH_SOURCES.md

- **Line 22** `[HARD_FORBIDDEN]`
  > `| **Certifications & Guarantees** | Only what code proves or Atlassian provides | No invented SOC...`

- **Line 72** `[HARD_FORBIDDEN]`
  > `- "90-day retention guarantee" (contradicts indefinite)`

- **Line 185** `[HARD_FORBIDDEN]`
  > `> "These behaviors are governed by Atlassian Forge and Jira Cloud platform guarantees and are not...`

- **Line 272** `[HARD_FORBIDDEN]`
  > `## 8. Certifications & Guarantees Truth`

## audit/ENTERPRISE_TRUST_MATRIX.md

- **Line 126** `[SLA_UNQUALIFIED]`
  > `| **SLA Disputes** | Medium | Low | Clear "best effort only" in Terms |`

- **Line 145** `[HARD_FORBIDDEN]`
  > `| **Uptime guaranteed** | No. [ENTERPRISE_READINESS.md](../docs/ENTERPRISE_READINESS.md) | ✅ VERI...`

- **Line 151** `[HARD_FORBIDDEN]`
  > `**FirstTry guarantees**:`

- **Line 156** `[HARD_FORBIDDEN]`
  > `**FirstTry does NOT guarantee**:`

- **Line 211** `[HARD_FORBIDDEN]`
  > `- ❌ Long-term support guarantees beyond 1 major version`

- **Line 235** `[HARD_FORBIDDEN]`
  > `- *"What's your support hours?"* → Community-driven; no guaranteed hours`

## audit/RESIDUAL_RISKS.md

- **Line 24** `[HARD_FORBIDDEN]`
  > `| **Atlassian Forge SLA uptime** | Atlassian does not publish SLA for public Forge | No uptime gu...`

- **Line 24** `[SLA_UNQUALIFIED]`
  > `| **Atlassian Forge SLA uptime** | Atlassian does not publish SLA for public Forge | No uptime gu...`

- **Line 26** `[HARD_FORBIDDEN]`
  > `| **Webhook delivery guarantees** | Forge webhooks are best-effort, not guaranteed | Must handle ...`

- **Line 111** `[HARD_FORBIDDEN]`
  > `| **Data residency guarantee** | Locked to Jira Cloud region | Choose region carefully at signup |`

- **Line 180** `[SLA_UNQUALIFIED]`
  > `- Support SLA (Best effort; escalate to Atlassian if needed)`

- **Line 203** `[SLA_UNQUALIFIED]`
  > `| **Enterprise SLA** | Paid support tier with response SLA | ⚠️ Requires business model change | ...`

- **Line 216** `[SLA_UNQUALIFIED]`
  > `| **Per-workspace SLA** | Forge apps share infrastructure; no per-app SLA | Escalate SLA needs to...`

- **Line 225** `[HARD_FORBIDDEN]`
  > `**Customer**: "Can FirstTry guarantee my data is in the EU?"`

- **Line 231** `[HARD_FORBIDDEN]`
  > `> "Yes, FirstTry guarantees EU residency." (Lie; only Atlassian can guarantee)`

## audit/credibility/CREDIBILITY_FINAL_REPORT.md

- **Line 48** `[HARD_FORBIDDEN]`
  > `**Status**: DESIGN VERIFIED + PLATFORM GUARANTEED`

- **Line 59** `[HARD_FORBIDDEN]`
  > `**Key Finding**: Design-level Tenant isolation guard passed (code-level). Forge platform provides...`

- **Line 98** `[HARD_FORBIDDEN]`
  > `**Residual Risk**: Runtime idempotency guarantees require production testing with actual concurre...`

- **Line 155** `[HARD_FORBIDDEN]`
  > `- ✅ No overclaims (SLA guarantees, SOC2/ISO certifications, Cloud Fortified claims)`

- **Line 155** `[SLA_UNQUALIFIED]`
  > `- ✅ No overclaims (SLA guarantees, SOC2/ISO certifications, Cloud Fortified claims)`

- **Line 156** `[HARD_FORBIDDEN]`
  > `- ✅ All UNKNOWN explicitly documented (response times, recovery guarantees, platform SLAs)`

- **Line 157** `[SLA_UNQUALIFIED]`
  > `- ✅ "NO SERVICE LEVEL AGREEMENT (SLA)" explicitly stated in SUPPORT.md`

- **Line 211** `[SLA_UNQUALIFIED]`
  > `4. ✅ No overclaims (SLA, SOC2 certified, ISO certified, Cloud Fortified)`

- **Line 258** `[HARD_FORBIDDEN]`
  > `4. **Concurrency Guarantees**: Idempotency design verified, runtime behavior requires production ...`

- **Line 316** `[HARD_FORBIDDEN]`
  > `- ❌ NO SLA guarantees (explicitly disclaimed)`

- **Line 342** `[SLA_UNQUALIFIED]`
  > `5. Overclaim detection prevents unsupported SLA/certification claims`

- **Line 354** `[HARD_FORBIDDEN]`
  > `- If someone adds "SLA guarantee", CI will fail`

- **Line 354** `[SLA_UNQUALIFIED]`
  > `- If someone adds "SLA guarantee", CI will fail`

- **Line 415** `[SLA_UNQUALIFIED]`
  > `- ✅ No overclaims (SLA/SOC2/ISO forbidden without proof)`

## audit/credibility/DELIVERY_SUMMARY.md

- **Line 77** `[SLA_UNQUALIFIED]`
  > `- ❌ Overclaims (SLA/SOC2/ISO)`

- **Line 117** `[SLA_UNQUALIFIED]`
  > `- All UNKNOWN explicitly documented (response times, recovery, platform SLA)`

- **Line 170** `[HARD_FORBIDDEN]`
  > `- ⚠️ NO SLA guarantees (explicitly disclaimed)`

- **Line 222** `[HARD_FORBIDDEN]`
  > `4. Concurrency guarantees (design verified, runtime unknown)`

## audit/credibility/INDEX.md

- **Line 71** `[SLA_UNQUALIFIED]`
  > `- Overclaims (SLA, SOC2, ISO)`

- **Line 92** `[HARD_FORBIDDEN]`
  > `grep -rn "SLA guarantee\|SOC2 certified\|ISO certified" docs/`

- **Line 92** `[SLA_UNQUALIFIED]`
  > `grep -rn "SLA guarantee\|SOC2 certified\|ISO certified" docs/`

- **Line 108** `[HARD_FORBIDDEN]`
  > `- ❌ NO SLA guarantees (explicitly stated "NO SERVICE LEVEL AGREEMENT")`

- **Line 132** `[HARD_FORBIDDEN]`
  > `2. Tenant isolation enforcement (Forge sandbox guarantee)`

- **Line 134** `[HARD_FORBIDDEN]`
  > `4. Concurrency guarantees (design verified, runtime unknown)`

- **Line 192** `[SLA_UNQUALIFIED]`
  > `10. `verify-no-overclaims` - Grep for SLA/SOC2/ISO claims`

- **Line 238** `[SLA_UNQUALIFIED]`
  > `4. Ensure no unsupported claims (SLA, SOC2, ISO unless proven)`

## audit/credibility/REMAINING_GAPS_MATRIX.md

- **Line 22** `[HARD_FORBIDDEN]`
  > `- **UNKNOWN**: Requires runtime environment (Forge production) or platform guarantee`

- **Line 55** `[HARD_FORBIDDEN]`
  > `**Status**: **PLATFORM-GUARANTEED**`

- **Line 63** `[HARD_FORBIDDEN]`
  > `| GAP2_PLATFORM_DEPENDENCY | Document Forge isolation guarantee | UNKNOWN | Forge platform enforc...`

- **Line 198** `[HARD_FORBIDDEN]`
  > `| GAP-2 | Tenant Isolation | Platform Guaranteed | Storage design sound | Runtime isolation verif...`

- **Line 205** `[HARD_FORBIDDEN]`
  > `**Overall Status**: 2 PASS, 5 UNKNOWN (requires Forge production runtime or platform guarantees)`

## audit/dashboard_upgrade/OUT/03_tests_after_resolver_integration.txt

- **Line 2253** `[HARD_FORBIDDEN]`
  > `[90mstdout[2m | tests/shakedown/scenarios/shk_cache_fallback_truth.test.ts[2m > [22m[2mSHK-0...`

- **Line 2256** `[HARD_FORBIDDEN]`
  > `[90mstdout[2m | tests/shakedown/scenarios/shk_cache_fallback_truth.test.ts[2m > [22m[2mSHK-0...`

- **Line 2283** `[HARD_FORBIDDEN]`
  > `"guarantees": [`

- **Line 2289** `[HARD_FORBIDDEN]`
  > `"verdict": "PASS: Cache fallback truth guarantees verified"`

## audit/dashboard_upgrade/OUT/DASHBOARD_PROJECT_STATUS.txt

- **Line 184** `[HARD_FORBIDDEN]`
  > `- Manual copy always available (manualCopyAlwaysAvailable: true)`

## audit/marketplace_preflight_report.md

- **Line 31** `[SLA_UNQUALIFIED]`
  > `✅ No overclaims (SOC2/ISO/SLA explicitly disclaimed)`

- **Line 419** `[HARD_FORBIDDEN]`
  > `**Search Pattern**: `SOC\s?2|ISO\s?\d{4,5}|Cloud Fortified|SLA guarantee``

- **Line 419** `[SLA_UNQUALIFIED]`
  > `**Search Pattern**: `SOC\s?2|ISO\s?\d{4,5}|Cloud Fortified|SLA guarantee``

- **Line 455** `[HARD_FORBIDDEN]`
  > `| SLA guarantees | ❌ NO | Explicitly states "NO SLA" | ✅ PASS |`

- **Line 463** `[SLA_UNQUALIFIED]`
  > `- ✅ **NO** unverifiable SLA promises`

- **Line 467** `[SLA_UNQUALIFIED]`
  > `- ✅ Support.md explicitly states "NO SERVICE LEVEL AGREEMENT (SLA)" (line 56)`

## audit/marketplace_volvo_grade/EVIDENCE_CATALOG.md

- **Line 17** `[SLA_UNQUALIFIED]`
  > `**Evidence of SLA Tiers:** MISSING`

- **Line 462** `[SLA_UNQUALIFIED]`
  > `| A | SECURITY.md, manifest.yml | SLA tiers missing |`

## audit/marketplace_volvo_grade/GAP_REPORT_DETAILED.md

- **Line 170** `[SLA_UNQUALIFIED]`
  > `2. Deletion SLA: 7 business days`

- **Line 665** `[SLA_UNQUALIFIED]`
  > `### GAP-D1: Severity-Based SLA Tiers Missing`

- **Line 685** `[SLA_UNQUALIFIED]`
  > `- One SLA for all severity levels (unrealistic)`

- **Line 929** `[SLA_UNQUALIFIED]`
  > `| D1 | SLA Tiers | MED | OPEN | <1 | S |`

## audit/marketplace_volvo_grade/IMPLEMENTATION_ROADMAP.md

- **Line 95** `[SLA_UNQUALIFIED]`
  > `- Document manual deletion request process (7-day SLA)`

- **Line 249** `[SLA_UNQUALIFIED]`
  > `3. SLA tiers documentation (GAP-D1)`

- **Line 315** `[SLA_UNQUALIFIED]`
  > `#### Wednesday: SLA Tiers & Security Hardening (GAP-D1 + GAP-A1)`

- **Line 334** `[SLA_UNQUALIFIED]`
  > `- [x] SECURITY.md with severity SLA tiers`

- **Line 411** `[SLA_UNQUALIFIED]`
  > `| GAP-D1: SLA Tiers | 4 | ON TRACK |`

- **Line 618** `[SLA_UNQUALIFIED]`
  > `- Week 2: SLA tiers + SLI/SLO (8h)`

## audit/marketplace_volvo_grade/MARKETPLACE_READINESS_CHECKLIST.md

- **Line 15** `[SLA_UNQUALIFIED]`
  > `- Gaps: SLA tiers not severity-ranked (GAP-D1)`

- **Line 23** `[SLA_UNQUALIFIED]`
  > `- [ ] Severity-based SLA tiers documented`

## audit/marketplace_volvo_grade/README.md

- **Line 163** `[SLA_UNQUALIFIED]`
  > `**Security Policy:** SECURITY.md with 48h acknowledgment, 5-day assessment SLA`

## audit/marketplace_volvo_grade/REMEDIATION_PATCHES.md

- **Line 420** `[SLA_UNQUALIFIED]`
  > `3. SLA: Deletion confirmed within 7 business days`

- **Line 1324** `[SLA_UNQUALIFIED]`
  > `### Patch 7.2: Severity SLA Tiers Documentation`

- **Line 1360** `[SLA_UNQUALIFIED]`
  > `- **Draft patch:** Within SLA timeframe`

## audit/shakedown/CERTIFICATION_SUMMARY.md

- **Line 77** `[HARD_FORBIDDEN]`
  > `**Determinism**: GUARANTEED ✅`

## audit/shakedown/SHK_DIFF.txt

- **Line 38** `[HARD_FORBIDDEN]`
  > `Certification: DETERMINISM GUARANTEED ✅`

## audit/shakedown/SHK_RUN_DIGESTS.txt

- **Line 35** `[HARD_FORBIDDEN]`
  > `Determinism: GUARANTEED ✅`

- **Line 120** `[HARD_FORBIDDEN]`
  > `- With identical results guaranteed`

- **Line 167** `[HARD_FORBIDDEN]`
  > `║  Result: DETERMINISM GUARANTEED ✅                            ║`

## audit_artifacts/DEPLOYMENT_GO_NO_GO.md

- **Line 28** `[HARD_FORBIDDEN]`
  > `| C | Read-Only Jira Guarantee | ✅ COMPLETE | PASS (GO) |`

- **Line 82** `[HARD_FORBIDDEN]`
  > `**Impact:** Redundant storage (low) but breaks idempotency guarantee`

## audit_artifacts/INVARIANT_COMPLIANCE_MATRIX.md

- **Line 116** `[HARD_FORBIDDEN]`
  > `✅ **Idempotency Guarantee:**`

- **Line 218** `[HARD_FORBIDDEN]`
  > `**Statement:** "Same Jira state always produces same snapshot hash. This guarantees reproducibili...`

- **Line 368** `[HARD_FORBIDDEN]`
  > `- Guarantee: Green (FirstTry working) != Green (Jira configured correctly)`

## audit_artifacts/JIRA_API_INVENTORY.md

- **Line 3** `[HARD_FORBIDDEN]`
  > `**Audit Phase:** C - Read-Only Jira Guarantee`

- **Line 139** `[HARD_FORBIDDEN]`
  > `### Read-Only Jira Guarantee: **✅ GO**`

## audit_artifacts/OPERABILITY_RELIABILITY_REVIEW.md

- **Line 148** `[HARD_FORBIDDEN]`
  > `### Idempotency Guarantee`

- **Line 351** `[HARD_FORBIDDEN]`
  > `// Explicit guarantee: silence indicator message`

## audit_artifacts/README.md

- **Line 64** `[HARD_FORBIDDEN]`
  > `- Read-only guarantee clear ✅`

- **Line 193** `[HARD_FORBIDDEN]`
  > `| Jira Read-Only Guarantee | 100% | Code + grep (no write method) |`

- **Line 256** `[HARD_FORBIDDEN]`
  > `| Is Jira safe? | ✅ YES (read-only guaranteed) | JIRA_API_INVENTORY.md |`

## audit_artifacts/SECURITY_PRIVACY_REVIEW.md

- **Line 486** `[SLA_UNQUALIFIED]`
  > `- Forge platform provides SLA (99.5%)`

## audit_artifacts/UI_CLAIMS_TRUTH_REVIEW.md

- **Line 421** `[HARD_FORBIDDEN]`
  > `| Read-only guarantee | ✅ Yes (safety claim) | snapshot_capture.ts:275 | ✅ MATCH |`

- **Line 432** `[HARD_FORBIDDEN]`
  > `- "guaranteed" (not found - uses "monitor", "capture")`

- **Line 448** `[HARD_FORBIDDEN]`
  > `| No false implications | ✅ PASS | No "AI", "guaranteed", "real-time" |`

## audit_artifacts/atlassian_dual_layer/INDEX.md

- **Line 59** `[HARD_FORBIDDEN]`
  > `- Read-only guarantee verified`

- **Line 262** `[HARD_FORBIDDEN]`
  > `- [x] Read-only guarantee (Zero write operations)`

## audit_artifacts/atlassian_dual_layer/PHASE_4_DELIVERY_SUMMARY.md

- **Line 54** `[HARD_FORBIDDEN]`
  > `**Append-Only Guarantees:**`

- **Line 155** `[HARD_FORBIDDEN]`
  > `**Immutability guarantees:**`

## audit_artifacts/atlassian_dual_layer/phase_4_evidence.md

- **Line 302** `[HARD_FORBIDDEN]`
  > `## Read-Only Guarantee`

- **Line 363** `[HARD_FORBIDDEN]`
  > `- [x] Read-only guarantee verified`

## audit_artifacts/feature_extraction/FIRSTTRY_FEATURE_TRUTH.md

- **Line 211** `[HARD_FORBIDDEN]`
  > `Stores check results indexed by cache key (tool + targets + config + environment). On subsequent ...`

- **Line 778** `[HARD_FORBIDDEN]`
  > `- Security advisory DB not always available`

## audit_artifacts/repo_audit/05_code_health_findings.md

- **Line 40** `[SLA_UNQUALIFIED]`
  > `3. Set SLA for resolution (e.g., must resolve within 2 sprints)`

## audit_artifacts/repo_audit/_raw/rg_env_usage.txt

- **Line 224** `[HARD_FORBIDDEN]`
  > `./.venv-build/lib/python3.12/site-packages/setuptools/_distutils/util.py:190:    'os.environ' is ...`

- **Line 528** `[HARD_FORBIDDEN]`
  > `./.venv-build/lib/python3.11/site-packages/setuptools/_distutils/util.py:190:    'os.environ' is ...`

- **Line 995** `[HARD_FORBIDDEN]`
  > `./.venv_tmp/lib/python3.12/site-packages/setuptools/_distutils/util.py:190:    'os.environ' is fi...`

## audit_artifacts/repo_audit/_raw/rg_placeholders.txt

- **Line 787** `[HARD_FORBIDDEN]`
  > `./.venv-build/lib/python3.11/site-packages/mypy/plugin.py:736:              guarantees that there...`

- **Line 1578** `[HARD_FORBIDDEN]`
  > `./.venv_tmp/lib/python3.12/site-packages/mypy/plugin.py:735:              guarantees that there a...`

## audit_artifacts/repo_audit_v2/11_next_actions_ranked.md

- **Line 319** `[SLA_UNQUALIFIED]`
  > `- SLA support`

## audit_artifacts/repo_hygiene_phase0/HISTORY_REWRITE_DECISION.md

- **Line 93** `[HARD_FORBIDDEN]`
  > `- Cannot guarantee coordination of re-clones`

## docs/ACCESS_CONTROL.md

- **Line 136** `[HARD_FORBIDDEN]`
  > `Structural Guarantee: Keys are different → No cross-workspace access possible`

- **Line 169** `[HARD_FORBIDDEN]`
  > `### 5.2 Read-Only Guarantee`

## docs/ATLASSIAN_DUAL_LAYER_SPEC.md

- **Line 296** `[HARD_FORBIDDEN]`
  > `### Bounded Storage Guarantee`

- **Line 340** `[HARD_FORBIDDEN]`
  > `**Guarantee:** If run_key + execution_timestamp already exist in ledger, SKIP execution (idempote...`

- **Line 643** `[HARD_FORBIDDEN]`
  > `### Idempotency Guarantee`

- **Line 648** `[HARD_FORBIDDEN]`
  > `- **Guarantee:** Event processed at-most-once; duplicate submissions return same response`

- **Line 684** `[HARD_FORBIDDEN]`
  > `#### Bounded Storage Guarantee`

## docs/AUDIT_EXCEPTION_RECORD.md

- **Line 6** `[SLA_UNQUALIFIED]`
  > `- Phase 8 discovered 8 risk findings including 3 CRITICAL SLA-related issues`

- **Line 9** `[HARD_FORBIDDEN]`
  > `- Auto-editing was necessary to achieve SLA/guarantee consistency across corpus`

- **Line 9** `[SLA_UNQUALIFIED]`
  > `- Auto-editing was necessary to achieve SLA/guarantee consistency across corpus`

- **Line 21** `[SLA_UNQUALIFIED]`
  > `- File 1: `docs/PRIVACY.md` (added SLA disclaimer section)`

- **Line 26** `[HARD_FORBIDDEN]`
  > `All edits to PRIVACY and SECURITY files were necessary to remove unqualified SLA/guarantee langua...`

- **Line 26** `[SLA_UNQUALIFIED]`
  > `All edits to PRIVACY and SECURITY files were necessary to remove unqualified SLA/guarantee langua...`

## docs/CANONICALIZATION_SPEC.md

- **Line 381** `[HARD_FORBIDDEN]`
  > `## 14. Non-Negotiable Guarantees`

- **Line 383** `[HARD_FORBIDDEN]`
  > `This specification guarantees:`

## docs/CHANGELOG_POLICY.md

- **Line 75** `[HARD_FORBIDDEN]`
  > `### Migration Guarantee`

## docs/COMPLIANCE.md

- **Line 90** `[HARD_FORBIDDEN]`
  > `**Recommendation**: EU customers must review Atlassian's Forge DPA and data processing terms. Fir...`

## docs/CONTROL_MAPPING.md

- **Line 23** `[HARD_FORBIDDEN]`
  > `- ❌ **NOT a guarantee** — Implemented controls are subject to change; regulatory environments evolve`

- **Line 179** `[SLA_UNQUALIFIED]`
  > `| **A.13.1**: Incident event classification | Security contact defined | [SECURITY.md](SECURITY.m...`

- **Line 213** `[HARD_FORBIDDEN]`
  > `### Immutability Guarantee (ISO 27001 A.13 / SOC 2 CC7.1)`

- **Line 261** `[HARD_FORBIDDEN]`
  > `✅ **Immutability Guarantee** (10 unit tests passing)`

- **Line 337** `[SLA_UNQUALIFIED]`
  > `- [SUPPORT_POLICY.md](SUPPORT_POLICY.md) — Support contact & SLA`

## docs/DATA_RETENTION.md

- **Line 45** `[HARD_FORBIDDEN]`
  > `**CRITICAL DISCLAIMER**: The following behaviors are governed by Atlassian Forge platform guarant...`

- **Line 50** `[HARD_FORBIDDEN]`
  > `**What FirstTry Guarantees**: NOTHING`

- **Line 56** `[HARD_FORBIDDEN]`
  > `- ❌ FirstTry cannot guarantee data purge on uninstall`

- **Line 64** `[HARD_FORBIDDEN]`
  > `**What FirstTry Guarantees**: NOTHING`

- **Line 76** `[HARD_FORBIDDEN]`
  > `**What FirstTry Guarantees**: NOTHING`

- **Line 88** `[HARD_FORBIDDEN]`
  > `**What FirstTry Guarantees**: NOTHING`

- **Line 113** `[HARD_FORBIDDEN]`
  > `- ✅ Purge is guaranteed by Atlassian infrastructure`

## docs/DOCS_AUDIT_FINAL_REPORT.md

- **Line 12** `[HARD_FORBIDDEN]`
  > `FirstTry documentation has been audited across **2,778 files** and **7 P0 (Reviewer-Critical)** d...`

- **Line 12** `[SLA_UNQUALIFIED]`
  > `FirstTry documentation has been audited across **2,778 files** and **7 P0 (Reviewer-Critical)** d...`

- **Line 15** `[HARD_FORBIDDEN]`
  > `- ✅ **No SLA or guarantees are expressed anywhere in the repository**`

- **Line 62** `[SLA_UNQUALIFIED]`
  > `- Red flag detected: SLA document exists`

- **Line 74** `[SLA_UNQUALIFIED]`
  > `- 3 CRITICAL (auto-escalation, SLA document, SLA link)`

- **Line 92** `[HARD_FORBIDDEN]`
  > `This does not imply automated escalation or guaranteed response."`

- **Line 97** `[SLA_UNQUALIFIED]`
  > `- All P0 docs now have NO-SLA language`

- **Line 110** `[SLA_UNQUALIFIED]`
  > `2. `docs/PRIVACY.md` → Add SLA disclaimer section`

- **Line 112** `[SLA_UNQUALIFIED]`
  > `4. `docs/SUPPORT.md` → Add NO-SLA header + fix link text (SLAs → Model)`

- **Line 114** `[SLA_UNQUALIFIED]`
  > `6. `docs/SUPPORT_POLICY.md` → Standardize NO-SLA language`

- **Line 121** `[HARD_FORBIDDEN]`
  > `- All "guarantee" language is explicitly qualified with "NO"`

- **Line 141** `[SLA_UNQUALIFIED]`
  > `| SLA link reference | docs/SUPPORT.md:211 | Link text changed (SLAs → Model) | ✅ FIXED |`

- **Line 147** `[SLA_UNQUALIFIED]`
  > `| PRIVACY.md SLA ambiguity | Missing disclaimer | Added SLA section | ✅ FIXED |`

- **Line 149** `[SLA_UNQUALIFIED]`
  > `| SUPPORT.md NO-SLA header | Inconsistent | Prominent header added | ✅ FIXED |`

- **Line 160** `[HARD_FORBIDDEN]`
  > `- **Audit Assert**: "No SLA or guarantees are expressed anywhere"`

- **Line 161** `[SLA_UNQUALIFIED]`
  > `- **Verification**: Searched 2,778 files for unqualified SLA claims`

- **Line 163** `[SLA_UNQUALIFIED]`
  > `- All SLA language is explicitly qualified with "NO" or "DOES NOT"`

- **Line 165** `[HARD_FORBIDDEN]`
  > `### No Uptime Guarantees ✅`

- **Line 166** `[HARD_FORBIDDEN]`
  > `- Searched for "guaranteed uptime" → Only found "NO guaranteed uptime"`

- **Line 168** `[HARD_FORBIDDEN]`
  > `- Searched for "mission-critical" → NOT FOUND`

- **Line 171** `[HARD_FORBIDDEN]`
  > `- Searched for "guaranteed response" → Only found "NO guaranteed response"`

- **Line 175** `[HARD_FORBIDDEN]`
  > `### No Enterprise Guarantees ✅`

- **Line 176** `[HARD_FORBIDDEN]`
  > `- Searched for "enterprise-ready" → NOT FOUND`

- **Line 178** `[SLA_UNQUALIFIED]`
  > `- No phone/email/SLA support promised`

- **Line 219** `[HARD_FORBIDDEN]`
  > `- "May escalate" (not guaranteed)`

- **Line 232** `[SLA_UNQUALIFIED]`
  > `2. ✅ Prominent NO-SLA disclaimers in place`

- **Line 243** `[SLA_UNQUALIFIED]`
  > `1. Maintain NO-SLA language consistency`

- **Line 244** `[HARD_FORBIDDEN]`
  > `2. Avoid use of "guarantee" without qualifier`

- **Line 246** `[SLA_UNQUALIFIED]`
  > `4. Update SLA disclaimer when behavior changes`

- **Line 250** `[SLA_UNQUALIFIED]`
  > `## Non-SLA Assertion`

- **Line 254** `[HARD_FORBIDDEN]`
  > `> **No SLA or guarantees are expressed anywhere in the FirstTry repository.**`

- **Line 259** `[HARD_FORBIDDEN]`
  > `> - No guaranteed response/resolution timeframes`

- **Line 260** `[HARD_FORBIDDEN]`
  > `> - No uptime guarantees`

- **Line 263** `[SLA_UNQUALIFIED]`
  > `> The only legal SLA document (`docs/legal/service-level-agreement.md`) is explicitly marked as`

- **Line 294** `[SLA_UNQUALIFIED]`
  > `- Zero unqualified SLA claims`

- **Line 295** `[HARD_FORBIDDEN]`
  > `- Zero unqualified uptime guarantees`

## docs/DOCS_CONSISTENCY_REPORT.md

- **Line 42** `[SLA_UNQUALIFIED]`
  > `- Add NO-SLA disclaimer at top (matching atlassian/forge-app/docs/SUPPORT.md)`

- **Line 51** `[SLA_UNQUALIFIED]`
  > `**Issue**: Document titled "Service Level Agreement" but lacks NO-SLA disclaimer`

- **Line 58** `[HARD_FORBIDDEN]`
  > `Firsttry provides NO SERVICE LEVEL AGREEMENT or uptime guarantees.`

- **Line 67** `[SLA_UNQUALIFIED]`
  > `**Fix**: Add support/SLA disclaimer section`

- **Line 74** `[HARD_FORBIDDEN]`
  > `- "intends to" (not guaranteed)`

- **Line 76** `[HARD_FORBIDDEN]`
  > `- "best effort" (not guaranteed)`

- **Line 92** `[HARD_FORBIDDEN]`
  > `| "targets" (not guarantees) | 3 docs | Good |`

- **Line 109** `[HARD_FORBIDDEN]`
  > `- [ ] No uptime guarantees`

- **Line 121** `[HARD_FORBIDDEN]`
  > `- ✅ No guarantees`

- **Line 131** `[SLA_UNQUALIFIED]`
  > `1. docs/PRIVACY.md — Add SLA/support disclaimer`

- **Line 133** `[SLA_UNQUALIFIED]`
  > `3. docs/SUPPORT.md — Add NO-SLA header, change link text`

- **Line 137** `[SLA_UNQUALIFIED]`
  > `5. docs/SUPPORT_POLICY.md — Standardize NO-SLA language`

## docs/DOCS_FIX_PLAN.md

- **Line 22** `[SLA_UNQUALIFIED]`
  > `#### Fix 1: docs/PRIVACY.md — Add SLA Disclaimer`

- **Line 24** `[SLA_UNQUALIFIED]`
  > `**Action**: Insert SLA disclaimer section at end`

- **Line 25** `[HARD_FORBIDDEN]`
  > `**Justification**: Privacy docs must reference support model to prevent assumption that privacy g...`

- **Line 31** `[SLA_UNQUALIFIED]`
  > `## Support Model & SLA Status`

- **Line 33** `[SLA_UNQUALIFIED]`
  > `FirstTry provides NO SERVICE LEVEL AGREEMENT (SLA) for privacy or data handling.`

- **Line 34** `[HARD_FORBIDDEN]`
  > `- **Response Time**: Best effort (no guaranteed response)`

- **Line 59** `[HARD_FORBIDDEN]`
  > `and does not constitute a legal SLA or support guarantee. See disclaimers below.`

- **Line 66** `[SLA_UNQUALIFIED]`
  > `**Line**: Insert at top (before current "# Service Level Agreement (SLA)")`

- **Line 70** `[SLA_UNQUALIFIED]`
  > `#### Fix 3: docs/SUPPORT.md — Add NO-SLA Header & Fix Link Text`

- **Line 73** `[SLA_UNQUALIFIED]`
  > `**Part 3a - Add NO-SLA disclaimer at top**:`

- **Line 79** `[HARD_FORBIDDEN]`
  > `**NO SERVICE LEVEL AGREEMENT** (SLA), no guaranteed response times, and no`

- **Line 79** `[SLA_UNQUALIFIED]`
  > `**NO SERVICE LEVEL AGREEMENT** (SLA), no guaranteed response times, and no`

- **Line 80** `[HARD_FORBIDDEN]`
  > `uptime guarantees.`

- **Line 106** `[HARD_FORBIDDEN]`
  > `guaranteed response times. Actual response depends on complexity and maintainer availability.``

- **Line 113** `[SLA_UNQUALIFIED]`
  > `#### Fix 5: docs/SUPPORT_POLICY.md — Standardize NO-SLA Language`

- **Line 125** `[HARD_FORBIDDEN]`
  > `with no guaranteed response times, escalation SLAs, or uptime guarantees.`

- **Line 140** `[HARD_FORBIDDEN]`
  > `- NEW: "If internal reliability indicators fall below expected thresholds, the issue may be revie...`

- **Line 149** `[SLA_UNQUALIFIED]`
  > `2. 🔧 docs/PRIVACY.md (add SLA disclaimer)`

- **Line 151** `[SLA_UNQUALIFIED]`
  > `4. 🔧 docs/SUPPORT.md (add NO-SLA header + fix link)`

- **Line 153** `[SLA_UNQUALIFIED]`
  > `6. 🔧 docs/SUPPORT_POLICY.md (standardize NO-SLA language)`

- **Line 160** `[SLA_UNQUALIFIED]`
  > `**Scope**: Limited to support/SLA-related sections`

- **Line 171** `[HARD_FORBIDDEN]`
  > `- Verify no new SLA/guarantee claims introduced`

- **Line 171** `[SLA_UNQUALIFIED]`
  > `- Verify no new SLA/guarantee claims introduced`

- **Line 172** `[SLA_UNQUALIFIED]`
  > `- Verify all P0 docs have NO-SLA disclaimer`

- **Line 180** `[SLA_UNQUALIFIED]`
  > `| docs/PRIVACY.md | Add | End | Add SLA disclaimer |`

- **Line 182** `[SLA_UNQUALIFIED]`
  > `| docs/SUPPORT.md | Add + Modify | 1-5, 211 | Add NO-SLA header, fix link text |`

- **Line 184** `[SLA_UNQUALIFIED]`
  > `| docs/SUPPORT_POLICY.md | Add | 1-5 | Add NO-SLA header |`

## docs/DOCS_INDEX.md

- **Line 157** `[HARD_FORBIDDEN]`
  > `- **This documentation does NOT include product roadmap guarantees**: Roadmap items describe plan...`

## docs/DOCS_LINK_GRAPH.md

- **Line 43** `[SLA_UNQUALIFIED]`
  > `├── SUPPORT_POLICY.md → support model & NO-SLA disclaimer`

- **Line 52** `[SLA_UNQUALIFIED]`
  > `### 🚨 CRITICAL: SLA Document Exists`

- **Line 59** `[SLA_UNQUALIFIED]`
  > `- If SLA document exists, does it contain:`

- **Line 60** `[HARD_FORBIDDEN]`
  > `- Uptime guarantees?`

- **Line 74** `[SLA_UNQUALIFIED]`
  > `| ./docs/legal/ | 6 | Legal/SLA |`

- **Line 99** `[SLA_UNQUALIFIED]`
  > `⚠️ SLA document flagged as critical (requires Phase 4 verification)`

## docs/DOCS_RISK_FINDINGS.md

- **Line 7** `[HARD_FORBIDDEN]`
  > `**Risk Categories**: SLA/Guarantee, Auto-Escalation, SEV Levels, Promise Language`

- **Line 7** `[SLA_UNQUALIFIED]`
  > `**Risk Categories**: SLA/Guarantee, Auto-Escalation, SEV Levels, Promise Language`

- **Line 17** `[SLA_UNQUALIFIED]`
  > `| docs/SUPPORT.md | P0 | Marketplace, Enterprise | Public support policy, SLA reference |`

- **Line 21** `[SLA_UNQUALIFIED]`
  > `| docs/RELIABILITY.md | P0 | Enterprise + Marketplace | SLA/uptime positioning |`

- **Line 74** `[SLA_UNQUALIFIED]`
  > `- Line 1: "# Service Level Agreement (SLA)" — Document title`

- **Line 78** `[SLA_UNQUALIFIED]`
  > `- Line 38: "This SLA does not apply to..."`

- **Line 84** `[SLA_UNQUALIFIED]`
  > `**Fix**: DOWNGRADE — Add explicit disclaimer on Line 1-5: "This is NOT a legal SLA. It describes ...`

- **Line 94** `[SLA_UNQUALIFIED]`
  > `**Risk**: References "Reliability SLAs" in link text → implies SLA exists`

- **Line 105** `[SLA_UNQUALIFIED]`
  > `**Risk**: Defines SEV1 severity levels → implies structured SLA response`

- **Line 107** `[SLA_UNQUALIFIED]`
  > `**Fix**: DOWNGRADE — Replace "SEV1" with "critical issue" (remove formal SLA terminology)`

- **Line 113** `[SLA_UNQUALIFIED]`
  > `#### Finding 5: SLA/NO-SLA Disclaimers (Good but Scattered)`

- **Line 117** `[HARD_FORBIDDEN]`
  > `- atlassian/forge-app/docs/SUPPORT.md:27 → "no guaranteed SLA"`

- **Line 117** `[SLA_UNQUALIFIED]`
  > `- atlassian/forge-app/docs/SUPPORT.md:27 → "no guaranteed SLA"`

- **Line 118** `[SLA_UNQUALIFIED]`
  > `- atlassian/forge-app/docs/SUPPORT.md:62 → "NO SERVICE LEVEL AGREEMENT (SLA)"`

- **Line 119** `[HARD_FORBIDDEN]`
  > `- atlassian/forge-app/docs/SUPPORT.md:65 → "no guaranteed timeframe"`

- **Line 124** `[SLA_UNQUALIFIED]`
  > `**Fix**: CONSOLIDATE — Add single prominent SLA disclaimer at TOP of file:`

- **Line 127** `[HARD_FORBIDDEN]`
  > `with no guaranteed response times, resolution SLAs, or uptime guarantees.`

- **Line 167** `[SLA_UNQUALIFIED]`
  > `**Fix**: SAFE — Document already disclaims SLA status. Consider clarifying "intentions only."`

- **Line 183** `[SLA_UNQUALIFIED]`
  > `3. **SLA link reference** (docs/SUPPORT.md:211)`

- **Line 184** `[SLA_UNQUALIFIED]`
  > `- Status: UNVERIFIABLE (title implies SLA status)`

- **Line 193** `[SLA_UNQUALIFIED]`
  > `5. **Scattered SLA disclaimers** (Multiple files)`

- **Line 203** `[SLA_UNQUALIFIED]`
  > `## No False SLA Claims Found ✅`

- **Line 208** `[HARD_FORBIDDEN]`
  > `- "No guaranteed response time"`

- **Line 209** `[HARD_FORBIDDEN]`
  > `- "No uptime guarantees"`

## docs/ENTERPRISE_LICENSE_SUMMARY.md

- **Line 17** `[SLA_UNQUALIFIED]`
  > `- SLA-backed uptime`

## docs/ENTERPRISE_READINESS.md

- **Line 8** `[HARD_FORBIDDEN]`
  > `## What FirstTry Guarantees`

- **Line 18** `[HARD_FORBIDDEN]`
  > `## What FirstTry Does NOT Guarantee`

- **Line 31** `[HARD_FORBIDDEN]`
  > `**CRITICAL**: The following behaviors are governed by Atlassian Forge platform guarantees and are...`

- **Line 45** `[HARD_FORBIDDEN]`
  > `- **FirstTry Cannot**: Change, specify, or guarantee data residency`

## docs/ENTITLEMENTS.md

- **Line 3** `[HARD_FORBIDDEN]`
  > `## Contract & Guarantees`

- **Line 7** `[HARD_FORBIDDEN]`
  > `**Guarantee:** Plans affect ONLY cost drivers (exports, retention). Truth computation, evidence g...`

- **Line 47** `[HARD_FORBIDDEN]`
  > `These are ALWAYS available to all tenants regardless of plan:`

- **Line 249** `[HARD_FORBIDDEN]`
  > `## Compliance & Guarantees`

## docs/EXTERNAL_APIS.md

- **Line 29** `[SLA_UNQUALIFIED]`
  > `- **SLA**: [TO BE DOCUMENTED]`

- **Line 38** `[SLA_UNQUALIFIED]`
  > `- **SLA**: [TO BE DOCUMENTED]`

- **Line 47** `[SLA_UNQUALIFIED]`
  > `- **SLA**: [TO BE DOCUMENTED]`

- **Line 56** `[SLA_UNQUALIFIED]`
  > `- **SLA**: [TO BE DOCUMENTED]`

- **Line 85** `[SLA_UNQUALIFIED]`
  > `### Reliability & SLA`

- **Line 87** `[SLA_UNQUALIFIED]`
  > `- **SLA**: [99.9% uptime / Best effort / None]`

- **Line 125** `[SLA_UNQUALIFIED]`
  > `- [ ] Product Manager (SLA agreement)`

## docs/FEATURE_PHASE_TIER_MATRIX.md

- **Line 74** `[HARD_FORBIDDEN]`
  > `| **Guarantees** | Guarantee outcomes, promise no issues, ensure safety |`

## docs/HASHING_STRATEGY.md

- **Line 14** `[HARD_FORBIDDEN]`
  > `- Guarantee:`

- **Line 25** `[HARD_FORBIDDEN]`
  > `- Guarantee:`

## docs/MARKETPLACE_FORM_ANSWERS.md

- **Line 161** `[HARD_FORBIDDEN]`
  > `**Response Time**: Best effort (no guaranteed SLA)`

- **Line 161** `[SLA_UNQUALIFIED]`
  > `**Response Time**: Best effort (no guaranteed SLA)`

## docs/MARKETPLACE_LISTING.md

- **Line 131** `[HARD_FORBIDDEN]`
  > `## Immutability & Audit Trail Guarantees`

- **Line 198** `[HARD_FORBIDDEN]`
  > `- **SLA guarantees**: No response time commitments`

- **Line 198** `[SLA_UNQUALIFIED]`
  > `- **SLA guarantees**: No response time commitments`

- **Line 220** `[HARD_FORBIDDEN]`
  > `- ✅ **SOC2/HIPAA**: Audit trail with immutability guarantees; encryption managed by Forge`

## docs/PHASE9_FULL_CORPUS_SAFETY_FINDINGS.md

- **Line 18** `[SLA_UNQUALIFIED]`
  > `- **Line 124**: `| Legal coverage | ✅ | `docs/legal/{privacy,terms,data,sla}.md` |``

- **Line 19** `[SLA_UNQUALIFIED]`
  > `- **Line 175**: `- ✅ Complete legal documentation (privacy, terms, data handling, SLA)``

- **Line 23** `[SLA_UNQUALIFIED]`
  > `- **Line 17**: `✗ SLA tiers, contact verification missing``

- **Line 24** `[SLA_UNQUALIFIED]`
  > `- **Line 143**: `- SLA Tiers (4h)``

- **Line 25** `[SLA_UNQUALIFIED]`
  > `- **Line 276**: `[ ] Add SLA tiers to SECURITY.md``

- **Line 29** `[HARD_FORBIDDEN]`
  > `- **Line 246**: `| Enterprise-ready tier | pro+full (7.4% variance, 61% cache improvement) |``

- **Line 37** `[SLA_UNQUALIFIED]`
  > `- **Line 48**: `- ✅ `docs/legal/service-level-agreement.md` — SLA expectations documented``

- **Line 38** `[SLA_UNQUALIFIED]`
  > `- **Line 87**: `- **Evidence**: Privacy Policy, ToS, Data Handling, SLA all present``

- **Line 39** `[SLA_UNQUALIFIED]`
  > `- **Line 217**: `| Legal coverage | ✅ | `docs/legal/{privacy,terms,data,sla}.md` |``

- **Line 43** `[SLA_UNQUALIFIED]`
  > `- **Line 104**: `- Include: URL patterns, authentication method, data sensitivity, SLA requirements``

- **Line 47** `[SLA_UNQUALIFIED]`
  > `- **Line 23**: `| GAP 7 | Support Reality | ✅ **PASS** | Support contact documented; no unqualifi...`

- **Line 51** `[SLA_UNQUALIFIED]`
  > `- **Line 101**: `- Specify: URL patterns, auth method, data sensitivity, SLA``

- **Line 55** `[SLA_UNQUALIFIED]`
  > `- **Line 210**: `- Service SLA / reliability requirements``

- **Line 59** `[SLA_UNQUALIFIED]`
  > `- **Line 215**: `- SLA Tiers (4h)``

- **Line 63** `[SLA_UNQUALIFIED]`
  > `- **Line 14**: `- **Critical Files**: Exist (privacy-policy, terms-of-service, data-handling, SLA)``

- **Line 64** `[SLA_UNQUALIFIED]`
  > `- **Line 39**: `| **Legal coverage clarity** | In legal/ directory | ✅ REQUIRED | Exists (privacy...`

- **Line 65** `[SLA_UNQUALIFIED]`
  > `- **Line 90**: `- SLA: `docs/legal/service-level-agreement.md```

- **Line 69** `[HARD_FORBIDDEN]`
  > `- **Line 102**: `├── Final Verdict (ENTERPRISE-READY WITH CONDITIONS)``

- **Line 73** `[HARD_FORBIDDEN]`
  > `- **Line 100**: `- No unverifiable promises ("guaranteed," "promised," etc.)``

- **Line 77** `[SLA_UNQUALIFIED]`
  > `- **Line 180**: `- [ ] Production SLA agreement (ready)``

- **Line 78** `[HARD_FORBIDDEN]`
  > `- **Line 186**: `**FirstTry is enterprise-ready** with proven capabilities across:``

- **Line 82** `[SLA_UNQUALIFIED]`
  > `- **Line 328**: `- [ ] Enterprise SLA tracking``

- **Line 83** `[HARD_FORBIDDEN]`
  > `- **Line 334**: `**FirstTry is now enterprise-ready** with comprehensive validation across:``

- **Line 87** `[HARD_FORBIDDEN]`
  > `- **Line 89**: `**Status:** Enterprise-ready with optional LocalStack setup for development``

- **Line 91** `[HARD_FORBIDDEN]`
  > `- **Line 175**: `| Portability | Requires build | ✓ Always available |``

- **Line 95** `[SLA_UNQUALIFIED]`
  > `- **Line 52**: `- ✅ docs/SECURITY_CONTACT.md (contact, SLA commitments)``

- **Line 99** `[HARD_FORBIDDEN]`
  > `- **Line 13**: `**OVERALL READINESS: 82/100 (ENTERPRISE-READY WITH CAVEATS)**``

- **Line 103** `[SLA_UNQUALIFIED]`
  > `- **Line 286**: `│   ├── legal/ (privacy, terms, data-handling, SLA)``

- **Line 107** `[HARD_FORBIDDEN]`
  > `- **Line 12**: `- ✅ Deterministic CI setup (Node 20 guaranteed before npm test)``

- **Line 111** `[HARD_FORBIDDEN]`
  > `- **Line 14**: `- Overall score: 82/100 (Enterprise-ready with caveats)``

- **Line 115** `[HARD_FORBIDDEN]`
  > `- **Line 110**: `Determinism: GUARANTEED ✅``

- **Line 116** `[HARD_FORBIDDEN]`
  > `- **Line 133**: `Certification: DETERMINISM GUARANTEED ✅``

- **Line 117** `[HARD_FORBIDDEN]`
  > `- **Line 251**: `- **Status**: DETERMINISM GUARANTEED ✅``

- **Line 121** `[HARD_FORBIDDEN]`
  > `- **Line 264**: `**Status**: Ready for marketplace submission with guaranteed integrity verificat...`

- **Line 125** `[HARD_FORBIDDEN]`
  > `- **Line 55**: `- Data integrity guaranteed in all scenarios``

- **Line 129** `[HARD_FORBIDDEN]`
  > `- **Line 175**: `| Backward Compatibility | Guaranteed ✅ |``

- **Line 133** `[HARD_FORBIDDEN]`
  > `- **Line 333**: `- ✅ Backward compatibility guaranteed``

- **Line 137** `[HARD_FORBIDDEN]`
  > `- **Line 445**: `- ✅ Backward compatibility guaranteed``

- **Line 141** `[HARD_FORBIDDEN]`
  > `- **Line 86**: `- Ungated guarantees table (truth, evidence, verification always available)``

- **Line 141** `[HARD_FORBIDDEN]`
  > `- **Line 86**: `- Ungated guarantees table (truth, evidence, verification always available)``

- **Line 145** `[HARD_FORBIDDEN]`
  > `- **Line 5**: `**Phase P7: Entitlements & Usage Metering** provides enterprise-ready SaaS monetiz...`

- **Line 146** `[HARD_FORBIDDEN]`
  > `- **Line 176**: `- Ungated guarantees table (truth, evidence, verification always available)``

- **Line 146** `[HARD_FORBIDDEN]`
  > `- **Line 176**: `- Ungated guarantees table (truth, evidence, verification always available)``

- **Line 150** `[HARD_FORBIDDEN]`
  > `- **Line 7**: `Enterprise-ready SaaS entitlements system that enables monetization through tiered...`

- **Line 154** `[HARD_FORBIDDEN]`
  > `- **Line 99**: `**Guaranteed artifact creation:**``

- **Line 158** `[HARD_FORBIDDEN]`
  > `- **Line 399**: `FirstTry is now **fully enterprise-ready** with:``

- **Line 162** `[HARD_FORBIDDEN]`
  > `- **Line 207**: `- Phase-5 scheduler is earliest guaranteed point where cloudId is available``

- **Line 166** `[HARD_FORBIDDEN]`
  > `- **Line 418**: `4. **90-Day TTL (Forge Default):** Bounded storage guaranteed; no indefinite ret...`

- **Line 170** `[HARD_FORBIDDEN]`
  > `- **Line 242**: `- [x] Immutability guaranteed``

- **Line 174** `[HARD_FORBIDDEN]`
  > `- **Line 88**: `- **Availability:** ALWAYS AVAILABLE (even if no missing data)``

- **Line 175** `[HARD_FORBIDDEN]`
  > `- **Line 205**: `5. M5 is ALWAYS AVAILABLE (no critical dependencies)``

- **Line 179** `[HARD_FORBIDDEN]`
  > `- **Line 19**: `- ✅ Canonical SHA-256 hashing (reproducibility guaranteed)``

- **Line 180** `[HARD_FORBIDDEN]`
  > `- **Line 119**: `| **M5** | Missing datasets | Expected datasets | ALWAYS AVAILABLE | ✅ |``

- **Line 181** `[HARD_FORBIDDEN]`
  > `- **Line 128**: `M5: ALWAYS AVAILABLE (tracks missing data itself)    ✅ Implemented``

- **Line 185** `[HARD_FORBIDDEN]`
  > `- **Line 15**: `| **M5** | Visibility Gap Over Time | missing_datasets / expected_datasets | ALWA...`

- **Line 186** `[HARD_FORBIDDEN]`
  > `- **Line 65**: `| M5 | N/A | Always available |``

- **Line 190** `[SLA_UNQUALIFIED]`
  > `- **Line 131**: `| **9.5-C** | Snapshot Reliability SLA | 54/54 | ✅ |``

- **Line 191** `[SLA_UNQUALIFIED]`
  > `- **Line 144**: `├── 9.5-C: Snapshot Reliability SLA``

- **Line 195** `[HARD_FORBIDDEN]`
  > `- **Line 118**: `- ✅ TC-9.5-E-10: Determinism guaranteed (2 tests)``

- **Line 199** `[HARD_FORBIDDEN]`
  > `- **Line 191**: `| **TC-9.5-E-5:** No Jira Writes ⭐ | 3 | **CRITICAL: Zero mutations guaranteed** |``

- **Line 200** `[HARD_FORBIDDEN]`
  > `- **Line 344**: `| **9.5-E** | Auto-repair disclosure | Self-recovery events | ✅ (guaranteed) |``

- **Line 204** `[SLA_UNQUALIFIED]`
  > `- **Line 443**: `**Phase 9.5-C: Snapshot Reliability SLA** (54/54 tests)``

- **Line 208** `[SLA_UNQUALIFIED]`
  > `- **Line 263**: `├── Phase 9.5-C: Snapshot Reliability SLA (54 tests)``

- **Line 212** `[SLA_UNQUALIFIED]`
  > `- **Line 234**: `| **9.5-C: Snapshot Reliability SLA** | 54 | ✅ PASS |``

- **Line 216** `[HARD_FORBIDDEN]`
  > `- **Line 439**: `| Determinism guaranteed | ✅ | TC-9.5-F-11 tests |``

- **Line 220** `[SLA_UNQUALIFIED]`
  > `- **Line 93**: `├─ 9.5-C: Snapshot Reliability SLA (54/54 tests)``

- **Line 224** `[SLA_UNQUALIFIED]`
  > `- **Line 55**: `- **[legal/service-level-agreement.md](legal/service-level-agreement.md)** — SLA ...`

- **Line 229** `[HARD_FORBIDDEN]`
  > `- **Line 268**: `| **Security** | ✅ Enterprise-ready |``

- **Line 233** `[HARD_FORBIDDEN]`
  > `- **Line 367**: `- **hasMore() conservative:** Only true if more pages guaranteed``

- **Line 237** `[HARD_FORBIDDEN]`
  > `- **Line 129**: `- hasMore() logic: Conservative (only true if more guaranteed)``

- **Line 241** `[HARD_FORBIDDEN]`
  > `- **Line 75**: `- Conservative hasMore() logic: Only return true if more pages GUARANTEED``

- **Line 242** `[HARD_FORBIDDEN]`
  > `- **Line 158**: `- Scope validation (read-only guaranteed)``

- **Line 246** `[SLA_UNQUALIFIED]`
  > `- **Line 70**: `**Best For**: Performance tuning, SLA verification, capacity planning``

- **Line 250** `[HARD_FORBIDDEN]`
  > `- **Line 188**: `// With frozen time, deterministic behavior guaranteed``

- **Line 251** `[HARD_FORBIDDEN]`
  > `- **Line 1251**: `✅ **Determinism guaranteed**``

- **Line 255** `[HARD_FORBIDDEN]`
  > `- **Line 23**: `| **TOTAL** | **9 Domains** | **46** | **✅ 100%** | **Enterprise-Ready** |``

- **Line 257** `[HARD_FORBIDDEN]`
  > `- **Line 67**: `| SHK-012 | Pipeline order | ✅ | LOAD→FETCH→EVAL→LOG guaranteed |``

- **Line 258** `[HARD_FORBIDDEN]`
  > `- **Line 71**: `- **Auditability**: Guaranteed step order ensures traceability``

- **Line 259** `[HARD_FORBIDDEN]`
  > `- **Line 362**: `✅ **Deterministic behavior guaranteed**``

- **Line 263** `[HARD_FORBIDDEN]`
  > `- **Line 135**: `- Status: GUARANTEED ✅``

- **Line 264** `[SLA_UNQUALIFIED]`
  > `- **Line 212**: `2. Reference determinism verification in SLA docs``

- **Line 268** `[HARD_FORBIDDEN]`
  > `- **Line 21**: `- **Determinism**: Guaranteed (10/10 runs identical)``

- **Line 269** `[SLA_UNQUALIFIED]`
  > `- **Line 80**: `**Use Case**: Performance tuning, capacity planning, SLA verification``

- **Line 270** `[HARD_FORBIDDEN]`
  > `- **Line 238**: `Determinism: GUARANTEED``

- **Line 271** `[HARD_FORBIDDEN]`
  > `- **Line 259**: `- **Status**: ✅ Determinism guaranteed``

- **Line 276** `[SLA_UNQUALIFIED]`
  > `- **Line 82**: `echo "ERROR: Unsupported certification/SLA claims found"``

- **Line 284** `[HARD_FORBIDDEN]`
  > `- **Line 385**: `- [x] Immutability guaranteed``

- **Line 288** `[SLA_UNQUALIFIED]`
  > `- **Line 202**: `| Phase 9.5-C | Snapshot Reliability SLA (IS FirstTry's snapshot capability reli...`

- **Line 292** `[SLA_UNQUALIFIED]`
  > `- **Line 5**: `Phase 9.5-C: Snapshot Reliability SLA has been fully implemented and tested. This ...`

- **Line 293** `[SLA_UNQUALIFIED]`
  > `- **Line 406**: `- **Phase 9.5-C:** Snapshot Reliability SLA ← **YOU ARE HERE**``

- **Line 297** `[SLA_UNQUALIFIED]`
  > `- **Line 61**: `| **30-day** | Monthly trend | SLA assessment |``

- **Line 301** `[SLA_UNQUALIFIED]`
  > `- **Line 318**: `| 9.5-C | Snapshot Reliability SLA | 54 | ✅ |``

- **Line 302** `[SLA_UNQUALIFIED]`
  > `- **Line 456**: `> "SLA requirement: X days of evidence. Status: MET/NOT MET"``

- **Line 303** `[SLA_UNQUALIFIED]`
  > `- **Line 478**: `2. Add to SLA contracts``

- **Line 307** `[SLA_UNQUALIFIED]`
  > `- **Line 227**: `- SLA dashboards: Duration and percentage metrics``

- **Line 308** `[SLA_UNQUALIFIED]`
  > `- **Line 373**: `| 9.5-C | Snapshot reliability SLA | Provides `first_snapshot_at` |``

- **Line 312** `[SLA_UNQUALIFIED]`
  > `- **Line 16**: `3. **Phase 9.5-C:** Snapshot Reliability SLA (Is FirstTry reliable?)``

- **Line 313** `[SLA_UNQUALIFIED]`
  > `- **Line 60**: `- SLA compliance tracking``

- **Line 314** `[SLA_UNQUALIFIED]`
  > `- **Line 113**: `├─→ SLA Dashboards (Metrics and trends)``

- **Line 315** `[SLA_UNQUALIFIED]`
  > `- **Line 128**: `| **If** FirstTry is reliable | Phase 9.5-C | Snapshot SLA |``

- **Line 316** `[SLA_UNQUALIFIED]`
  > `- **Line 318**: `> "SLA metrics are tracked, blind spots are identified, and audit readiness is m...`

- **Line 324** `[SLA_UNQUALIFIED]`
  > `- **Line 70**: `- None explicit, but lack of SLA may be flagged by reviewers expecting contact ho...`

- **Line 329** `[SLA_UNQUALIFIED]`
  > `- **Line 545**: `- [PHASE_9_5C_SPEC.md](PHASE_9_5C_SPEC.md) - Snapshot Reliability SLA``

- **Line 333** `[SLA_UNQUALIFIED]`
  > `- **Line 477**: `- **Phase 9.5-C:** Snapshot Reliability SLA (is FirstTry's snapshot capability r...`

- **Line 337** `[SLA_UNQUALIFIED]`
  > `- **Line 602**: `- **Phase 9.5-C:** Snapshot Reliability SLA (is FirstTry itself reliable?)``

- **Line 341** `[SLA_UNQUALIFIED]`
  > `- **Line 139**: `- No "SLA met/missed" judgment``

- **Line 345** `[SLA_UNQUALIFIED]`
  > `- **Line 206**: `3. **SLA Dashboard** - Metrics integration``

- **Line 346** `[HARD_FORBIDDEN]`
  > `- **Line 219**: `4. Current time (always available)``

- **Line 351** `[SLA_UNQUALIFIED]`
  > `- **Line 144**: `4. **SLA Dashboards**``

- **Line 352** `[SLA_UNQUALIFIED]`
  > `- **Line 370**: `| **9.5-C** | Snapshot Reliability SLA | Provides `first_snapshot_at` |``

- **Line 356** `[SLA_UNQUALIFIED]`
  > `- **Line 257**: `- Platform availability (no published SLA for Forge)``

- **Line 357** `[SLA_UNQUALIFIED]`
  > `- **Line 267**: `- **Forge SLA**: No published SLA for Forge platform availability``

- **Line 358** `[SLA_UNQUALIFIED]`
  > `- **Line 358**: `- No published Forge SLA``

- **Line 366** `[SLA_UNQUALIFIED]`
  > `- **Line 62**: `**IMPORTANT**: This app provides **NO SERVICE LEVEL AGREEMENT (SLA)**.``

- **Line 370** `[SLA_UNQUALIFIED]`
  > `- **Line 44**: `For urgent issues not resolved within SLA:``

- **Line 374** `[SLA_UNQUALIFIED]`
  > `- **Line 159**: `"method": "Verify docs/ contains support contact; verify not fake; verify no imp...`

- **Line 375** `[SLA_UNQUALIFIED]`
  > `- **Line 161**: `"expected_pass_condition": "Real contact info; no unqualified SLA promises",``

- **Line 379** `[HARD_FORBIDDEN]`
  > `- **Line 33**: `"guaranteed uptime",``

- **Line 383** `[HARD_FORBIDDEN]`
  > `- **Line 187**: `"description": "Scan reports for prohibited terms: compliant, secure, safe, guar...`

- **Line 387** `[HARD_FORBIDDEN]`
  > `- **Line 204**: `✅ **PASS** (8+ assertions) — Production key builder verified, tenant isolation g...`

- **Line 388** `[HARD_FORBIDDEN]`
  > `- **Line 499**: `Determinism: GUARANTEED ✅``

- **Line 389** `[HARD_FORBIDDEN]`
  > `- **Line 583**: `║  ✅ Idempotency guaranteed across retries                    ║``

- **Line 393** `[SLA_UNQUALIFIED]`
  > `- **Line 6**: `- Phase 8 discovered 8 risk findings including 3 CRITICAL SLA-related issues``

- **Line 394** `[HARD_FORBIDDEN]`
  > `- **Line 9**: `- Auto-editing was necessary to achieve SLA/guarantee consistency across corpus``

- **Line 394** `[SLA_UNQUALIFIED]`
  > `- **Line 9**: `- Auto-editing was necessary to achieve SLA/guarantee consistency across corpus``

- **Line 395** `[HARD_FORBIDDEN]`
  > `- **Line 26**: `All edits to PRIVACY and SECURITY files were necessary to remove unqualified SLA/...`

- **Line 395** `[SLA_UNQUALIFIED]`
  > `- **Line 26**: `All edits to PRIVACY and SECURITY files were necessary to remove unqualified SLA/...`

- **Line 400** `[SLA_UNQUALIFIED]`
  > `- **Line 337**: `- [SUPPORT_POLICY.md](SUPPORT_POLICY.md) — Support contact & SLA``

- **Line 405** `[SLA_UNQUALIFIED]`
  > `- **Line 62**: `- Red flag detected: SLA document exists``

- **Line 406** `[SLA_UNQUALIFIED]`
  > `- **Line 74**: `- 3 CRITICAL (auto-escalation, SLA document, SLA link)``

- **Line 407** `[SLA_UNQUALIFIED]`
  > `- **Line 97**: `- All P0 docs now have NO-SLA language``

- **Line 408** `[SLA_UNQUALIFIED]`
  > `- **Line 112**: `4. `docs/SUPPORT.md` → Add NO-SLA header + fix link text (SLAs → Model)``

- **Line 409** `[SLA_UNQUALIFIED]`
  > `- **Line 114**: `6. `docs/SUPPORT_POLICY.md` → Standardize NO-SLA language``

- **Line 410** `[SLA_UNQUALIFIED]`
  > `- **Line 141**: `| SLA link reference | docs/SUPPORT.md:211 | Link text changed (SLAs → Model) | ...`

- **Line 411** `[SLA_UNQUALIFIED]`
  > `- **Line 147**: `| PRIVACY.md SLA ambiguity | Missing disclaimer | Added SLA section | ✅ FIXED |``

- **Line 412** `[SLA_UNQUALIFIED]`
  > `- **Line 149**: `| SUPPORT.md NO-SLA header | Inconsistent | Prominent header added | ✅ FIXED |``

- **Line 413** `[SLA_UNQUALIFIED]`
  > `- **Line 161**: `- **Verification**: Searched 2,778 files for unqualified SLA claims``

- **Line 414** `[SLA_UNQUALIFIED]`
  > `- **Line 163**: `- All SLA language is explicitly qualified with "NO" or "DOES NOT"``

- **Line 415** `[HARD_FORBIDDEN]`
  > `- **Line 168**: `- Searched for "mission-critical" → NOT FOUND``

- **Line 416** `[HARD_FORBIDDEN]`
  > `- **Line 176**: `- Searched for "enterprise-ready" → NOT FOUND``

- **Line 417** `[SLA_UNQUALIFIED]`
  > `- **Line 178**: `- No phone/email/SLA support promised``

- **Line 418** `[SLA_UNQUALIFIED]`
  > `- **Line 243**: `1. Maintain NO-SLA language consistency``

- **Line 419** `[HARD_FORBIDDEN]`
  > `- **Line 260**: `> - No uptime guarantees``

- **Line 420** `[SLA_UNQUALIFIED]`
  > `- **Line 263**: `> The only legal SLA document (`docs/legal/service-level-agreement.md`) is expli...`

- **Line 421** `[SLA_UNQUALIFIED]`
  > `- **Line 294**: `- Zero unqualified SLA claims``

- **Line 422** `[HARD_FORBIDDEN]`
  > `- **Line 295**: `- Zero unqualified uptime guarantees``

- **Line 426** `[HARD_FORBIDDEN]`
  > `- **Line 58**: `Firsttry provides NO SERVICE LEVEL AGREEMENT or uptime guarantees.``

- **Line 428** `[HARD_FORBIDDEN]`
  > `- **Line 109**: `- [ ] No uptime guarantees``

- **Line 429** `[SLA_UNQUALIFIED]`
  > `- **Line 131**: `1. docs/PRIVACY.md — Add SLA/support disclaimer``

- **Line 430** `[SLA_UNQUALIFIED]`
  > `- **Line 133**: `3. docs/SUPPORT.md — Add NO-SLA header, change link text``

- **Line 431** `[SLA_UNQUALIFIED]`
  > `- **Line 137**: `5. docs/SUPPORT_POLICY.md — Standardize NO-SLA language``

- **Line 435** `[SLA_UNQUALIFIED]`
  > `- **Line 33**: `FirstTry provides NO SERVICE LEVEL AGREEMENT (SLA) for privacy or data handling.``

- **Line 436** `[HARD_FORBIDDEN]`
  > `- **Line 59**: `and does not constitute a legal SLA or support guarantee. See disclaimers below.``

- **Line 437** `[SLA_UNQUALIFIED]`
  > `- **Line 66**: `**Line**: Insert at top (before current "# Service Level Agreement (SLA)")``

- **Line 438** `[HARD_FORBIDDEN]`
  > `- **Line 80**: `uptime guarantees.``

- **Line 439** `[SLA_UNQUALIFIED]`
  > `- **Line 151**: `4. 🔧 docs/SUPPORT.md (add NO-SLA header + fix link)``

- **Line 440** `[SLA_UNQUALIFIED]`
  > `- **Line 153**: `6. 🔧 docs/SUPPORT_POLICY.md (standardize NO-SLA language)``

- **Line 441** `[SLA_UNQUALIFIED]`
  > `- **Line 160**: `**Scope**: Limited to support/SLA-related sections``

- **Line 442** `[HARD_FORBIDDEN]`
  > `- **Line 171**: `- Verify no new SLA/guarantee claims introduced``

- **Line 442** `[SLA_UNQUALIFIED]`
  > `- **Line 171**: `- Verify no new SLA/guarantee claims introduced``

- **Line 443** `[SLA_UNQUALIFIED]`
  > `- **Line 182**: `| docs/SUPPORT.md | Add + Modify | 1-5, 211 | Add NO-SLA header, fix link text |``

- **Line 444** `[SLA_UNQUALIFIED]`
  > `- **Line 184**: `| docs/SUPPORT_POLICY.md | Add | 1-5 | Add NO-SLA header |``

- **Line 448** `[SLA_UNQUALIFIED]`
  > `- **Line 59**: `- If SLA document exists, does it contain:``

- **Line 449** `[HARD_FORBIDDEN]`
  > `- **Line 60**: `- Uptime guarantees?``

- **Line 450** `[SLA_UNQUALIFIED]`
  > `- **Line 74**: `| ./docs/legal/ | 6 | Legal/SLA |``

- **Line 454** `[HARD_FORBIDDEN]`
  > `- **Line 7**: `**Risk Categories**: SLA/Guarantee, Auto-Escalation, SEV Levels, Promise Language``

- **Line 454** `[SLA_UNQUALIFIED]`
  > `- **Line 7**: `**Risk Categories**: SLA/Guarantee, Auto-Escalation, SEV Levels, Promise Language``

- **Line 455** `[SLA_UNQUALIFIED]`
  > `- **Line 17**: `| docs/SUPPORT.md | P0 | Marketplace, Enterprise | Public support policy, SLA ref...`

- **Line 456** `[SLA_UNQUALIFIED]`
  > `- **Line 21**: `| docs/RELIABILITY.md | P0 | Enterprise + Marketplace | SLA/uptime positioning |``

- **Line 458** `[SLA_UNQUALIFIED]`
  > `- **Line 74**: `- Line 1: "# Service Level Agreement (SLA)" — Document title``

- **Line 459** `[SLA_UNQUALIFIED]`
  > `- **Line 78**: `- Line 38: "This SLA does not apply to..."``

- **Line 461** `[SLA_UNQUALIFIED]`
  > `- **Line 84**: `**Fix**: DOWNGRADE — Add explicit disclaimer on Line 1-5: "This is NOT a legal SL...`

- **Line 462** `[SLA_UNQUALIFIED]`
  > `- **Line 94**: `**Risk**: References "Reliability SLAs" in link text → implies SLA exists``

- **Line 463** `[SLA_UNQUALIFIED]`
  > `- **Line 105**: `**Risk**: Defines SEV1 severity levels → implies structured SLA response``

- **Line 464** `[SLA_UNQUALIFIED]`
  > `- **Line 107**: `**Fix**: DOWNGRADE — Replace "SEV1" with "critical issue" (remove formal SLA ter...`

- **Line 465** `[SLA_UNQUALIFIED]`
  > `- **Line 118**: `- atlassian/forge-app/docs/SUPPORT.md:62 → "NO SERVICE LEVEL AGREEMENT (SLA)"``

- **Line 468** `[SLA_UNQUALIFIED]`
  > `- **Line 183**: `3. **SLA link reference** (docs/SUPPORT.md:211)``

- **Line 469** `[HARD_FORBIDDEN]`
  > `- **Line 209**: `- "No uptime guarantees"``

- **Line 473** `[SLA_UNQUALIFIED]`
  > `- **Line 17**: `- SLA-backed uptime``

- **Line 477** `[HARD_FORBIDDEN]`
  > `- **Line 47**: `These are ALWAYS available to all tenants regardless of plan:``

- **Line 481** `[SLA_UNQUALIFIED]`
  > `- **Line 29**: `- **SLA**: [TO BE DOCUMENTED]``

- **Line 482** `[SLA_UNQUALIFIED]`
  > `- **Line 38**: `- **SLA**: [TO BE DOCUMENTED]``

- **Line 483** `[SLA_UNQUALIFIED]`
  > `- **Line 47**: `- **SLA**: [TO BE DOCUMENTED]``

- **Line 484** `[SLA_UNQUALIFIED]`
  > `- **Line 56**: `- **SLA**: [TO BE DOCUMENTED]``

- **Line 485** `[SLA_UNQUALIFIED]`
  > `- **Line 87**: `- **SLA**: [99.9% uptime / Best effort / None]``

- **Line 486** `[SLA_UNQUALIFIED]`
  > `- **Line 125**: `- [ ] Product Manager (SLA agreement)``

- **Line 490** `[HARD_FORBIDDEN]`
  > `- **Line 198**: `- **SLA guarantees**: No response time commitments``

- **Line 490** `[SLA_UNQUALIFIED]`
  > `- **Line 198**: `- **SLA guarantees**: No response time commitments``

- **Line 494** `[SLA_UNQUALIFIED]`
  > `- **Line 22**: `- **Line 124**: `| Legal coverage | ✅ | `docs/legal/{privacy,terms,data,sla}.md` |```

- **Line 495** `[SLA_UNQUALIFIED]`
  > `- **Line 24**: `- **Line 175**: `- ✅ Complete legal documentation (privacy, terms, data handling,...`

- **Line 496** `[SLA_UNQUALIFIED]`
  > `- **Line 28**: `- **Line 17**: `✗ SLA tiers, contact verification missing```

- **Line 497** `[SLA_UNQUALIFIED]`
  > `- **Line 29**: `- **Line 143**: `- SLA Tiers (4h)```

- **Line 498** `[SLA_UNQUALIFIED]`
  > `- **Line 30**: `- **Line 276**: `[ ] Add SLA tiers to SECURITY.md```

- **Line 499** `[HARD_FORBIDDEN]`
  > `- **Line 34**: `- **Line 246**: `| Enterprise-ready tier | pro+full (7.4% variance, 61% cache imp...`

- **Line 501** `[SLA_UNQUALIFIED]`
  > `- **Line 50**: `- **Line 48**: `- ✅ `docs/legal/service-level-agreement.md` — SLA expectations do...`

- **Line 502** `[SLA_UNQUALIFIED]`
  > `- **Line 51**: `- **Line 87**: `- **Evidence**: Privacy Policy, ToS, Data Handling, SLA all prese...`

- **Line 503** `[SLA_UNQUALIFIED]`
  > `- **Line 53**: `- **Line 217**: `| Legal coverage | ✅ | `docs/legal/{privacy,terms,data,sla}.md` |```

- **Line 504** `[SLA_UNQUALIFIED]`
  > `- **Line 63**: `- **Line 104**: `- Include: URL patterns, authentication method, data sensitivity...`

- **Line 506** `[SLA_UNQUALIFIED]`
  > `- **Line 73**: `- **Line 101**: `- Specify: URL patterns, auth method, data sensitivity, SLA```

- **Line 507** `[SLA_UNQUALIFIED]`
  > `- **Line 77**: `- **Line 210**: `- Service SLA / reliability requirements```

- **Line 508** `[SLA_UNQUALIFIED]`
  > `- **Line 90**: `- **Line 215**: `- SLA Tiers (4h)```

- **Line 509** `[SLA_UNQUALIFIED]`
  > `- **Line 98**: `- **Line 14**: `- **Critical Files**: Exist (privacy-policy, terms-of-service, da...`

- **Line 511** `[SLA_UNQUALIFIED]`
  > `- **Line 100**: `- **Line 90**: `- SLA: `docs/legal/service-level-agreement.md````

- **Line 512** `[HARD_FORBIDDEN]`
  > `- **Line 113**: `- **Line 102**: `├── Final Verdict (ENTERPRISE-READY WITH CONDITIONS)```

- **Line 513** `[HARD_FORBIDDEN]`
  > `- **Line 122**: `- **Line 100**: `- No unverifiable promises ("guaranteed," "promised," etc.)```

- **Line 514** `[SLA_UNQUALIFIED]`
  > `- **Line 127**: `- **Line 180**: `- [ ] Production SLA agreement (ready)```

- **Line 515** `[HARD_FORBIDDEN]`
  > `- **Line 128**: `- **Line 186**: `**FirstTry is enterprise-ready** with proven capabilities acros...`

- **Line 516** `[SLA_UNQUALIFIED]`
  > `- **Line 132**: `- **Line 328**: `- [ ] Enterprise SLA tracking```

- **Line 517** `[HARD_FORBIDDEN]`
  > `- **Line 133**: `- **Line 334**: `**FirstTry is now enterprise-ready** with comprehensive validat...`

- **Line 518** `[HARD_FORBIDDEN]`
  > `- **Line 137**: `- **Line 89**: `**Status:** Enterprise-ready with optional LocalStack setup for ...`

- **Line 519** `[HARD_FORBIDDEN]`
  > `- **Line 141**: `- **Line 175**: `| Portability | Requires build | ✓ Always available |```

- **Line 520** `[SLA_UNQUALIFIED]`
  > `- **Line 152**: `- **Line 52**: `- ✅ docs/SECURITY_CONTACT.md (contact, SLA commitments)```

- **Line 521** `[HARD_FORBIDDEN]`
  > `- **Line 156**: `- **Line 13**: `**OVERALL READINESS: 82/100 (ENTERPRISE-READY WITH CAVEATS)**```

- **Line 522** `[SLA_UNQUALIFIED]`
  > `- **Line 160**: `- **Line 286**: `│   ├── legal/ (privacy, terms, data-handling, SLA)```

- **Line 523** `[HARD_FORBIDDEN]`
  > `- **Line 164**: `- **Line 12**: `- ✅ Deterministic CI setup (Node 20 guaranteed before npm test)```

- **Line 524** `[HARD_FORBIDDEN]`
  > `- **Line 169**: `- **Line 14**: `- Overall score: 82/100 (Enterprise-ready with caveats)```

- **Line 525** `[HARD_FORBIDDEN]`
  > `- **Line 173**: `- **Line 110**: `Determinism: GUARANTEED ✅```

- **Line 526** `[HARD_FORBIDDEN]`
  > `- **Line 174**: `- **Line 133**: `Certification: DETERMINISM GUARANTEED ✅```

- **Line 527** `[HARD_FORBIDDEN]`
  > `- **Line 175**: `- **Line 251**: `- **Status**: DETERMINISM GUARANTEED ✅```

- **Line 528** `[HARD_FORBIDDEN]`
  > `- **Line 179**: `- **Line 264**: `**Status**: Ready for marketplace submission with guaranteed in...`

- **Line 529** `[HARD_FORBIDDEN]`
  > `- **Line 183**: `- **Line 55**: `- Data integrity guaranteed in all scenarios```

- **Line 530** `[HARD_FORBIDDEN]`
  > `- **Line 193**: `- **Line 175**: `| Backward Compatibility | Guaranteed ✅ |```

- **Line 531** `[HARD_FORBIDDEN]`
  > `- **Line 197**: `- **Line 333**: `- ✅ Backward compatibility guaranteed```

- **Line 532** `[HARD_FORBIDDEN]`
  > `- **Line 201**: `- **Line 445**: `- ✅ Backward compatibility guaranteed```

- **Line 533** `[HARD_FORBIDDEN]`
  > `- **Line 206**: `- **Line 86**: `- Ungated guarantees table (truth, evidence, verification always...`

- **Line 533** `[HARD_FORBIDDEN]`
  > `- **Line 206**: `- **Line 86**: `- Ungated guarantees table (truth, evidence, verification always...`

- **Line 534** `[HARD_FORBIDDEN]`
  > `- **Line 214**: `- **Line 5**: `**Phase P7: Entitlements & Usage Metering** provides enterprise-r...`

- **Line 535** `[HARD_FORBIDDEN]`
  > `- **Line 218**: `- **Line 176**: `- Ungated guarantees table (truth, evidence, verification alway...`

- **Line 535** `[HARD_FORBIDDEN]`
  > `- **Line 218**: `- **Line 176**: `- Ungated guarantees table (truth, evidence, verification alway...`

- **Line 536** `[HARD_FORBIDDEN]`
  > `- **Line 223**: `- **Line 7**: `Enterprise-ready SaaS entitlements system that enables monetizati...`

- **Line 537** `[HARD_FORBIDDEN]`
  > `- **Line 234**: `- **Line 99**: `**Guaranteed artifact creation:**```

- **Line 538** `[HARD_FORBIDDEN]`
  > `- **Line 238**: `- **Line 399**: `FirstTry is now **fully enterprise-ready** with:```

- **Line 539** `[HARD_FORBIDDEN]`
  > `- **Line 242**: `- **Line 207**: `- Phase-5 scheduler is earliest guaranteed point where cloudId ...`

- **Line 540** `[HARD_FORBIDDEN]`
  > `- **Line 251**: `- **Line 418**: `4. **90-Day TTL (Forge Default):** Bounded storage guaranteed; ...`

- **Line 541** `[HARD_FORBIDDEN]`
  > `- **Line 279**: `- **Line 242**: `- [x] Immutability guaranteed```

- **Line 542** `[HARD_FORBIDDEN]`
  > `- **Line 301**: `- **Line 88**: `- **Availability:** ALWAYS AVAILABLE (even if no missing data)```

- **Line 543** `[HARD_FORBIDDEN]`
  > `- **Line 302**: `- **Line 205**: `5. M5 is ALWAYS AVAILABLE (no critical dependencies)```

- **Line 544** `[HARD_FORBIDDEN]`
  > `- **Line 306**: `- **Line 19**: `- ✅ Canonical SHA-256 hashing (reproducibility guaranteed)```

- **Line 545** `[HARD_FORBIDDEN]`
  > `- **Line 307**: `- **Line 119**: `| **M5** | Missing datasets | Expected datasets | ALWAYS AVAILA...`

- **Line 546** `[HARD_FORBIDDEN]`
  > `- **Line 308**: `- **Line 128**: `M5: ALWAYS AVAILABLE (tracks missing data itself)    ✅ Implemen...`

- **Line 548** `[HARD_FORBIDDEN]`
  > `- **Line 314**: `- **Line 65**: `| M5 | N/A | Always available |```

- **Line 549** `[SLA_UNQUALIFIED]`
  > `- **Line 319**: `- **Line 131**: `| **9.5-C** | Snapshot Reliability SLA | 54/54 | ✅ |```

- **Line 550** `[SLA_UNQUALIFIED]`
  > `- **Line 320**: `- **Line 144**: `├── 9.5-C: Snapshot Reliability SLA```

- **Line 551** `[HARD_FORBIDDEN]`
  > `- **Line 324**: `- **Line 118**: `- ✅ TC-9.5-E-10: Determinism guaranteed (2 tests)```

- **Line 552** `[HARD_FORBIDDEN]`
  > `- **Line 328**: `- **Line 191**: `| **TC-9.5-E-5:** No Jira Writes ⭐ | 3 | **CRITICAL: Zero mutat...`

- **Line 553** `[HARD_FORBIDDEN]`
  > `- **Line 329**: `- **Line 344**: `| **9.5-E** | Auto-repair disclosure | Self-recovery events | ✅...`

- **Line 554** `[SLA_UNQUALIFIED]`
  > `- **Line 333**: `- **Line 443**: `**Phase 9.5-C: Snapshot Reliability SLA** (54/54 tests)```

- **Line 555** `[SLA_UNQUALIFIED]`
  > `- **Line 337**: `- **Line 263**: `├── Phase 9.5-C: Snapshot Reliability SLA (54 tests)```

- **Line 556** `[SLA_UNQUALIFIED]`
  > `- **Line 344**: `- **Line 234**: `| **9.5-C: Snapshot Reliability SLA** | 54 | ✅ PASS |```

- **Line 557** `[HARD_FORBIDDEN]`
  > `- **Line 361**: `- **Line 439**: `| Determinism guaranteed | ✅ | TC-9.5-F-11 tests |```

- **Line 558** `[SLA_UNQUALIFIED]`
  > `- **Line 365**: `- **Line 93**: `├─ 9.5-C: Snapshot Reliability SLA (54/54 tests)```

- **Line 559** `[SLA_UNQUALIFIED]`
  > `- **Line 369**: `- **Line 55**: `- **[legal/service-level-agreement.md](legal/service-level-agree...`

- **Line 560** `[HARD_FORBIDDEN]`
  > `- **Line 375**: `- **Line 268**: `| **Security** | ✅ Enterprise-ready |```

- **Line 561** `[HARD_FORBIDDEN]`
  > `- **Line 385**: `- **Line 367**: `- **hasMore() conservative:** Only true if more pages guaranteed```

- **Line 562** `[HARD_FORBIDDEN]`
  > `- **Line 389**: `- **Line 129**: `- hasMore() logic: Conservative (only true if more guaranteed)```

- **Line 563** `[HARD_FORBIDDEN]`
  > `- **Line 396**: `- **Line 75**: `- Conservative hasMore() logic: Only return true if more pages G...`

- **Line 564** `[HARD_FORBIDDEN]`
  > `- **Line 398**: `- **Line 158**: `- Scope validation (read-only guaranteed)```

- **Line 565** `[SLA_UNQUALIFIED]`
  > `- **Line 407**: `- **Line 70**: `**Best For**: Performance tuning, SLA verification, capacity pla...`

- **Line 566** `[HARD_FORBIDDEN]`
  > `- **Line 417**: `- **Line 188**: `// With frozen time, deterministic behavior guaranteed```

- **Line 567** `[HARD_FORBIDDEN]`
  > `- **Line 418**: `- **Line 1251**: `✅ **Determinism guaranteed**```

- **Line 568** `[HARD_FORBIDDEN]`
  > `- **Line 422**: `- **Line 23**: `| **TOTAL** | **9 Domains** | **46** | **✅ 100%** | **Enterprise...`

- **Line 569** `[HARD_FORBIDDEN]`
  > `- **Line 424**: `- **Line 67**: `| SHK-012 | Pipeline order | ✅ | LOAD→FETCH→EVAL→LOG guaranteed |```

- **Line 570** `[HARD_FORBIDDEN]`
  > `- **Line 425**: `- **Line 71**: `- **Auditability**: Guaranteed step order ensures traceability```

- **Line 571** `[HARD_FORBIDDEN]`
  > `- **Line 426**: `- **Line 362**: `✅ **Deterministic behavior guaranteed**```

- **Line 572** `[HARD_FORBIDDEN]`
  > `- **Line 439**: `- **Line 135**: `- Status: GUARANTEED ✅```

- **Line 573** `[SLA_UNQUALIFIED]`
  > `- **Line 440**: `- **Line 212**: `2. Reference determinism verification in SLA docs```

- **Line 574** `[HARD_FORBIDDEN]`
  > `- **Line 444**: `- **Line 21**: `- **Determinism**: Guaranteed (10/10 runs identical)```

- **Line 575** `[SLA_UNQUALIFIED]`
  > `- **Line 445**: `- **Line 80**: `**Use Case**: Performance tuning, capacity planning, SLA verific...`

- **Line 576** `[HARD_FORBIDDEN]`
  > `- **Line 447**: `- **Line 238**: `Determinism: GUARANTEED```

- **Line 577** `[HARD_FORBIDDEN]`
  > `- **Line 448**: `- **Line 259**: `- **Status**: ✅ Determinism guaranteed```

- **Line 578** `[SLA_UNQUALIFIED]`
  > `- **Line 524**: `- **Line 82**: `echo "ERROR: Unsupported certification/SLA claims found"```

- **Line 580** `[HARD_FORBIDDEN]`
  > `- **Line 573**: `- **Line 385**: `- [x] Immutability guaranteed```

- **Line 581** `[SLA_UNQUALIFIED]`
  > `- **Line 597**: `- **Line 202**: `| Phase 9.5-C | Snapshot Reliability SLA (IS FirstTry's snapsho...`

- **Line 582** `[SLA_UNQUALIFIED]`
  > `- **Line 601**: `- **Line 5**: `Phase 9.5-C: Snapshot Reliability SLA has been fully implemented ...`

- **Line 583** `[SLA_UNQUALIFIED]`
  > `- **Line 604**: `- **Line 406**: `- **Phase 9.5-C:** Snapshot Reliability SLA ← **YOU ARE HERE**```

- **Line 584** `[SLA_UNQUALIFIED]`
  > `- **Line 608**: `- **Line 61**: `| **30-day** | Monthly trend | SLA assessment |```

- **Line 585** `[SLA_UNQUALIFIED]`
  > `- **Line 615**: `- **Line 318**: `| 9.5-C | Snapshot Reliability SLA | 54 | ✅ |```

- **Line 586** `[SLA_UNQUALIFIED]`
  > `- **Line 616**: `- **Line 456**: `> "SLA requirement: X days of evidence. Status: MET/NOT MET"```

- **Line 587** `[SLA_UNQUALIFIED]`
  > `- **Line 617**: `- **Line 478**: `2. Add to SLA contracts```

- **Line 588** `[SLA_UNQUALIFIED]`
  > `- **Line 621**: `- **Line 227**: `- SLA dashboards: Duration and percentage metrics```

- **Line 589** `[SLA_UNQUALIFIED]`
  > `- **Line 622**: `- **Line 373**: `| 9.5-C | Snapshot reliability SLA | Provides `first_snapshot_a...`

- **Line 590** `[SLA_UNQUALIFIED]`
  > `- **Line 626**: `- **Line 16**: `3. **Phase 9.5-C:** Snapshot Reliability SLA (Is FirstTry reliab...`

- **Line 591** `[SLA_UNQUALIFIED]`
  > `- **Line 627**: `- **Line 60**: `- SLA compliance tracking```

- **Line 592** `[SLA_UNQUALIFIED]`
  > `- **Line 628**: `- **Line 113**: `├─→ SLA Dashboards (Metrics and trends)```

- **Line 593** `[SLA_UNQUALIFIED]`
  > `- **Line 629**: `- **Line 128**: `| **If** FirstTry is reliable | Phase 9.5-C | Snapshot SLA |```

- **Line 594** `[SLA_UNQUALIFIED]`
  > `- **Line 630**: `- **Line 318**: `> "SLA metrics are tracked, blind spots are identified, and aud...`

- **Line 595** `[SLA_UNQUALIFIED]`
  > `- **Line 689**: `- **Line 265**: `**Response SLA**: 24 hours```

- **Line 596** `[HARD_FORBIDDEN]`
  > `- **Line 693**: `- **Line 112**: `// STEP 0: Report Bridge mode and invoke availability (both alw...`

- **Line 597** `[HARD_FORBIDDEN]`
  > `- **Line 697**: `- **Line 111**: `// STEP 0: Report Bridge mode and invoke availability (both alw...`

- **Line 598** `[HARD_FORBIDDEN]`
  > `- **Line 719**: `- **Line 2385**: `30	            # Guaranteed baseline tools (match what make ch...`

- **Line 599** `[SLA_UNQUALIFIED]`
  > `- **Line 765**: `- **Line 70**: `- None explicit, but lack of SLA may be flagged by reviewers exp...`

- **Line 600** `[SLA_UNQUALIFIED]`
  > `- **Line 818**: `- **Line 545**: `- [PHASE_9_5C_SPEC.md](PHASE_9_5C_SPEC.md) - Snapshot Reliabili...`

- **Line 601** `[SLA_UNQUALIFIED]`
  > `- **Line 822**: `- **Line 477**: `- **Phase 9.5-C:** Snapshot Reliability SLA (is FirstTry's snap...`

- **Line 602** `[SLA_UNQUALIFIED]`
  > `- **Line 827**: `- **Line 602**: `- **Phase 9.5-C:** Snapshot Reliability SLA (is FirstTry itself...`

- **Line 603** `[SLA_UNQUALIFIED]`
  > `- **Line 831**: `- **Line 139**: `- No "SLA met/missed" judgment```

- **Line 604** `[SLA_UNQUALIFIED]`
  > `- **Line 837**: `- **Line 206**: `3. **SLA Dashboard** - Metrics integration```

- **Line 605** `[HARD_FORBIDDEN]`
  > `- **Line 838**: `- **Line 219**: `4. Current time (always available)```

- **Line 606** `[SLA_UNQUALIFIED]`
  > `- **Line 843**: `- **Line 144**: `4. **SLA Dashboards**```

- **Line 607** `[SLA_UNQUALIFIED]`
  > `- **Line 844**: `- **Line 370**: `| **9.5-C** | Snapshot Reliability SLA | Provides `first_snapsh...`

- **Line 608** `[SLA_UNQUALIFIED]`
  > `- **Line 879**: `- **Line 257**: `- Platform availability (no published SLA for Forge)```

- **Line 609** `[SLA_UNQUALIFIED]`
  > `- **Line 880**: `- **Line 267**: `- **Forge SLA**: No published SLA for Forge platform availabili...`

- **Line 610** `[SLA_UNQUALIFIED]`
  > `- **Line 881**: `- **Line 358**: `- No published Forge SLA```

- **Line 612** `[SLA_UNQUALIFIED]`
  > `- **Line 917**: `- **Line 62**: `**IMPORTANT**: This app provides **NO SERVICE LEVEL AGREEMENT (S...`

- **Line 613** `[SLA_UNQUALIFIED]`
  > `- **Line 938**: `- **Line 44**: `For urgent issues not resolved within SLA:```

- **Line 615** `[SLA_UNQUALIFIED]`
  > `- **Line 952**: `- **Line 161**: `"expected_pass_condition": "Real contact info; no unqualified S...`

- **Line 616** `[HARD_FORBIDDEN]`
  > `- **Line 956**: `- **Line 33**: `"guaranteed uptime",```

- **Line 619** `[HARD_FORBIDDEN]`
  > `- **Line 973**: `- **Line 499**: `Determinism: GUARANTEED ✅```

- **Line 620** `[HARD_FORBIDDEN]`
  > `- **Line 974**: `- **Line 583**: `║  ✅ Idempotency guaranteed across retries                    ║```

- **Line 621** `[SLA_UNQUALIFIED]`
  > `- **Line 985**: `- **Line 135**: `| **ER-006** | No uptime SLA | [ENTERPRISE_READINESS.md](../doc...`

- **Line 623** `[SLA_UNQUALIFIED]`
  > `- **Line 999**: `- **Line 126**: `| **SLA Disputes** | Medium | Low | Clear "best effort only" in...`

- **Line 624** `[HARD_FORBIDDEN]`
  > `- **Line 1000**: `- **Line 145**: `| **Uptime guaranteed** | No. [ENTERPRISE_READINESS.md](../doc...`

- **Line 626** `[SLA_UNQUALIFIED]`
  > `- **Line 1006**: `- **Line 24**: `| **Atlassian Forge SLA uptime** | Atlassian does not publish S...`

- **Line 627** `[SLA_UNQUALIFIED]`
  > `- **Line 1007**: `- **Line 180**: `- Support SLA (Best effort; escalate to Atlassian if needed)```

- **Line 628** `[SLA_UNQUALIFIED]`
  > `- **Line 1009**: `- **Line 216**: `| **Per-workspace SLA** | Forge apps share infrastructure; no ...`

- **Line 629** `[HARD_FORBIDDEN]`
  > `- **Line 1015**: `- **Line 48**: `**Status**: DESIGN VERIFIED + PLATFORM GUARANTEED```

- **Line 630** `[HARD_FORBIDDEN]`
  > `- **Line 1017**: `- **Line 155**: `- ✅ No overclaims (SLA guarantees, SOC2/ISO certifications, Cl...`

- **Line 630** `[SLA_UNQUALIFIED]`
  > `- **Line 1017**: `- **Line 155**: `- ✅ No overclaims (SLA guarantees, SOC2/ISO certifications, Cl...`

- **Line 631** `[SLA_UNQUALIFIED]`
  > `- **Line 1018**: `- **Line 157**: `- ✅ "NO SERVICE LEVEL AGREEMENT (SLA)" explicitly stated in SU...`

- **Line 632** `[SLA_UNQUALIFIED]`
  > `- **Line 1019**: `- **Line 211**: `4. ✅ No overclaims (SLA, SOC2 certified, ISO certified, Cloud ...`

- **Line 633** `[SLA_UNQUALIFIED]`
  > `- **Line 1020**: `- **Line 342**: `5. Overclaim detection prevents unsupported SLA/certification ...`

- **Line 634** `[HARD_FORBIDDEN]`
  > `- **Line 1021**: `- **Line 354**: `- If someone adds "SLA guarantee", CI will fail```

- **Line 634** `[SLA_UNQUALIFIED]`
  > `- **Line 1021**: `- **Line 354**: `- If someone adds "SLA guarantee", CI will fail```

- **Line 635** `[SLA_UNQUALIFIED]`
  > `- **Line 1022**: `- **Line 415**: `- ✅ No overclaims (SLA/SOC2/ISO forbidden without proof)```

- **Line 636** `[SLA_UNQUALIFIED]`
  > `- **Line 1026**: `- **Line 77**: `- ❌ Overclaims (SLA/SOC2/ISO)```

- **Line 637** `[SLA_UNQUALIFIED]`
  > `- **Line 1030**: `- **Line 71**: `- Overclaims (SLA, SOC2, ISO)```

- **Line 638** `[HARD_FORBIDDEN]`
  > `- **Line 1031**: `- **Line 92**: `grep -rn "SLA guarantee\|SOC2 certified\|ISO certified" docs/```

- **Line 638** `[SLA_UNQUALIFIED]`
  > `- **Line 1031**: `- **Line 92**: `grep -rn "SLA guarantee\|SOC2 certified\|ISO certified" docs/```

- **Line 639** `[SLA_UNQUALIFIED]`
  > `- **Line 1032**: `- **Line 192**: `10. `verify-no-overclaims` - Grep for SLA/SOC2/ISO claims```

- **Line 640** `[SLA_UNQUALIFIED]`
  > `- **Line 1033**: `- **Line 238**: `4. Ensure no unsupported claims (SLA, SOC2, ISO unless proven)```

- **Line 641** `[HARD_FORBIDDEN]`
  > `- **Line 1037**: `- **Line 55**: `**Status**: **PLATFORM-GUARANTEED**```

- **Line 642** `[HARD_FORBIDDEN]`
  > `- **Line 1038**: `- **Line 198**: `| GAP-2 | Tenant Isolation | Platform Guaranteed | Storage des...`

- **Line 643** `[SLA_UNQUALIFIED]`
  > `- **Line 1042**: `- **Line 21067**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 644** `[SLA_UNQUALIFIED]`
  > `- **Line 1043**: `- **Line 21089**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 645** `[SLA_UNQUALIFIED]`
  > `- **Line 1044**: `- **Line 21111**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 646** `[SLA_UNQUALIFIED]`
  > `- **Line 1045**: `- **Line 21133**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 647** `[SLA_UNQUALIFIED]`
  > `- **Line 1046**: `- **Line 21155**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 648** `[SLA_UNQUALIFIED]`
  > `- **Line 1047**: `- **Line 21177**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 649** `[SLA_UNQUALIFIED]`
  > `- **Line 1048**: `- **Line 21199**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 650** `[SLA_UNQUALIFIED]`
  > `- **Line 1049**: `- **Line 21221**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 651** `[SLA_UNQUALIFIED]`
  > `- **Line 1050**: `- **Line 21243**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 652** `[SLA_UNQUALIFIED]`
  > `- **Line 1051**: `- **Line 21265**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 653** `[SLA_UNQUALIFIED]`
  > `- **Line 1052**: `- **Line 21287**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 654** `[SLA_UNQUALIFIED]`
  > `- **Line 1053**: `- **Line 21309**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 655** `[SLA_UNQUALIFIED]`
  > `- **Line 1054**: `- **Line 21331**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 656** `[SLA_UNQUALIFIED]`
  > `- **Line 1055**: `- **Line 21353**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 657** `[SLA_UNQUALIFIED]`
  > `- **Line 1056**: `- **Line 21375**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 658** `[SLA_UNQUALIFIED]`
  > `- **Line 1057**: `- **Line 21397**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 659** `[SLA_UNQUALIFIED]`
  > `- **Line 1058**: `- **Line 21419**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 660** `[SLA_UNQUALIFIED]`
  > `- **Line 1059**: `- **Line 21441**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 661** `[SLA_UNQUALIFIED]`
  > `- **Line 1060**: `- **Line 21463**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 662** `[SLA_UNQUALIFIED]`
  > `- **Line 1061**: `- **Line 21485**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 663** `[SLA_UNQUALIFIED]`
  > `- **Line 1062**: `- **Line 21507**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 664** `[SLA_UNQUALIFIED]`
  > `- **Line 1063**: `- **Line 21529**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 665** `[SLA_UNQUALIFIED]`
  > `- **Line 1064**: `- **Line 21551**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 666** `[SLA_UNQUALIFIED]`
  > `- **Line 1065**: `- **Line 21573**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 667** `[SLA_UNQUALIFIED]`
  > `- **Line 1066**: `- **Line 21595**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 668** `[SLA_UNQUALIFIED]`
  > `- **Line 1067**: `- **Line 21617**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 669** `[SLA_UNQUALIFIED]`
  > `- **Line 1068**: `- **Line 21639**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 670** `[SLA_UNQUALIFIED]`
  > `- **Line 1069**: `- **Line 21661**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 671** `[SLA_UNQUALIFIED]`
  > `- **Line 1070**: `- **Line 21683**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 672** `[SLA_UNQUALIFIED]`
  > `- **Line 1071**: `- **Line 21705**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 673** `[SLA_UNQUALIFIED]`
  > `- **Line 1072**: `- **Line 21727**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 674** `[SLA_UNQUALIFIED]`
  > `- **Line 1073**: `- **Line 21749**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 675** `[SLA_UNQUALIFIED]`
  > `- **Line 1074**: `- **Line 21771**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 676** `[SLA_UNQUALIFIED]`
  > `- **Line 1075**: `- **Line 21793**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 677** `[SLA_UNQUALIFIED]`
  > `- **Line 1076**: `- **Line 21815**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 678** `[SLA_UNQUALIFIED]`
  > `- **Line 1077**: `- **Line 21837**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 679** `[SLA_UNQUALIFIED]`
  > `- **Line 1078**: `- **Line 21859**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 680** `[SLA_UNQUALIFIED]`
  > `- **Line 1079**: `- **Line 21881**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 681** `[SLA_UNQUALIFIED]`
  > `- **Line 1080**: `- **Line 21903**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 682** `[SLA_UNQUALIFIED]`
  > `- **Line 1081**: `- **Line 21925**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 683** `[SLA_UNQUALIFIED]`
  > `- **Line 1082**: `- **Line 21947**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 684** `[SLA_UNQUALIFIED]`
  > `- **Line 1083**: `- **Line 21969**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 685** `[SLA_UNQUALIFIED]`
  > `- **Line 1084**: `- **Line 21991**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 686** `[SLA_UNQUALIFIED]`
  > `- **Line 1085**: `- **Line 22013**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 687** `[SLA_UNQUALIFIED]`
  > `- **Line 1086**: `- **Line 22035**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 688** `[SLA_UNQUALIFIED]`
  > `- **Line 1087**: `- **Line 22057**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 689** `[SLA_UNQUALIFIED]`
  > `- **Line 1088**: `- **Line 22079**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 690** `[SLA_UNQUALIFIED]`
  > `- **Line 1089**: `- **Line 22101**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 691** `[SLA_UNQUALIFIED]`
  > `- **Line 1090**: `- **Line 22123**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 692** `[SLA_UNQUALIFIED]`
  > `- **Line 1091**: `- **Line 22145**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 693** `[SLA_UNQUALIFIED]`
  > `- **Line 1092**: `- **Line 22167**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 694** `[SLA_UNQUALIFIED]`
  > `- **Line 1093**: `- **Line 22189**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 695** `[SLA_UNQUALIFIED]`
  > `- **Line 1094**: `- **Line 22211**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 696** `[SLA_UNQUALIFIED]`
  > `- **Line 1095**: `- **Line 22233**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 697** `[SLA_UNQUALIFIED]`
  > `- **Line 1096**: `- **Line 22255**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 698** `[SLA_UNQUALIFIED]`
  > `- **Line 1097**: `- **Line 22277**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 699** `[SLA_UNQUALIFIED]`
  > `- **Line 1098**: `- **Line 22299**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 700** `[SLA_UNQUALIFIED]`
  > `- **Line 1099**: `- **Line 22321**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 701** `[SLA_UNQUALIFIED]`
  > `- **Line 1100**: `- **Line 22343**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 702** `[SLA_UNQUALIFIED]`
  > `- **Line 1101**: `- **Line 22365**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 703** `[SLA_UNQUALIFIED]`
  > `- **Line 1102**: `- **Line 22387**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 704** `[SLA_UNQUALIFIED]`
  > `- **Line 1103**: `- **Line 22409**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 705** `[SLA_UNQUALIFIED]`
  > `- **Line 1104**: `- **Line 22431**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 706** `[SLA_UNQUALIFIED]`
  > `- **Line 1105**: `- **Line 22453**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 707** `[SLA_UNQUALIFIED]`
  > `- **Line 1106**: `- **Line 22475**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 708** `[SLA_UNQUALIFIED]`
  > `- **Line 1107**: `- **Line 22497**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 709** `[SLA_UNQUALIFIED]`
  > `- **Line 1108**: `- **Line 22519**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 710** `[SLA_UNQUALIFIED]`
  > `- **Line 1109**: `- **Line 22541**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 711** `[SLA_UNQUALIFIED]`
  > `- **Line 1110**: `- **Line 22563**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 712** `[SLA_UNQUALIFIED]`
  > `- **Line 1111**: `- **Line 22585**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 713** `[SLA_UNQUALIFIED]`
  > `- **Line 1112**: `- **Line 22607**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 714** `[SLA_UNQUALIFIED]`
  > `- **Line 1113**: `- **Line 22629**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 715** `[SLA_UNQUALIFIED]`
  > `- **Line 1114**: `- **Line 22651**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 716** `[SLA_UNQUALIFIED]`
  > `- **Line 1115**: `- **Line 22673**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 717** `[SLA_UNQUALIFIED]`
  > `- **Line 1116**: `- **Line 22695**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 718** `[SLA_UNQUALIFIED]`
  > `- **Line 1117**: `- **Line 22717**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 719** `[SLA_UNQUALIFIED]`
  > `- **Line 1118**: `- **Line 22739**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 720** `[SLA_UNQUALIFIED]`
  > `- **Line 1119**: `- **Line 22761**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 721** `[SLA_UNQUALIFIED]`
  > `- **Line 1120**: `- **Line 22783**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 722** `[SLA_UNQUALIFIED]`
  > `- **Line 1121**: `- **Line 22805**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 723** `[SLA_UNQUALIFIED]`
  > `- **Line 1122**: `- **Line 22827**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 724** `[SLA_UNQUALIFIED]`
  > `- **Line 1123**: `- **Line 22849**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 725** `[SLA_UNQUALIFIED]`
  > `- **Line 1124**: `- **Line 22871**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 726** `[SLA_UNQUALIFIED]`
  > `- **Line 1125**: `- **Line 22893**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 727** `[SLA_UNQUALIFIED]`
  > `- **Line 1126**: `- **Line 22915**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 728** `[SLA_UNQUALIFIED]`
  > `- **Line 1127**: `- **Line 22937**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 729** `[SLA_UNQUALIFIED]`
  > `- **Line 1128**: `- **Line 22959**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 730** `[SLA_UNQUALIFIED]`
  > `- **Line 1129**: `- **Line 22981**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 731** `[SLA_UNQUALIFIED]`
  > `- **Line 1130**: `- **Line 23003**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 732** `[SLA_UNQUALIFIED]`
  > `- **Line 1131**: `- **Line 23025**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 733** `[SLA_UNQUALIFIED]`
  > `- **Line 1132**: `- **Line 23047**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 734** `[SLA_UNQUALIFIED]`
  > `- **Line 1133**: `- **Line 23069**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 735** `[SLA_UNQUALIFIED]`
  > `- **Line 1134**: `- **Line 23091**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 736** `[SLA_UNQUALIFIED]`
  > `- **Line 1135**: `- **Line 23113**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 737** `[SLA_UNQUALIFIED]`
  > `- **Line 1136**: `- **Line 23135**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 738** `[SLA_UNQUALIFIED]`
  > `- **Line 1137**: `- **Line 23157**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 739** `[SLA_UNQUALIFIED]`
  > `- **Line 1138**: `- **Line 23179**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 740** `[SLA_UNQUALIFIED]`
  > `- **Line 1139**: `- **Line 23201**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 741** `[SLA_UNQUALIFIED]`
  > `- **Line 1140**: `- **Line 23223**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 742** `[SLA_UNQUALIFIED]`
  > `- **Line 1141**: `- **Line 23245**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 743** `[SLA_UNQUALIFIED]`
  > `- **Line 1142**: `- **Line 23267**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 744** `[SLA_UNQUALIFIED]`
  > `- **Line 1143**: `- **Line 23289**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 745** `[SLA_UNQUALIFIED]`
  > `- **Line 1144**: `- **Line 23311**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 746** `[SLA_UNQUALIFIED]`
  > `- **Line 1145**: `- **Line 23333**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 747** `[SLA_UNQUALIFIED]`
  > `- **Line 1146**: `- **Line 23355**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 748** `[SLA_UNQUALIFIED]`
  > `- **Line 1147**: `- **Line 23377**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 749** `[SLA_UNQUALIFIED]`
  > `- **Line 1148**: `- **Line 23399**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 750** `[SLA_UNQUALIFIED]`
  > `- **Line 1149**: `- **Line 23421**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 751** `[SLA_UNQUALIFIED]`
  > `- **Line 1150**: `- **Line 23443**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 752** `[SLA_UNQUALIFIED]`
  > `- **Line 1151**: `- **Line 23465**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 753** `[SLA_UNQUALIFIED]`
  > `- **Line 1152**: `- **Line 23487**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 754** `[SLA_UNQUALIFIED]`
  > `- **Line 1153**: `- **Line 23509**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 755** `[SLA_UNQUALIFIED]`
  > `- **Line 1154**: `- **Line 23531**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 756** `[SLA_UNQUALIFIED]`
  > `- **Line 1155**: `- **Line 23553**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 757** `[SLA_UNQUALIFIED]`
  > `- **Line 1156**: `- **Line 23575**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 758** `[SLA_UNQUALIFIED]`
  > `- **Line 1157**: `- **Line 23597**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 759** `[SLA_UNQUALIFIED]`
  > `- **Line 1158**: `- **Line 23619**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 760** `[SLA_UNQUALIFIED]`
  > `- **Line 1159**: `- **Line 23641**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 761** `[SLA_UNQUALIFIED]`
  > `- **Line 1160**: `- **Line 23663**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 762** `[SLA_UNQUALIFIED]`
  > `- **Line 1161**: `- **Line 23685**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 763** `[SLA_UNQUALIFIED]`
  > `- **Line 1162**: `- **Line 23707**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 764** `[SLA_UNQUALIFIED]`
  > `- **Line 1163**: `- **Line 23729**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 765** `[SLA_UNQUALIFIED]`
  > `- **Line 1164**: `- **Line 23751**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 766** `[SLA_UNQUALIFIED]`
  > `- **Line 1165**: `- **Line 23773**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 767** `[SLA_UNQUALIFIED]`
  > `- **Line 1166**: `- **Line 23795**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 768** `[SLA_UNQUALIFIED]`
  > `- **Line 1167**: `- **Line 23817**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 769** `[SLA_UNQUALIFIED]`
  > `- **Line 1168**: `- **Line 23839**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 770** `[SLA_UNQUALIFIED]`
  > `- **Line 1169**: `- **Line 23861**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 771** `[SLA_UNQUALIFIED]`
  > `- **Line 1170**: `- **Line 23883**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 772** `[SLA_UNQUALIFIED]`
  > `- **Line 1171**: `- **Line 23905**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 773** `[SLA_UNQUALIFIED]`
  > `- **Line 1172**: `- **Line 23927**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 774** `[SLA_UNQUALIFIED]`
  > `- **Line 1173**: `- **Line 23949**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 775** `[SLA_UNQUALIFIED]`
  > `- **Line 1174**: `- **Line 23971**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 776** `[SLA_UNQUALIFIED]`
  > `- **Line 1175**: `- **Line 23993**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 777** `[SLA_UNQUALIFIED]`
  > `- **Line 1176**: `- **Line 24015**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 778** `[SLA_UNQUALIFIED]`
  > `- **Line 1177**: `- **Line 24037**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 779** `[SLA_UNQUALIFIED]`
  > `- **Line 1178**: `- **Line 24059**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 780** `[SLA_UNQUALIFIED]`
  > `- **Line 1179**: `- **Line 24081**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 781** `[SLA_UNQUALIFIED]`
  > `- **Line 1180**: `- **Line 24103**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 782** `[SLA_UNQUALIFIED]`
  > `- **Line 1181**: `- **Line 24125**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 783** `[SLA_UNQUALIFIED]`
  > `- **Line 1182**: `- **Line 24147**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 784** `[SLA_UNQUALIFIED]`
  > `- **Line 1183**: `- **Line 24169**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 785** `[SLA_UNQUALIFIED]`
  > `- **Line 1184**: `- **Line 24191**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 786** `[SLA_UNQUALIFIED]`
  > `- **Line 1185**: `- **Line 24213**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 787** `[SLA_UNQUALIFIED]`
  > `- **Line 1186**: `- **Line 24235**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 788** `[SLA_UNQUALIFIED]`
  > `- **Line 1187**: `- **Line 24257**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 789** `[SLA_UNQUALIFIED]`
  > `- **Line 1188**: `- **Line 24279**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 790** `[SLA_UNQUALIFIED]`
  > `- **Line 1189**: `- **Line 24301**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 791** `[SLA_UNQUALIFIED]`
  > `- **Line 1190**: `- **Line 24323**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 792** `[SLA_UNQUALIFIED]`
  > `- **Line 1191**: `- **Line 24345**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 793** `[SLA_UNQUALIFIED]`
  > `- **Line 1192**: `- **Line 24367**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 794** `[SLA_UNQUALIFIED]`
  > `- **Line 1193**: `- **Line 24389**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 795** `[SLA_UNQUALIFIED]`
  > `- **Line 1194**: `- **Line 24411**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 796** `[SLA_UNQUALIFIED]`
  > `- **Line 1195**: `- **Line 24433**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 797** `[SLA_UNQUALIFIED]`
  > `- **Line 1196**: `- **Line 24455**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 798** `[SLA_UNQUALIFIED]`
  > `- **Line 1197**: `- **Line 24477**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 799** `[SLA_UNQUALIFIED]`
  > `- **Line 1198**: `- **Line 24499**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 800** `[SLA_UNQUALIFIED]`
  > `- **Line 1199**: `- **Line 24521**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 801** `[SLA_UNQUALIFIED]`
  > `- **Line 1200**: `- **Line 24543**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 802** `[SLA_UNQUALIFIED]`
  > `- **Line 1201**: `- **Line 24565**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 803** `[SLA_UNQUALIFIED]`
  > `- **Line 1202**: `- **Line 24587**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 804** `[SLA_UNQUALIFIED]`
  > `- **Line 1203**: `- **Line 24609**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 805** `[SLA_UNQUALIFIED]`
  > `- **Line 1204**: `- **Line 24631**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 806** `[SLA_UNQUALIFIED]`
  > `- **Line 1205**: `- **Line 24653**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 807** `[SLA_UNQUALIFIED]`
  > `- **Line 1206**: `- **Line 24675**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 808** `[SLA_UNQUALIFIED]`
  > `- **Line 1207**: `- **Line 24697**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 809** `[SLA_UNQUALIFIED]`
  > `- **Line 1208**: `- **Line 24719**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 810** `[SLA_UNQUALIFIED]`
  > `- **Line 1209**: `- **Line 24741**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 811** `[SLA_UNQUALIFIED]`
  > `- **Line 1210**: `- **Line 24763**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 812** `[SLA_UNQUALIFIED]`
  > `- **Line 1211**: `- **Line 24785**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 813** `[SLA_UNQUALIFIED]`
  > `- **Line 1212**: `- **Line 24807**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 814** `[SLA_UNQUALIFIED]`
  > `- **Line 1213**: `- **Line 24829**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 815** `[SLA_UNQUALIFIED]`
  > `- **Line 1214**: `- **Line 24851**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 816** `[SLA_UNQUALIFIED]`
  > `- **Line 1215**: `- **Line 24873**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 817** `[SLA_UNQUALIFIED]`
  > `- **Line 1216**: `- **Line 24895**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 818** `[SLA_UNQUALIFIED]`
  > `- **Line 1217**: `- **Line 24917**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 819** `[SLA_UNQUALIFIED]`
  > `- **Line 1218**: `- **Line 24939**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 820** `[SLA_UNQUALIFIED]`
  > `- **Line 1219**: `- **Line 24961**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 821** `[SLA_UNQUALIFIED]`
  > `- **Line 1220**: `- **Line 24983**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 822** `[SLA_UNQUALIFIED]`
  > `- **Line 1221**: `- **Line 25005**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 823** `[SLA_UNQUALIFIED]`
  > `- **Line 1222**: `- **Line 25027**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 824** `[SLA_UNQUALIFIED]`
  > `- **Line 1223**: `- **Line 25049**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 825** `[SLA_UNQUALIFIED]`
  > `- **Line 1224**: `- **Line 25071**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 826** `[SLA_UNQUALIFIED]`
  > `- **Line 1225**: `- **Line 25093**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 827** `[SLA_UNQUALIFIED]`
  > `- **Line 1226**: `- **Line 25115**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 828** `[SLA_UNQUALIFIED]`
  > `- **Line 1227**: `- **Line 25137**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 829** `[SLA_UNQUALIFIED]`
  > `- **Line 1228**: `- **Line 25159**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 830** `[SLA_UNQUALIFIED]`
  > `- **Line 1229**: `- **Line 25181**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 831** `[SLA_UNQUALIFIED]`
  > `- **Line 1230**: `- **Line 25203**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 832** `[SLA_UNQUALIFIED]`
  > `- **Line 1231**: `- **Line 25225**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 833** `[SLA_UNQUALIFIED]`
  > `- **Line 1232**: `- **Line 25247**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 834** `[SLA_UNQUALIFIED]`
  > `- **Line 1233**: `- **Line 25269**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 835** `[SLA_UNQUALIFIED]`
  > `- **Line 1234**: `- **Line 25291**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 836** `[SLA_UNQUALIFIED]`
  > `- **Line 1235**: `- **Line 25313**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 837** `[SLA_UNQUALIFIED]`
  > `- **Line 1236**: `- **Line 25335**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 838** `[SLA_UNQUALIFIED]`
  > `- **Line 1237**: `- **Line 25357**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 839** `[SLA_UNQUALIFIED]`
  > `- **Line 1238**: `- **Line 25379**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 840** `[SLA_UNQUALIFIED]`
  > `- **Line 1239**: `- **Line 25401**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 841** `[SLA_UNQUALIFIED]`
  > `- **Line 1240**: `- **Line 25423**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 842** `[SLA_UNQUALIFIED]`
  > `- **Line 1241**: `- **Line 25445**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 843** `[SLA_UNQUALIFIED]`
  > `- **Line 1242**: `- **Line 25467**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 844** `[SLA_UNQUALIFIED]`
  > `- **Line 1243**: `- **Line 25489**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 845** `[SLA_UNQUALIFIED]`
  > `- **Line 1244**: `- **Line 25511**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 846** `[SLA_UNQUALIFIED]`
  > `- **Line 1245**: `- **Line 25533**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 847** `[SLA_UNQUALIFIED]`
  > `- **Line 1246**: `- **Line 25555**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 848** `[SLA_UNQUALIFIED]`
  > `- **Line 1247**: `- **Line 25577**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 849** `[SLA_UNQUALIFIED]`
  > `- **Line 1248**: `- **Line 25599**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 850** `[SLA_UNQUALIFIED]`
  > `- **Line 1249**: `- **Line 25621**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 851** `[SLA_UNQUALIFIED]`
  > `- **Line 1250**: `- **Line 25643**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 852** `[SLA_UNQUALIFIED]`
  > `- **Line 1251**: `- **Line 25665**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 853** `[SLA_UNQUALIFIED]`
  > `- **Line 1252**: `- **Line 25687**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 854** `[SLA_UNQUALIFIED]`
  > `- **Line 1253**: `- **Line 25709**: `**Assertion**: Support contact must exist and be honest (no ...`

- **Line 855** `[HARD_FORBIDDEN]`
  > `- **Line 1263**: `- **Line 184**: `- Manual copy always available (manualCopyAlwaysAvailable: tru...`

- **Line 856** `[SLA_UNQUALIFIED]`
  > `- **Line 1267**: `- **Line 31**: `✅ No overclaims (SOC2/ISO/SLA explicitly disclaimed)```

- **Line 857** `[HARD_FORBIDDEN]`
  > `- **Line 1268**: `- **Line 419**: `**Search Pattern**: `SOC\s?2|ISO\s?\d{4,5}|Cloud Fortified|SLA...`

- **Line 857** `[SLA_UNQUALIFIED]`
  > `- **Line 1268**: `- **Line 419**: `**Search Pattern**: `SOC\s?2|ISO\s?\d{4,5}|Cloud Fortified|SLA...`

- **Line 858** `[SLA_UNQUALIFIED]`
  > `- **Line 1269**: `- **Line 463**: `- ✅ **NO** unverifiable SLA promises```

- **Line 859** `[SLA_UNQUALIFIED]`
  > `- **Line 1270**: `- **Line 467**: `- ✅ Support.md explicitly states "NO SERVICE LEVEL AGREEMENT (...`

- **Line 860** `[SLA_UNQUALIFIED]`
  > `- **Line 1274**: `- **Line 17**: `**Evidence of SLA Tiers:** MISSING```

- **Line 861** `[SLA_UNQUALIFIED]`
  > `- **Line 1276**: `- **Line 462**: `| A | SECURITY.md, manifest.yml | SLA tiers missing |```

- **Line 862** `[SLA_UNQUALIFIED]`
  > `- **Line 1280**: `- **Line 170**: `2. Deletion SLA: 7 business days```

- **Line 863** `[SLA_UNQUALIFIED]`
  > `- **Line 1281**: `- **Line 685**: `- One SLA for all severity levels (unrealistic)```

- **Line 864** `[SLA_UNQUALIFIED]`
  > `- **Line 1284**: `- **Line 929**: `| D1 | SLA Tiers | MED | OPEN | <1 | S |```

- **Line 865** `[SLA_UNQUALIFIED]`
  > `- **Line 1288**: `- **Line 95**: `- Document manual deletion request process (7-day SLA)```

- **Line 866** `[SLA_UNQUALIFIED]`
  > `- **Line 1289**: `- **Line 249**: `3. SLA tiers documentation (GAP-D1)```

- **Line 867** `[SLA_UNQUALIFIED]`
  > `- **Line 1290**: `- **Line 334**: `- [x] SECURITY.md with severity SLA tiers```

- **Line 868** `[SLA_UNQUALIFIED]`
  > `- **Line 1291**: `- **Line 411**: `| GAP-D1: SLA Tiers | 4 | ON TRACK |```

- **Line 869** `[SLA_UNQUALIFIED]`
  > `- **Line 1292**: `- **Line 618**: `- Week 2: SLA tiers + SLI/SLO (8h)```

- **Line 870** `[SLA_UNQUALIFIED]`
  > `- **Line 1296**: `- **Line 15**: `- Gaps: SLA tiers not severity-ranked (GAP-D1)```

- **Line 871** `[SLA_UNQUALIFIED]`
  > `- **Line 1297**: `- **Line 23**: `- [ ] Severity-based SLA tiers documented```

- **Line 872** `[SLA_UNQUALIFIED]`
  > `- **Line 1301**: `- **Line 163**: `**Security Policy:** SECURITY.md with 48h acknowledgment, 5-da...`

- **Line 873** `[SLA_UNQUALIFIED]`
  > `- **Line 1305**: `- **Line 420**: `3. SLA: Deletion confirmed within 7 business days```

- **Line 874** `[SLA_UNQUALIFIED]`
  > `- **Line 1307**: `- **Line 1360**: `- **Draft patch:** Within SLA timeframe```

- **Line 875** `[HARD_FORBIDDEN]`
  > `- **Line 1311**: `- **Line 77**: `**Determinism**: GUARANTEED ✅```

- **Line 876** `[HARD_FORBIDDEN]`
  > `- **Line 1315**: `- **Line 38**: `Certification: DETERMINISM GUARANTEED ✅```

- **Line 877** `[HARD_FORBIDDEN]`
  > `- **Line 1319**: `- **Line 35**: `Determinism: GUARANTEED ✅```

- **Line 878** `[HARD_FORBIDDEN]`
  > `- **Line 1320**: `- **Line 120**: `- With identical results guaranteed```

- **Line 879** `[HARD_FORBIDDEN]`
  > `- **Line 1321**: `- **Line 167**: `║  Result: DETERMINISM GUARANTEED ✅                           ...`

- **Line 880** `[HARD_FORBIDDEN]`
  > `- **Line 1340**: `- **Line 256**: `| Is Jira safe? | ✅ YES (read-only guaranteed) | JIRA_API_INVE...`

- **Line 881** `[SLA_UNQUALIFIED]`
  > `- **Line 1344**: `- **Line 486**: `- Forge platform provides SLA (99.5%)```

- **Line 882** `[HARD_FORBIDDEN]`
  > `- **Line 1349**: `- **Line 432**: `- "guaranteed" (not found - uses "monitor", "capture")```

- **Line 883** `[HARD_FORBIDDEN]`
  > `- **Line 1350**: `- **Line 448**: `| No false implications | ✅ PASS | No "AI", "guaranteed", "rea...`

- **Line 884** `[SLA_UNQUALIFIED]`
  > `- **Line 1363**: `- **Line 1145**: `+**Assertion**: Support contact must exist and be honest (no ...`

- **Line 885** `[SLA_UNQUALIFIED]`
  > `- **Line 1364**: `- **Line 1167**: `+**Assertion**: Support contact must exist and be honest (no ...`

- **Line 886** `[SLA_UNQUALIFIED]`
  > `- **Line 1365**: `- **Line 1189**: `+**Assertion**: Support contact must exist and be honest (no ...`

- **Line 887** `[SLA_UNQUALIFIED]`
  > `- **Line 1376**: `- **Line 74**: `<h1>Service Level Agreement (SLA)</h1>```

- **Line 888** `[HARD_FORBIDDEN]`
  > `- **Line 1380**: `- **Line 5**: `- Hard-forbidden: guarantee (positive), 24/7, enterprise-grade, ...`

- **Line 888** `[HARD_FORBIDDEN]`
  > `- **Line 1380**: `- **Line 5**: `- Hard-forbidden: guarantee (positive), 24/7, enterprise-grade, ...`

- **Line 889** `[HARD_FORBIDDEN]`
  > `- **Line 1382**: `- **Line 15**: `- Line 9: "no specific uptime guarantees" - ✅ ACCEPTABLE (negat...`

- **Line 891** `[HARD_FORBIDDEN]`
  > `- **Line 1385**: `- **Line 37**: `No instances of: enterprise-grade, mission-critical, enforces (...`

- **Line 892** `[SLA_UNQUALIFIED]`
  > `- **Line 1389**: `- **Line 52**: `| Claim | Privacy | Terms | Data | SLA | Support | Screenshots |```

- **Line 894** `[HARD_FORBIDDEN]`
  > `- **Line 1394**: `- **Line 18**: `- No instances of: enterprise-grade, mission-critical, enforces...`

- **Line 895** `[HARD_FORBIDDEN]`
  > `- **Line 1408**: `- **Line 778**: `- Security advisory DB not always available```

- **Line 896** `[SLA_UNQUALIFIED]`
  > `- **Line 1412**: `- **Line 451**: `+**Assertion**: Support contact must exist and be honest (no u...`

- **Line 897** `[HARD_FORBIDDEN]`
  > `- **Line 1423**: `- **Line 39**: `3. Original repository integrity guaranteed```

- **Line 898** `[SLA_UNQUALIFIED]`
  > `- **Line 1444**: `- **Line 16**: `| SLA | ✅ PRESENT | `docs/legal/service-level-agreement.md` |```

- **Line 899** `[SLA_UNQUALIFIED]`
  > `- **Line 1454**: `- **Line 65**: `- SLA: ✅ PRESENT (docs/legal/service-level-agreement.md)```

- **Line 900** `[SLA_UNQUALIFIED]`
  > `- **Line 1462**: `- **Line 40**: `3. Set SLA for resolution (e.g., must resolve within 2 sprints)```

- **Line 902** `[SLA_UNQUALIFIED]`
  > `- **Line 1484**: `- **Line 319**: `- SLA support```

- **Line 903** `[SLA_UNQUALIFIED]`
  > `- **Line 1492**: `- **Line 55**: `- docs/legal/*.{md,html} (privacy, terms, data handling, SLA)```

- **Line 904** `[SLA_UNQUALIFIED]`
  > `- **Line 1496**: `- **Line 1366**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 905** `[SLA_UNQUALIFIED]`
  > `- **Line 1497**: `- **Line 1388**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 906** `[SLA_UNQUALIFIED]`
  > `- **Line 1498**: `- **Line 1410**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 907** `[SLA_UNQUALIFIED]`
  > `- **Line 1499**: `- **Line 1432**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 908** `[SLA_UNQUALIFIED]`
  > `- **Line 1500**: `- **Line 1454**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 909** `[SLA_UNQUALIFIED]`
  > `- **Line 1501**: `- **Line 1476**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 910** `[SLA_UNQUALIFIED]`
  > `- **Line 1502**: `- **Line 1498**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 911** `[SLA_UNQUALIFIED]`
  > `- **Line 1503**: `- **Line 1520**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 912** `[SLA_UNQUALIFIED]`
  > `- **Line 1504**: `- **Line 1542**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 913** `[SLA_UNQUALIFIED]`
  > `- **Line 1505**: `- **Line 1564**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 914** `[SLA_UNQUALIFIED]`
  > `- **Line 1506**: `- **Line 1586**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 915** `[SLA_UNQUALIFIED]`
  > `- **Line 1507**: `- **Line 1608**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 916** `[SLA_UNQUALIFIED]`
  > `- **Line 1508**: `- **Line 1630**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 917** `[SLA_UNQUALIFIED]`
  > `- **Line 1514**: `- **Line 1366**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 918** `[SLA_UNQUALIFIED]`
  > `- **Line 1515**: `- **Line 1388**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 919** `[SLA_UNQUALIFIED]`
  > `- **Line 1516**: `- **Line 1410**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 920** `[SLA_UNQUALIFIED]`
  > `- **Line 1517**: `- **Line 1432**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 921** `[SLA_UNQUALIFIED]`
  > `- **Line 1518**: `- **Line 1454**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 922** `[SLA_UNQUALIFIED]`
  > `- **Line 1519**: `- **Line 1476**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 923** `[SLA_UNQUALIFIED]`
  > `- **Line 1520**: `- **Line 1498**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 924** `[SLA_UNQUALIFIED]`
  > `- **Line 1521**: `- **Line 1520**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 925** `[SLA_UNQUALIFIED]`
  > `- **Line 1522**: `- **Line 1542**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 926** `[SLA_UNQUALIFIED]`
  > `- **Line 1523**: `- **Line 1564**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 927** `[SLA_UNQUALIFIED]`
  > `- **Line 1524**: `- **Line 1586**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 928** `[SLA_UNQUALIFIED]`
  > `- **Line 1525**: `- **Line 1608**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 929** `[SLA_UNQUALIFIED]`
  > `- **Line 1526**: `- **Line 1630**: `**Assertion**: Support contact must exist and be honest (no u...`

- **Line 930** `[SLA_UNQUALIFIED]`
  > `- **Line 1532**: `- **Line 6**: `- Phase 8 discovered 8 risk findings including 3 CRITICAL SLA-re...`

- **Line 931** `[HARD_FORBIDDEN]`
  > `- **Line 1533**: `- **Line 9**: `- Auto-editing was necessary to achieve SLA/guarantee consistenc...`

- **Line 931** `[SLA_UNQUALIFIED]`
  > `- **Line 1533**: `- **Line 9**: `- Auto-editing was necessary to achieve SLA/guarantee consistenc...`

- **Line 932** `[SLA_UNQUALIFIED]`
  > `- **Line 1534**: `- **Line 26**: `All edits to PRIVACY and SECURITY files were necessary to remov...`

- **Line 933** `[SLA_UNQUALIFIED]`
  > `- **Line 1543**: `- **Line 337**: `- [SUPPORT_POLICY.md](SUPPORT_POLICY.md) — Support contact & S...`

- **Line 934** `[SLA_UNQUALIFIED]`
  > `- **Line 1554**: `- **Line 62**: `- Red flag detected: SLA document exists```

- **Line 935** `[SLA_UNQUALIFIED]`
  > `- **Line 1555**: `- **Line 74**: `- 3 CRITICAL (auto-escalation, SLA document, SLA link)```

- **Line 936** `[SLA_UNQUALIFIED]`
  > `- **Line 1556**: `- **Line 97**: `- All P0 docs now have NO-SLA language```

- **Line 937** `[SLA_UNQUALIFIED]`
  > `- **Line 1557**: `- **Line 112**: `4. `docs/SUPPORT.md` → Add NO-SLA header + fix link text (SLAs...`

- **Line 938** `[SLA_UNQUALIFIED]`
  > `- **Line 1558**: `- **Line 114**: `6. `docs/SUPPORT_POLICY.md` → Standardize NO-SLA language```

- **Line 939** `[SLA_UNQUALIFIED]`
  > `- **Line 1559**: `- **Line 141**: `| SLA link reference | docs/SUPPORT.md:211 | Link text changed...`

- **Line 940** `[SLA_UNQUALIFIED]`
  > `- **Line 1560**: `- **Line 147**: `| PRIVACY.md SLA ambiguity | Missing disclaimer | Added SLA se...`

- **Line 941** `[SLA_UNQUALIFIED]`
  > `- **Line 1561**: `- **Line 149**: `| SUPPORT.md NO-SLA header | Inconsistent | Prominent header a...`

- **Line 942** `[SLA_UNQUALIFIED]`
  > `- **Line 1562**: `- **Line 161**: `- **Verification**: Searched 2,778 files for unqualified SLA c...`

- **Line 943** `[SLA_UNQUALIFIED]`
  > `- **Line 1563**: `- **Line 163**: `- All SLA language is explicitly qualified with "NO" or "DOES ...`

- **Line 944** `[HARD_FORBIDDEN]`
  > `- **Line 1564**: `- **Line 168**: `- Searched for "mission-critical" → NOT FOUND```

- **Line 945** `[HARD_FORBIDDEN]`
  > `- **Line 1565**: `- **Line 176**: `- Searched for "enterprise-ready" → NOT FOUND```

- **Line 946** `[SLA_UNQUALIFIED]`
  > `- **Line 1566**: `- **Line 178**: `- No phone/email/SLA support promised```

- **Line 947** `[SLA_UNQUALIFIED]`
  > `- **Line 1567**: `- **Line 243**: `1. Maintain NO-SLA language consistency```

- **Line 948** `[HARD_FORBIDDEN]`
  > `- **Line 1568**: `- **Line 260**: `> - No uptime guarantees```

- **Line 949** `[SLA_UNQUALIFIED]`
  > `- **Line 1569**: `- **Line 263**: `> The only legal SLA document (`docs/legal/service-level-agree...`

- **Line 950** `[SLA_UNQUALIFIED]`
  > `- **Line 1570**: `- **Line 294**: `- Zero unqualified SLA claims```

- **Line 951** `[HARD_FORBIDDEN]`
  > `- **Line 1571**: `- **Line 295**: `- Zero unqualified uptime guarantees```

- **Line 952** `[HARD_FORBIDDEN]`
  > `- **Line 1575**: `- **Line 58**: `Firsttry provides NO SERVICE LEVEL AGREEMENT or uptime guarante...`

- **Line 954** `[HARD_FORBIDDEN]`
  > `- **Line 1577**: `- **Line 109**: `- [ ] No uptime guarantees```

- **Line 955** `[SLA_UNQUALIFIED]`
  > `- **Line 1578**: `- **Line 131**: `1. docs/PRIVACY.md — Add SLA/support disclaimer```

- **Line 956** `[SLA_UNQUALIFIED]`
  > `- **Line 1579**: `- **Line 133**: `3. docs/SUPPORT.md — Add NO-SLA header, change link text```

- **Line 957** `[SLA_UNQUALIFIED]`
  > `- **Line 1580**: `- **Line 137**: `5. docs/SUPPORT_POLICY.md — Standardize NO-SLA language```

- **Line 958** `[SLA_UNQUALIFIED]`
  > `- **Line 1585**: `- **Line 33**: `FirstTry provides NO SERVICE LEVEL AGREEMENT (SLA) for privacy ...`

- **Line 959** `[HARD_FORBIDDEN]`
  > `- **Line 1586**: `- **Line 59**: `and does not constitute a legal SLA or support guarantee. See d...`

- **Line 960** `[SLA_UNQUALIFIED]`
  > `- **Line 1587**: `- **Line 66**: `**Line**: Insert at top (before current "# Service Level Agreem...`

- **Line 961** `[HARD_FORBIDDEN]`
  > `- **Line 1588**: `- **Line 80**: `uptime guarantees.```

- **Line 962** `[SLA_UNQUALIFIED]`
  > `- **Line 1589**: `- **Line 151**: `4. 🔧 docs/SUPPORT.md (add NO-SLA header + fix link)```

- **Line 963** `[SLA_UNQUALIFIED]`
  > `- **Line 1590**: `- **Line 153**: `6. 🔧 docs/SUPPORT_POLICY.md (standardize NO-SLA language)```

- **Line 964** `[SLA_UNQUALIFIED]`
  > `- **Line 1591**: `- **Line 160**: `**Scope**: Limited to support/SLA-related sections```

- **Line 965** `[HARD_FORBIDDEN]`
  > `- **Line 1592**: `- **Line 171**: `- Verify no new SLA/guarantee claims introduced```

- **Line 965** `[SLA_UNQUALIFIED]`
  > `- **Line 1592**: `- **Line 171**: `- Verify no new SLA/guarantee claims introduced```

- **Line 966** `[SLA_UNQUALIFIED]`
  > `- **Line 1593**: `- **Line 182**: `| docs/SUPPORT.md | Add + Modify | 1-5, 211 | Add NO-SLA heade...`

- **Line 967** `[SLA_UNQUALIFIED]`
  > `- **Line 1594**: `- **Line 184**: `| docs/SUPPORT_POLICY.md | Add | 1-5 | Add NO-SLA header |```

- **Line 968** `[SLA_UNQUALIFIED]`
  > `- **Line 1602**: `- **Line 59**: `- If SLA document exists, does it contain:```

- **Line 969** `[HARD_FORBIDDEN]`
  > `- **Line 1603**: `- **Line 60**: `- Uptime guarantees?```

- **Line 970** `[SLA_UNQUALIFIED]`
  > `- **Line 1604**: `- **Line 74**: `| ./docs/legal/ | 6 | Legal/SLA |```

- **Line 971** `[HARD_FORBIDDEN]`
  > `- **Line 1609**: `- **Line 7**: `**Risk Categories**: SLA/Guarantee, Auto-Escalation, SEV Levels,...`

- **Line 971** `[SLA_UNQUALIFIED]`
  > `- **Line 1609**: `- **Line 7**: `**Risk Categories**: SLA/Guarantee, Auto-Escalation, SEV Levels,...`

- **Line 972** `[SLA_UNQUALIFIED]`
  > `- **Line 1610**: `- **Line 17**: `| docs/SUPPORT.md | P0 | Marketplace, Enterprise | Public suppo...`

- **Line 973** `[SLA_UNQUALIFIED]`
  > `- **Line 1611**: `- **Line 21**: `| docs/RELIABILITY.md | P0 | Enterprise + Marketplace | SLA/upt...`

- **Line 975** `[SLA_UNQUALIFIED]`
  > `- **Line 1613**: `- **Line 74**: `- Line 1: "# Service Level Agreement (SLA)" — Document title```

- **Line 976** `[SLA_UNQUALIFIED]`
  > `- **Line 1614**: `- **Line 78**: `- Line 38: "This SLA does not apply to..."```

- **Line 979** `[SLA_UNQUALIFIED]`
  > `- **Line 1617**: `- **Line 94**: `**Risk**: References "Reliability SLAs" in link text → implies ...`

- **Line 980** `[SLA_UNQUALIFIED]`
  > `- **Line 1618**: `- **Line 105**: `**Risk**: Defines SEV1 severity levels → implies structured SL...`

- **Line 981** `[SLA_UNQUALIFIED]`
  > `- **Line 1619**: `- **Line 107**: `**Fix**: DOWNGRADE — Replace "SEV1" with "critical issue" (rem...`

- **Line 982** `[SLA_UNQUALIFIED]`
  > `- **Line 1620**: `- **Line 118**: `- atlassian/forge-app/docs/SUPPORT.md:62 → "NO SERVICE LEVEL A...`

- **Line 985** `[SLA_UNQUALIFIED]`
  > `- **Line 1623**: `- **Line 183**: `3. **SLA link reference** (docs/SUPPORT.md:211)```

- **Line 986** `[HARD_FORBIDDEN]`
  > `- **Line 1624**: `- **Line 209**: `- "No uptime guarantees"```

- **Line 987** `[SLA_UNQUALIFIED]`
  > `- **Line 1628**: `- **Line 17**: `- SLA-backed uptime```

- **Line 988** `[HARD_FORBIDDEN]`
  > `- **Line 1637**: `- **Line 47**: `These are ALWAYS available to all tenants regardless of plan:```

- **Line 989** `[SLA_UNQUALIFIED]`
  > `- **Line 1641**: `- **Line 29**: `- **SLA**: [TO BE DOCUMENTED]```

- **Line 990** `[SLA_UNQUALIFIED]`
  > `- **Line 1642**: `- **Line 38**: `- **SLA**: [TO BE DOCUMENTED]```

- **Line 991** `[SLA_UNQUALIFIED]`
  > `- **Line 1643**: `- **Line 47**: `- **SLA**: [TO BE DOCUMENTED]```

- **Line 992** `[SLA_UNQUALIFIED]`
  > `- **Line 1644**: `- **Line 56**: `- **SLA**: [TO BE DOCUMENTED]```

- **Line 993** `[SLA_UNQUALIFIED]`
  > `- **Line 1645**: `- **Line 87**: `- **SLA**: [99.9% uptime / Best effort / None]```

- **Line 994** `[SLA_UNQUALIFIED]`
  > `- **Line 1646**: `- **Line 125**: `- [ ] Product Manager (SLA agreement)```

- **Line 995** `[HARD_FORBIDDEN]`
  > `- **Line 1659**: `- **Line 198**: `- **SLA guarantees**: No response time commitments```

- **Line 995** `[SLA_UNQUALIFIED]`
  > `- **Line 1659**: `- **Line 198**: `- **SLA guarantees**: No response time commitments```

- **Line 996** `[HARD_FORBIDDEN]`
  > `- **Line 1663**: `- **Line 13**: `- ❌ "guaranteed uptime" (unqualified) → **NOT FOUND**```

- **Line 997** `[HARD_FORBIDDEN]`
  > `- **Line 1664**: `- **Line 14**: `- ❌ "guaranteed response" (unqualified) → **NOT FOUND**```

- **Line 998** `[HARD_FORBIDDEN]`
  > `- **Line 1665**: `- **Line 15**: `- ❌ "guaranteed SLA" (unqualified) → **NOT FOUND**```

- **Line 998** `[SLA_UNQUALIFIED]`
  > `- **Line 1665**: `- **Line 15**: `- ❌ "guaranteed SLA" (unqualified) → **NOT FOUND**```

- **Line 1000** `[HARD_FORBIDDEN]`
  > `- **Line 1667**: `- **Line 17**: `- ❌ "mission-critical" (without scoping) → **NOT FOUND**```

- **Line 1001** `[HARD_FORBIDDEN]`
  > `- **Line 1668**: `- **Line 18**: `- ❌ "enterprise-ready" (without disclaimer) → **NOT FOUND**```

- **Line 1002** `[HARD_FORBIDDEN]`
  > `- **Line 1669**: `- **Line 28**: `| "**NO** guaranteed response times, and **no** uptime guarante...`

- **Line 1003** `[HARD_FORBIDDEN]`
  > `- **Line 1670**: `- **Line 29**: `| "**no** guaranteed response timeframe" | docs/PRIVACY.md:168 ...`

- **Line 1004** `[HARD_FORBIDDEN]`
  > `- **Line 1671**: `- **Line 30**: `| "**no** guaranteed response times" | docs/SECURITY.md:38 | ✅ ...`

- **Line 1005** `[HARD_FORBIDDEN]`
  > `- **Line 1672**: `- **Line 31**: `| "**no** guaranteed response times, escalation SLAs, **or** up...`

- **Line 1006** `[HARD_FORBIDDEN]`
  > `- **Line 1673**: `- **Line 32**: `| "**no** guaranteed SLA" | atlassian/forge-app/docs/SUPPORT.md...`

- **Line 1006** `[SLA_UNQUALIFIED]`
  > `- **Line 1673**: `- **Line 32**: `| "**no** guaranteed SLA" | atlassian/forge-app/docs/SUPPORT.md...`

- **Line 1007** `[HARD_FORBIDDEN]`
  > `- **Line 1674**: `- **Line 41**: `- ✅ No unqualified uptime guarantees```

- **Line 1008** `[SLA_UNQUALIFIED]`
  > `- **Line 1675**: `- **Line 65**: `- ✅ No implication of automatic SLA-like response```

- **Line 1009** `[HARD_FORBIDDEN]`
  > `- **Line 1676**: `- **Line 73**: `- ✅ No "enterprise-ready" claims```

- **Line 1010** `[HARD_FORBIDDEN]`
  > `- **Line 1677**: `- **Line 74**: `- ✅ No "mission-critical" positioning```

- **Line 1011** `[SLA_UNQUALIFIED]`
  > `- **Line 1678**: `- **Line 97**: `- ✅ No vulnerability response SLA promises```

- **Line 1012** `[SLA_UNQUALIFIED]`
  > `- **Line 1680**: `- **Line 128**: `4. ✅ PRIVACY.md SLA ambiguity → Added explicit NO-SLA section ...`

- **Line 1013** `[SLA_UNQUALIFIED]`
  > `- **Line 1681**: `- **Line 130**: `6. ✅ SUPPORT.md missing NO-SLA → Added prominent disclaimer (P...`

- **Line 1014** `[SLA_UNQUALIFIED]`
  > `- **Line 1682**: `- **Line 131**: `7. ✅ SUPPORT_POLICY.md inconsistent → Standardized NO-SLA lang...`

- **Line 1016** `[HARD_FORBIDDEN]`
  > `- **Line 1692**: `- **Line 297**: `ALWAYS AVAILABLE (even if no missing data recorded)```

- **Line 1017** `[HARD_FORBIDDEN]`
  > `- **Line 1693**: `- **Line 312**: `- Always available if snapshot exists```

- **Line 1018** `[HARD_FORBIDDEN]`
  > `- **Line 1694**: `- **Line 338**: `| M5 | (always available) |```

- **Line 1019** `[HARD_FORBIDDEN]`
  > `- **Line 1698**: `- **Line 169**: `- ✅ Availability = AVAILABLE (always available)```

- **Line 1020** `[HARD_FORBIDDEN]`
  > `- **Line 1708**: `- **Line 264**: `- "guarantee" / "guaranteed"```

- **Line 1021** `[HARD_FORBIDDEN]`
  > `- **Line 1716**: `- **Line 187**: `- guarantee, guaranteed```

- **Line 1022** `[HARD_FORBIDDEN]`
  > `- **Line 1733**: `- **Line 34**: `- Vague promises: `best-in-class`, `industry-leading`, `guarant...`

- **Line 1023** `[SLA_UNQUALIFIED]`
  > `- **Line 1737**: `- **Line 51**: `| **Availability During Updates** | Atlassian platform SLA | Fi...`

- **Line 1024** `[HARD_FORBIDDEN]`
  > `- **Line 1738**: `- **Line 89**: `- Guarantee uptime beyond Atlassian Forge SLA```

- **Line 1024** `[SLA_UNQUALIFIED]`
  > `- **Line 1738**: `- **Line 89**: `- Guarantee uptime beyond Atlassian Forge SLA```

- **Line 1025** `[SLA_UNQUALIFIED]`
  > `- **Line 1739**: `- **Line 93**: `- Promise support SLA beyond "best effort"```

- **Line 1026** `[SLA_UNQUALIFIED]`
  > `- **Line 1740**: `- **Line 161**: `| Uptime SLA | Forge SLA only | Customer's infra SLA | Custome...`

- **Line 1027** `[SLA_UNQUALIFIED]`
  > `- **Line 1741**: `- **Line 174**: `| **Dedicated support SLA** | ⏳ "Best effort" | Escalate to At...`

- **Line 1028** `[SLA_UNQUALIFIED]`
  > `- **Line 1743**: `- **Line 189**: `- Dedicated support SLA```

- **Line 1029** `[HARD_FORBIDDEN]`
  > `- **Line 1747**: `- **Line 3**: `Enterprise-ready commitment table for procurement and security r...`

- **Line 1030** `[SLA_UNQUALIFIED]`
  > `- **Line 1760**: `- **Line 167**: `FirstTry provides **NO SERVICE LEVEL AGREEMENT (SLA)** for pri...`

- **Line 1031** `[SLA_UNQUALIFIED]`
  > `- **Line 1764**: `- **Line 55**: `- **[legal/service-level-agreement.md](legal/service-level-agre...`

- **Line 1033** `[SLA_UNQUALIFIED]`
  > `- **Line 1778**: `- **Line 6**: `- If you cannot meet this SLA, change this document to match rea...`

- **Line 1034** `[SLA_UNQUALIFIED]`
  > `- **Line 1788**: `- **Line 119**: `**"Triage SLA"** = Time from receipt to first maintainer respo...`

- **Line 1035** `[SLA_UNQUALIFIED]`
  > `- **Line 1789**: `- **Line 120**: `**"Fix SLA"** = Time from triage to code fix or documented wor...`

- **Line 1037** `[HARD_FORBIDDEN]`
  > `- **Line 1796**: `- **Line 448**: `- Guaranteed response times```

- **Line 1041** `[SLA_UNQUALIFIED]`
  > `- **Line 1801**: `- **Line 553**: `4. **Post-mortem** — After resolution, we discuss why SLA was ...`

- **Line 1042** `[SLA_UNQUALIFIED]`
  > `- **Line 1806**: `- **Line 514**: `**User says**: "Document our support SLA"```

- **Line 1043** `[SLA_UNQUALIFIED]`
  > `- **Line 1810**: `- **Line 139**: `├── SECURITY_CONTACT.md         ← 2-day response SLA```

- **Line 1044** `[SLA_UNQUALIFIED]`
  > `- **Line 1811**: `- **Line 154**: `| 3 | d5efdf71 | docs(security): security contact SLA | P13 |```

- **Line 1045** `[SLA_UNQUALIFIED]`
  > `- **Line 1812**: `- **Line 186**: `✅ Security contact SLA (P13)```

- **Line 1046** `[SLA_UNQUALIFIED]`
  > `- **Line 1825**: `- **Line 16**: `<li><a href="legal/service-level-agreement.html">Service Level ...`

- **Line 1047** `[SLA_UNQUALIFIED]`
  > `- **Line 1829**: `- **Line 5**: `<h1>Service Level Agreement (SLA)</h1>```

- **Line 1048** `[SLA_UNQUALIFIED]`
  > `- **Line 1831**: `- **Line 46**: `<p>This SLA does not apply to:</p>```

- **Line 1049** `[HARD_FORBIDDEN]`
  > `- **Line 1835**: `- **Line 4**: `and does not constitute a legal SLA or support guarantee. See di...`

- **Line 1050** `[SLA_UNQUALIFIED]`
  > `- **Line 1837**: `- **Line 45**: `This SLA does not apply to:```

- **Line 1051** `[HARD_FORBIDDEN]`
  > `- **Line 1868**: `- **Line 241**: `✅ Safe fallback always available```

- **Line 1052** `[SLA_UNQUALIFIED]`
  > `- **Line 1888**: `- **Line 175**: `"license_key": "acm-sla",```

- **Line 1053** `[SLA_UNQUALIFIED]`
  > `- **Line 1889**: `- **Line 177**: `"spdx_license_key": "LicenseRef-scancode-acm-sla",```

- **Line 1054** `[SLA_UNQUALIFIED]`
  > `- **Line 1890**: `- **Line 181**: `"json": "acm-sla.json",```

- **Line 1055** `[SLA_UNQUALIFIED]`
  > `- **Line 1891**: `- **Line 182**: `"yaml": "acm-sla.yml",```

- **Line 1056** `[SLA_UNQUALIFIED]`
  > `- **Line 1892**: `- **Line 183**: `"html": "acm-sla.html",```

- **Line 1057** `[SLA_UNQUALIFIED]`
  > `- **Line 1893**: `- **Line 184**: `"license": "acm-sla.LICENSE"```

- **Line 1058** `[SLA_UNQUALIFIED]`
  > `- **Line 1894**: `- **Line 271**: `"license_key": "actuate-birt-ihub-ftype-sla",```

- **Line 1059** `[SLA_UNQUALIFIED]`
  > `- **Line 1895**: `- **Line 273**: `"spdx_license_key": "LicenseRef-scancode-actuate-birt-ihub-fty...`

- **Line 1060** `[SLA_UNQUALIFIED]`
  > `- **Line 1896**: `- **Line 277**: `"json": "actuate-birt-ihub-ftype-sla.json",```

- **Line 1061** `[SLA_UNQUALIFIED]`
  > `- **Line 1897**: `- **Line 278**: `"yaml": "actuate-birt-ihub-ftype-sla.yml",```

- **Line 1062** `[SLA_UNQUALIFIED]`
  > `- **Line 1898**: `- **Line 279**: `"html": "actuate-birt-ihub-ftype-sla.html",```

- **Line 1063** `[SLA_UNQUALIFIED]`
  > `- **Line 1899**: `- **Line 280**: `"license": "actuate-birt-ihub-ftype-sla.LICENSE"```

- **Line 1064** `[SLA_UNQUALIFIED]`
  > `- **Line 1900**: `- **Line 777**: `"license_key": "agere-sla",```

- **Line 1065** `[SLA_UNQUALIFIED]`
  > `- **Line 1901**: `- **Line 779**: `"spdx_license_key": "LicenseRef-scancode-agere-sla",```

- **Line 1066** `[SLA_UNQUALIFIED]`
  > `- **Line 1902**: `- **Line 783**: `"json": "agere-sla.json",```

- **Line 1067** `[SLA_UNQUALIFIED]`
  > `- **Line 1903**: `- **Line 784**: `"yaml": "agere-sla.yml",```

- **Line 1068** `[SLA_UNQUALIFIED]`
  > `- **Line 1904**: `- **Line 785**: `"html": "agere-sla.html",```

- **Line 1069** `[SLA_UNQUALIFIED]`
  > `- **Line 1905**: `- **Line 786**: `"license": "agere-sla.LICENSE"```

- **Line 1070** `[SLA_UNQUALIFIED]`
  > `- **Line 1906**: `- **Line 7867**: `"license_key": "duende-sla-2022",```

- **Line 1071** `[SLA_UNQUALIFIED]`
  > `- **Line 1907**: `- **Line 7869**: `"spdx_license_key": "LicenseRef-scancode-duende-sla-2022",```

- **Line 1072** `[SLA_UNQUALIFIED]`
  > `- **Line 1908**: `- **Line 7873**: `"json": "duende-sla-2022.json",```

- **Line 1073** `[SLA_UNQUALIFIED]`
  > `- **Line 1909**: `- **Line 7874**: `"yaml": "duende-sla-2022.yml",```

- **Line 1074** `[SLA_UNQUALIFIED]`
  > `- **Line 1910**: `- **Line 7875**: `"html": "duende-sla-2022.html",```

- **Line 1075** `[SLA_UNQUALIFIED]`
  > `- **Line 1911**: `- **Line 7876**: `"license": "duende-sla-2022.LICENSE"```

- **Line 1076** `[SLA_UNQUALIFIED]`
  > `- **Line 1912**: `- **Line 8651**: `"license_key": "epson-linux-sla-2023",```

- **Line 1077** `[SLA_UNQUALIFIED]`
  > `- **Line 1913**: `- **Line 8653**: `"spdx_license_key": "LicenseRef-scancode-epson-linux-sla-2023...`

- **Line 1078** `[SLA_UNQUALIFIED]`
  > `- **Line 1914**: `- **Line 8657**: `"json": "epson-linux-sla-2023.json",```

- **Line 1079** `[SLA_UNQUALIFIED]`
  > `- **Line 1915**: `- **Line 8658**: `"yaml": "epson-linux-sla-2023.yml",```

- **Line 1080** `[SLA_UNQUALIFIED]`
  > `- **Line 1916**: `- **Line 8659**: `"html": "epson-linux-sla-2023.html",```

- **Line 1081** `[SLA_UNQUALIFIED]`
  > `- **Line 1917**: `- **Line 8660**: `"license": "epson-linux-sla-2023.LICENSE"```

- **Line 1082** `[SLA_UNQUALIFIED]`
  > `- **Line 1918**: `- **Line 11899**: `"license_key": "gradle-enterprise-sla-2022-11-08",```

- **Line 1083** `[SLA_UNQUALIFIED]`
  > `- **Line 1919**: `- **Line 11901**: `"spdx_license_key": "LicenseRef-scancode-gradle-enterprise-s...`

- **Line 1084** `[SLA_UNQUALIFIED]`
  > `- **Line 1920**: `- **Line 11905**: `"json": "gradle-enterprise-sla-2022-11-08.json",```

- **Line 1085** `[SLA_UNQUALIFIED]`
  > `- **Line 1921**: `- **Line 11906**: `"yaml": "gradle-enterprise-sla-2022-11-08.yml",```

- **Line 1086** `[SLA_UNQUALIFIED]`
  > `- **Line 1922**: `- **Line 11907**: `"html": "gradle-enterprise-sla-2022-11-08.html",```

- **Line 1087** `[SLA_UNQUALIFIED]`
  > `- **Line 1923**: `- **Line 11908**: `"license": "gradle-enterprise-sla-2022-11-08.LICENSE"```

- **Line 1088** `[SLA_UNQUALIFIED]`
  > `- **Line 1924**: `- **Line 14320**: `"license_key": "jide-sla",```

- **Line 1089** `[SLA_UNQUALIFIED]`
  > `- **Line 1925**: `- **Line 14322**: `"spdx_license_key": "LicenseRef-scancode-jide-sla",```

- **Line 1090** `[SLA_UNQUALIFIED]`
  > `- **Line 1926**: `- **Line 14326**: `"json": "jide-sla.json",```

- **Line 1091** `[SLA_UNQUALIFIED]`
  > `- **Line 1927**: `- **Line 14327**: `"yaml": "jide-sla.yml",```

- **Line 1092** `[SLA_UNQUALIFIED]`
  > `- **Line 1928**: `- **Line 14328**: `"html": "jide-sla.html",```

- **Line 1093** `[SLA_UNQUALIFIED]`
  > `- **Line 1929**: `- **Line 14329**: `"license": "jide-sla.LICENSE"```

- **Line 1094** `[SLA_UNQUALIFIED]`
  > `- **Line 1930**: `- **Line 18647**: `"license_key": "ms-pre-release-sla-2023",```

- **Line 1095** `[SLA_UNQUALIFIED]`
  > `- **Line 1931**: `- **Line 18649**: `"spdx_license_key": "LicenseRef-scancode-ms-pre-release-sla-...`

- **Line 1096** `[SLA_UNQUALIFIED]`
  > `- **Line 1932**: `- **Line 18653**: `"json": "ms-pre-release-sla-2023.json",```

- **Line 1097** `[SLA_UNQUALIFIED]`
  > `- **Line 1933**: `- **Line 18654**: `"yaml": "ms-pre-release-sla-2023.yml",```

- **Line 1098** `[SLA_UNQUALIFIED]`
  > `- **Line 1934**: `- **Line 18655**: `"html": "ms-pre-release-sla-2023.html",```

- **Line 1099** `[SLA_UNQUALIFIED]`
  > `- **Line 1935**: `- **Line 18656**: `"license": "ms-pre-release-sla-2023.LICENSE"```

- **Line 1100** `[SLA_UNQUALIFIED]`
  > `- **Line 1936**: `- **Line 18827**: `"license_key": "ms-sysinternals-sla",```

- **Line 1101** `[SLA_UNQUALIFIED]`
  > `- **Line 1937**: `- **Line 18829**: `"spdx_license_key": "LicenseRef-scancode-ms-sysinternals-sla...`

- **Line 1102** `[SLA_UNQUALIFIED]`
  > `- **Line 1938**: `- **Line 18833**: `"json": "ms-sysinternals-sla.json",```

- **Line 1103** `[SLA_UNQUALIFIED]`
  > `- **Line 1939**: `- **Line 18834**: `"yaml": "ms-sysinternals-sla.yml",```

- **Line 1104** `[SLA_UNQUALIFIED]`
  > `- **Line 1940**: `- **Line 18835**: `"html": "ms-sysinternals-sla.html",```

- **Line 1105** `[SLA_UNQUALIFIED]`
  > `- **Line 1941**: `- **Line 18836**: `"license": "ms-sysinternals-sla.LICENSE"```

- **Line 1106** `[SLA_UNQUALIFIED]`
  > `- **Line 1942**: `- **Line 20149**: `"license_key": "northwoods-sla-2021",```

- **Line 1107** `[SLA_UNQUALIFIED]`
  > `- **Line 1943**: `- **Line 20151**: `"spdx_license_key": "LicenseRef-scancode-northwoods-sla-2021...`

- **Line 1108** `[SLA_UNQUALIFIED]`
  > `- **Line 1944**: `- **Line 20155**: `"json": "northwoods-sla-2021.json",```

- **Line 1109** `[SLA_UNQUALIFIED]`
  > `- **Line 1945**: `- **Line 20156**: `"yaml": "northwoods-sla-2021.yml",```

- **Line 1110** `[SLA_UNQUALIFIED]`
  > `- **Line 1946**: `- **Line 20157**: `"html": "northwoods-sla-2021.html",```

- **Line 1111** `[SLA_UNQUALIFIED]`
  > `- **Line 1947**: `- **Line 20158**: `"license": "northwoods-sla-2021.LICENSE"```

- **Line 1112** `[SLA_UNQUALIFIED]`
  > `- **Line 1948**: `- **Line 20161**: `"license_key": "northwoods-sla-2024",```

- **Line 1113** `[SLA_UNQUALIFIED]`
  > `- **Line 1949**: `- **Line 20163**: `"spdx_license_key": "LicenseRef-scancode-northwoods-sla-2024...`

- **Line 1114** `[SLA_UNQUALIFIED]`
  > `- **Line 1950**: `- **Line 20167**: `"json": "northwoods-sla-2024.json",```

- **Line 1115** `[SLA_UNQUALIFIED]`
  > `- **Line 1951**: `- **Line 20168**: `"yaml": "northwoods-sla-2024.yml",```

- **Line 1116** `[SLA_UNQUALIFIED]`
  > `- **Line 1952**: `- **Line 20169**: `"html": "northwoods-sla-2024.html",```

- **Line 1117** `[SLA_UNQUALIFIED]`
  > `- **Line 1953**: `- **Line 20170**: `"license": "northwoods-sla-2024.LICENSE"```

- **Line 1118** `[SLA_UNQUALIFIED]`
  > `- **Line 1954**: `- **Line 20501**: `"license_key": "nvidia-nccl-sla-2016",```

- **Line 1119** `[SLA_UNQUALIFIED]`
  > `- **Line 1955**: `- **Line 20503**: `"spdx_license_key": "LicenseRef-scancode-nvidia-nccl-sla-201...`

- **Line 1120** `[SLA_UNQUALIFIED]`
  > `- **Line 1956**: `- **Line 20507**: `"json": "nvidia-nccl-sla-2016.json",```

- **Line 1121** `[SLA_UNQUALIFIED]`
  > `- **Line 1957**: `- **Line 20508**: `"yaml": "nvidia-nccl-sla-2016.yml",```

- **Line 1122** `[SLA_UNQUALIFIED]`
  > `- **Line 1958**: `- **Line 20509**: `"html": "nvidia-nccl-sla-2016.html",```

- **Line 1123** `[SLA_UNQUALIFIED]`
  > `- **Line 1959**: `- **Line 20510**: `"license": "nvidia-nccl-sla-2016.LICENSE"```

- **Line 1124** `[SLA_UNQUALIFIED]`
  > `- **Line 1960**: `- **Line 25655**: `"license_key": "scylladb-sla-1.0",```

- **Line 1125** `[SLA_UNQUALIFIED]`
  > `- **Line 1961**: `- **Line 25657**: `"spdx_license_key": "LicenseRef-scancode-scylladb-sla-1.0",```

- **Line 1126** `[SLA_UNQUALIFIED]`
  > `- **Line 1962**: `- **Line 25661**: `"json": "scylladb-sla-1.0.json",```

- **Line 1127** `[SLA_UNQUALIFIED]`
  > `- **Line 1963**: `- **Line 25662**: `"yaml": "scylladb-sla-1.0.yml",```

- **Line 1128** `[SLA_UNQUALIFIED]`
  > `- **Line 1964**: `- **Line 25663**: `"html": "scylladb-sla-1.0.html",```

- **Line 1129** `[SLA_UNQUALIFIED]`
  > `- **Line 1965**: `- **Line 25664**: `"license": "scylladb-sla-1.0.LICENSE"```

- **Line 1130** `[SLA_UNQUALIFIED]`
  > `- **Line 1966**: `- **Line 26625**: `"license_key": "splunk-sla",```

- **Line 1131** `[SLA_UNQUALIFIED]`
  > `- **Line 1967**: `- **Line 26627**: `"spdx_license_key": "LicenseRef-scancode-splunk-sla",```

- **Line 1132** `[SLA_UNQUALIFIED]`
  > `- **Line 1968**: `- **Line 26631**: `"json": "splunk-sla.json",```

- **Line 1133** `[SLA_UNQUALIFIED]`
  > `- **Line 1969**: `- **Line 26632**: `"yaml": "splunk-sla.yml",```

- **Line 1134** `[SLA_UNQUALIFIED]`
  > `- **Line 1970**: `- **Line 26633**: `"html": "splunk-sla.html",```

- **Line 1135** `[SLA_UNQUALIFIED]`
  > `- **Line 1971**: `- **Line 26634**: `"license": "splunk-sla.LICENSE"```

- **Line 1136** `[SLA_UNQUALIFIED]`
  > `- **Line 1972**: `- **Line 27913**: `"license_key": "tanuki-community-sla-1.0",```

- **Line 1137** `[SLA_UNQUALIFIED]`
  > `- **Line 1973**: `- **Line 27915**: `"spdx_license_key": "LicenseRef-scancode-tanuki-community-sl...`

- **Line 1138** `[SLA_UNQUALIFIED]`
  > `- **Line 1974**: `- **Line 27919**: `"json": "tanuki-community-sla-1.0.json",```

- **Line 1139** `[SLA_UNQUALIFIED]`
  > `- **Line 1975**: `- **Line 27920**: `"yaml": "tanuki-community-sla-1.0.yml",```

- **Line 1140** `[SLA_UNQUALIFIED]`
  > `- **Line 1976**: `- **Line 27921**: `"html": "tanuki-community-sla-1.0.html",```

- **Line 1141** `[SLA_UNQUALIFIED]`
  > `- **Line 1977**: `- **Line 27922**: `"license": "tanuki-community-sla-1.0.LICENSE"```

- **Line 1142** `[SLA_UNQUALIFIED]`
  > `- **Line 1978**: `- **Line 27925**: `"license_key": "tanuki-community-sla-1.1",```

- **Line 1143** `[SLA_UNQUALIFIED]`
  > `- **Line 1979**: `- **Line 27927**: `"spdx_license_key": "LicenseRef-scancode-tanuki-community-sl...`

- **Line 1144** `[SLA_UNQUALIFIED]`
  > `- **Line 1980**: `- **Line 27931**: `"json": "tanuki-community-sla-1.1.json",```

- **Line 1145** `[SLA_UNQUALIFIED]`
  > `- **Line 1981**: `- **Line 27932**: `"yaml": "tanuki-community-sla-1.1.yml",```

- **Line 1146** `[SLA_UNQUALIFIED]`
  > `- **Line 1982**: `- **Line 27933**: `"html": "tanuki-community-sla-1.1.html",```

- **Line 1147** `[SLA_UNQUALIFIED]`
  > `- **Line 1983**: `- **Line 27934**: `"license": "tanuki-community-sla-1.1.LICENSE"```

- **Line 1148** `[SLA_UNQUALIFIED]`
  > `- **Line 1984**: `- **Line 27937**: `"license_key": "tanuki-community-sla-1.2",```

- **Line 1149** `[SLA_UNQUALIFIED]`
  > `- **Line 1985**: `- **Line 27939**: `"spdx_license_key": "LicenseRef-scancode-tanuki-community-sl...`

- **Line 1150** `[SLA_UNQUALIFIED]`
  > `- **Line 1986**: `- **Line 27943**: `"json": "tanuki-community-sla-1.2.json",```

- **Line 1151** `[SLA_UNQUALIFIED]`
  > `- **Line 1987**: `- **Line 27944**: `"yaml": "tanuki-community-sla-1.2.yml",```

- **Line 1152** `[SLA_UNQUALIFIED]`
  > `- **Line 1988**: `- **Line 27945**: `"html": "tanuki-community-sla-1.2.html",```

- **Line 1153** `[SLA_UNQUALIFIED]`
  > `- **Line 1989**: `- **Line 27946**: `"license": "tanuki-community-sla-1.2.LICENSE"```

- **Line 1154** `[SLA_UNQUALIFIED]`
  > `- **Line 1990**: `- **Line 27949**: `"license_key": "tanuki-community-sla-1.3",```

- **Line 1155** `[SLA_UNQUALIFIED]`
  > `- **Line 1991**: `- **Line 27951**: `"spdx_license_key": "LicenseRef-scancode-tanuki-community-sl...`

- **Line 1156** `[SLA_UNQUALIFIED]`
  > `- **Line 1992**: `- **Line 27955**: `"json": "tanuki-community-sla-1.3.json",```

- **Line 1157** `[SLA_UNQUALIFIED]`
  > `- **Line 1993**: `- **Line 27956**: `"yaml": "tanuki-community-sla-1.3.yml",```

- **Line 1158** `[SLA_UNQUALIFIED]`
  > `- **Line 1994**: `- **Line 27957**: `"html": "tanuki-community-sla-1.3.html",```

- **Line 1159** `[SLA_UNQUALIFIED]`
  > `- **Line 1995**: `- **Line 27958**: `"license": "tanuki-community-sla-1.3.LICENSE"```

- **Line 1160** `[SLA_UNQUALIFIED]`
  > `- **Line 1996**: `- **Line 29446**: `"license_key": "vanderbilt-sla-1.0",```

- **Line 1161** `[SLA_UNQUALIFIED]`
  > `- **Line 1997**: `- **Line 29448**: `"spdx_license_key": "LicenseRef-scancode-vanderbilt-sla-1.0",```

- **Line 1162** `[SLA_UNQUALIFIED]`
  > `- **Line 1998**: `- **Line 29452**: `"json": "vanderbilt-sla-1.0.json",```

- **Line 1163** `[SLA_UNQUALIFIED]`
  > `- **Line 1999**: `- **Line 29453**: `"yaml": "vanderbilt-sla-1.0.yml",```

- **Line 1164** `[SLA_UNQUALIFIED]`
  > `- **Line 2000**: `- **Line 29454**: `"html": "vanderbilt-sla-1.0.html",```

- **Line 1165** `[SLA_UNQUALIFIED]`
  > `- **Line 2001**: `- **Line 29455**: `"license": "vanderbilt-sla-1.0.LICENSE"```

- **Line 1166** `[HARD_FORBIDDEN]`
  > `- **Line 2006**: `- **Line 21**: `but in Python 3.7+ order of dictionaries is guaranteed.```

- **Line 1167** `[HARD_FORBIDDEN]`
  > `- **Line 2010**: `- **Line 16**: `- Guaranteed compatibility with remote Codespaces.```

- **Line 1171** `[HARD_FORBIDDEN]`
  > `- **Line 13**: `- ❌ "guaranteed uptime" (unqualified) → **NOT FOUND**``

- **Line 1172** `[HARD_FORBIDDEN]`
  > `- **Line 14**: `- ❌ "guaranteed response" (unqualified) → **NOT FOUND**``

- **Line 1173** `[HARD_FORBIDDEN]`
  > `- **Line 15**: `- ❌ "guaranteed SLA" (unqualified) → **NOT FOUND**``

- **Line 1173** `[SLA_UNQUALIFIED]`
  > `- **Line 15**: `- ❌ "guaranteed SLA" (unqualified) → **NOT FOUND**``

- **Line 1175** `[HARD_FORBIDDEN]`
  > `- **Line 17**: `- ❌ "mission-critical" (without scoping) → **NOT FOUND**``

- **Line 1176** `[HARD_FORBIDDEN]`
  > `- **Line 18**: `- ❌ "enterprise-ready" (without disclaimer) → **NOT FOUND**``

- **Line 1177** `[HARD_FORBIDDEN]`
  > `- **Line 28**: `| "**NO** guaranteed response times, and **no** uptime guarantees" | docs/SUPPORT...`

- **Line 1178** `[HARD_FORBIDDEN]`
  > `- **Line 29**: `| "**no** guaranteed response timeframe" | docs/PRIVACY.md:168 | ✅ QUALIFIED |``

- **Line 1179** `[HARD_FORBIDDEN]`
  > `- **Line 30**: `| "**no** guaranteed response times" | docs/SECURITY.md:38 | ✅ QUALIFIED |``

- **Line 1180** `[HARD_FORBIDDEN]`
  > `- **Line 31**: `| "**no** guaranteed response times, escalation SLAs, **or** uptime guarantees" |...`

- **Line 1181** `[HARD_FORBIDDEN]`
  > `- **Line 32**: `| "**no** guaranteed SLA" | atlassian/forge-app/docs/SUPPORT.md:27 | ✅ QUALIFIED |``

- **Line 1181** `[SLA_UNQUALIFIED]`
  > `- **Line 32**: `| "**no** guaranteed SLA" | atlassian/forge-app/docs/SUPPORT.md:27 | ✅ QUALIFIED |``

- **Line 1182** `[HARD_FORBIDDEN]`
  > `- **Line 41**: `- ✅ No unqualified uptime guarantees``

- **Line 1183** `[SLA_UNQUALIFIED]`
  > `- **Line 65**: `- ✅ No implication of automatic SLA-like response``

- **Line 1184** `[HARD_FORBIDDEN]`
  > `- **Line 73**: `- ✅ No "enterprise-ready" claims``

- **Line 1185** `[HARD_FORBIDDEN]`
  > `- **Line 74**: `- ✅ No "mission-critical" positioning``

- **Line 1186** `[SLA_UNQUALIFIED]`
  > `- **Line 97**: `- ✅ No vulnerability response SLA promises``

- **Line 1187** `[SLA_UNQUALIFIED]`
  > `- **Line 128**: `4. ✅ PRIVACY.md SLA ambiguity → Added explicit NO-SLA section (PHASE 8)``

- **Line 1188** `[SLA_UNQUALIFIED]`
  > `- **Line 130**: `6. ✅ SUPPORT.md missing NO-SLA → Added prominent disclaimer (PHASE 8)``

- **Line 1189** `[SLA_UNQUALIFIED]`
  > `- **Line 131**: `7. ✅ SUPPORT_POLICY.md inconsistent → Standardized NO-SLA language (PHASE 8)``

- **Line 1190** `[HARD_FORBIDDEN]`
  > `- **Line 167**: `**Question**: Can FirstTry be safely submitted to Atlassian Marketplace without ...`

- **Line 1190** `[SLA_UNQUALIFIED]`
  > `- **Line 167**: `**Question**: Can FirstTry be safely submitted to Atlassian Marketplace without ...`

- **Line 1194** `[HARD_FORBIDDEN]`
  > `- **Line 297**: `ALWAYS AVAILABLE (even if no missing data recorded)``

- **Line 1195** `[HARD_FORBIDDEN]`
  > `- **Line 312**: `- Always available if snapshot exists``

- **Line 1196** `[HARD_FORBIDDEN]`
  > `- **Line 338**: `| M5 | (always available) |``

- **Line 1200** `[HARD_FORBIDDEN]`
  > `- **Line 169**: `- ✅ Availability = AVAILABLE (always available)``

- **Line 1204** `[HARD_FORBIDDEN]`
  > `- **Line 264**: `- "guarantee" / "guaranteed"``

- **Line 1208** `[HARD_FORBIDDEN]`
  > `- **Line 187**: `- guarantee, guaranteed``

- **Line 1212** `[HARD_FORBIDDEN]`
  > `- **Line 34**: `- Vague promises: `best-in-class`, `industry-leading`, `guaranteed` (without evid...`

- **Line 1216** `[SLA_UNQUALIFIED]`
  > `- **Line 51**: `| **Availability During Updates** | Atlassian platform SLA | FirstTry available b...`

- **Line 1217** `[HARD_FORBIDDEN]`
  > `- **Line 89**: `- Guarantee uptime beyond Atlassian Forge SLA``

- **Line 1217** `[SLA_UNQUALIFIED]`
  > `- **Line 89**: `- Guarantee uptime beyond Atlassian Forge SLA``

- **Line 1218** `[SLA_UNQUALIFIED]`
  > `- **Line 93**: `- Promise support SLA beyond "best effort"``

- **Line 1219** `[SLA_UNQUALIFIED]`
  > `- **Line 161**: `| Uptime SLA | Forge SLA only | Customer's infra SLA | Customer's infra SLA |``

- **Line 1220** `[SLA_UNQUALIFIED]`
  > `- **Line 174**: `| **Dedicated support SLA** | ⏳ "Best effort" | Escalate to Atlassian support vi...`

- **Line 1221** `[SLA_UNQUALIFIED]`
  > `- **Line 189**: `- Dedicated support SLA``

- **Line 1225** `[HARD_FORBIDDEN]`
  > `- **Line 3**: `Enterprise-ready commitment table for procurement and security review.``

- **Line 1229** `[SLA_UNQUALIFIED]`
  > `- **Line 167**: `FirstTry provides **NO SERVICE LEVEL AGREEMENT (SLA)** for privacy or data handl...`

- **Line 1233** `[SLA_UNQUALIFIED]`
  > `- **Line 55**: `- **[legal/service-level-agreement.md](legal/service-level-agreement.md)** — SLA ...`

- **Line 1237** `[SLA_UNQUALIFIED]`
  > `- **Line 5**: `- Expected response: acknowledge within 2 business days (or update to your real SL...`

- **Line 1238** `[SLA_UNQUALIFIED]`
  > `- **Line 6**: `- If you cannot meet this SLA, change this document to match reality.``

- **Line 1242** `[SLA_UNQUALIFIED]`
  > `- **Line 119**: `**"Triage SLA"** = Time from receipt to first maintainer response (acknowledgmen...`

- **Line 1243** `[SLA_UNQUALIFIED]`
  > `- **Line 120**: `**"Fix SLA"** = Time from triage to code fix or documented workaround (not neces...`

- **Line 1245** `[HARD_FORBIDDEN]`
  > `- **Line 448**: `- Guaranteed response times``

- **Line 1249** `[SLA_UNQUALIFIED]`
  > `- **Line 553**: `4. **Post-mortem** — After resolution, we discuss why SLA was missed``

- **Line 1253** `[SLA_UNQUALIFIED]`
  > `- **Line 16**: `<li><a href="legal/service-level-agreement.html">Service Level Agreement (SLA)</a...`

- **Line 1257** `[SLA_UNQUALIFIED]`
  > `- **Line 5**: `<h1>Service Level Agreement (SLA)</h1>``

- **Line 1259** `[SLA_UNQUALIFIED]`
  > `- **Line 46**: `<p>This SLA does not apply to:</p>``

- **Line 1263** `[HARD_FORBIDDEN]`
  > `- **Line 4**: `and does not constitute a legal SLA or support guarantee. See disclaimers below.``

- **Line 1265** `[SLA_UNQUALIFIED]`
  > `- **Line 45**: `This SLA does not apply to:``

- **Line 1269** `[HARD_FORBIDDEN]`
  > `- **Line 241**: `✅ Safe fallback always available``

- **Line 1273** `[HARD_FORBIDDEN]`
  > `- **Line 16**: `- Guaranteed compatibility with remote Codespaces.``

## docs/PHASE9_MARKETPLACE_SAFETY_VERIFICATION.md

- **Line 13** `[HARD_FORBIDDEN]`
  > `- ❌ "guaranteed uptime" (unqualified) → **NOT FOUND**`

- **Line 14** `[HARD_FORBIDDEN]`
  > `- ❌ "guaranteed response" (unqualified) → **NOT FOUND**`

- **Line 15** `[HARD_FORBIDDEN]`
  > `- ❌ "guaranteed SLA" (unqualified) → **NOT FOUND**`

- **Line 15** `[SLA_UNQUALIFIED]`
  > `- ❌ "guaranteed SLA" (unqualified) → **NOT FOUND**`

- **Line 17** `[HARD_FORBIDDEN]`
  > `- ❌ "mission-critical" (without scoping) → **NOT FOUND**`

- **Line 18** `[HARD_FORBIDDEN]`
  > `- ❌ "enterprise-ready" (without disclaimer) → **NOT FOUND**`

- **Line 24** `[HARD_FORBIDDEN]`
  > `All claims with "guarantee" or "uptime" found are **explicitly qualified**:`

- **Line 28** `[HARD_FORBIDDEN]`
  > `| "**NO** guaranteed response times, and **no** uptime guarantees" | docs/SUPPORT.md:3 | ✅ QUALIF...`

- **Line 29** `[HARD_FORBIDDEN]`
  > `| "**no** guaranteed response timeframe" | docs/PRIVACY.md:168 | ✅ QUALIFIED |`

- **Line 30** `[HARD_FORBIDDEN]`
  > `| "**no** guaranteed response times" | docs/SECURITY.md:38 | ✅ QUALIFIED |`

- **Line 31** `[HARD_FORBIDDEN]`
  > `| "**no** guaranteed response times, escalation SLAs, **or** uptime guarantees" | docs/SUPPORT_PO...`

- **Line 32** `[HARD_FORBIDDEN]`
  > `| "**no** guaranteed SLA" | atlassian/forge-app/docs/SUPPORT.md:27 | ✅ QUALIFIED |`

- **Line 32** `[SLA_UNQUALIFIED]`
  > `| "**no** guaranteed SLA" | atlassian/forge-app/docs/SUPPORT.md:27 | ✅ QUALIFIED |`

- **Line 33** `[HARD_FORBIDDEN]`
  > `| "**This does not imply** automated escalation **or** guaranteed response" | atlassian/forge-app...`

- **Line 39** `[HARD_FORBIDDEN]`
  > `### ✅ SLA & Uptime Guarantees`

- **Line 39** `[SLA_UNQUALIFIED]`
  > `### ✅ SLA & Uptime Guarantees`

- **Line 41** `[HARD_FORBIDDEN]`
  > `- ✅ No unqualified uptime guarantees`

- **Line 52** `[HARD_FORBIDDEN]`
  > `- ✅ No guaranteed response times`

- **Line 65** `[SLA_UNQUALIFIED]`
  > `- ✅ No implication of automatic SLA-like response`

- **Line 73** `[HARD_FORBIDDEN]`
  > `- ✅ No "enterprise-ready" claims`

- **Line 74** `[HARD_FORBIDDEN]`
  > `- ✅ No "mission-critical" positioning`

- **Line 84** `[SLA_UNQUALIFIED]`
  > `- ✅ Privacy policy includes SLA disclaimer (added Phase 8)`

- **Line 85** `[HARD_FORBIDDEN]`
  > `- ✅ No guarantee of data processing timelines`

- **Line 97** `[SLA_UNQUALIFIED]`
  > `- ✅ No vulnerability response SLA promises`

- **Line 98** `[HARD_FORBIDDEN]`
  > `- ✅ Explicitly scoped to Forge platform guarantees`

- **Line 118** `[SLA_UNQUALIFIED]`
  > `**Result**: All 7 P0 docs now consistently declare NO-SLA status ✅`

- **Line 128** `[SLA_UNQUALIFIED]`
  > `4. ✅ PRIVACY.md SLA ambiguity → Added explicit NO-SLA section (PHASE 8)`

- **Line 130** `[SLA_UNQUALIFIED]`
  > `6. ✅ SUPPORT.md missing NO-SLA → Added prominent disclaimer (PHASE 8)`

- **Line 131** `[SLA_UNQUALIFIED]`
  > `7. ✅ SUPPORT_POLICY.md inconsistent → Standardized NO-SLA language (PHASE 8)`

- **Line 167** `[HARD_FORBIDDEN]`
  > `**Question**: Can FirstTry be safely submitted to Atlassian Marketplace without SLA/guarantee risk?`

- **Line 167** `[SLA_UNQUALIFIED]`
  > `**Question**: Can FirstTry be safely submitted to Atlassian Marketplace without SLA/guarantee risk?`

- **Line 172** `[HARD_FORBIDDEN]`
  > `- Zero unqualified guarantee claims found`

- **Line 187** `[HARD_FORBIDDEN]`
  > `- Pattern-based detection: SLA, guarantee, automatic escalation, enterprise-ready, mission-critic...`

- **Line 187** `[HARD_FORBIDDEN]`
  > `- Pattern-based detection: SLA, guarantee, automatic escalation, enterprise-ready, mission-critic...`

- **Line 187** `[HARD_FORBIDDEN]`
  > `- Pattern-based detection: SLA, guarantee, automatic escalation, enterprise-ready, mission-critic...`

- **Line 187** `[SLA_UNQUALIFIED]`
  > `- Pattern-based detection: SLA, guarantee, automatic escalation, enterprise-ready, mission-critic...`

- **Line 192** `[SLA_UNQUALIFIED]`
  > `- Files with SLA references: 111 (all properly context-marked or in documentation sections)`

- **Line 199** `[SLA_UNQUALIFIED]`
  > `**Key Finding**: All SLA language is either:`

- **Line 207** `[SLA_UNQUALIFIED]`
  > `- Justification: Necessary to remove unqualified SLA language`

## docs/PHASE_6_V2_SCOPE_EXPANSION_REQUIRED.md

- **Line 310** `[HARD_FORBIDDEN]`
  > `**Unknown:** How should array ordering be handled in canonical JSON? Which fields are guaranteed ...`

- **Line 322** `[HARD_FORBIDDEN]`
  > `**Impact:** Affects hash algorithm and determinism guarantees.`

## docs/PHASE_6_V2_STAGED_PLAN.md

- **Line 62** `[HARD_FORBIDDEN]`
  > `- ✅ Idempotency guarantees`

## docs/PHASE_8_V2_SPEC.md

- **Line 297** `[HARD_FORBIDDEN]`
  > `ALWAYS AVAILABLE (even if no missing data recorded)`

- **Line 312** `[HARD_FORBIDDEN]`
  > `- Always available if snapshot exists`

- **Line 338** `[HARD_FORBIDDEN]`
  > `| M5 | (always available) |`

- **Line 366** `[HARD_FORBIDDEN]`
  > `- Hash guarantees: deterministic reproducibility, immutability detection`

## docs/PHASE_8_V2_TESTPLAN.md

- **Line 169** `[HARD_FORBIDDEN]`
  > `- ✅ Availability = AVAILABLE (always available)`

## docs/PHASE_9_5A_FINAL_VERIFICATION.md

- **Line 78** `[HARD_FORBIDDEN]`
  > `- ❌ guarantee (as false promise)`

- **Line 255** `[HARD_FORBIDDEN]`
  > `grep -i "improve\|recommend\|fix\|prevent\|root cause\|impact\|combined score\|health score\|pred...`

## docs/PHASE_9_5A_SPEC.md

- **Line 109** `[HARD_FORBIDDEN]`
  > `### Immutability Guarantee`

## docs/PHASE_9_V2_DELIVERY.md

- **Line 64** `[HARD_FORBIDDEN]`
  > `- Detects 11 forbidden terms: recommend, fix, prevent, root cause, impact, improve, combined scor...`

- **Line 81** `[HARD_FORBIDDEN]`
  > `- Read-only guarantees`

- **Line 95** `[HARD_FORBIDDEN]`
  > `- Tests for forbidden terms (recommend, fix, prevent, root cause, impact, improve, combined score...`

- **Line 145** `[HARD_FORBIDDEN]`
  > `- Read-only guarantees (no modifications possible)`

- **Line 264** `[HARD_FORBIDDEN]`
  > `- "guarantee" / "guaranteed"`

- **Line 294** `[HARD_FORBIDDEN]`
  > `- Read-only guarantees`

- **Line 309** `[HARD_FORBIDDEN]`
  > `- Read-only guarantees`

- **Line 317** `[HARD_FORBIDDEN]`
  > `## Hard Guarantees (Non-Negotiable)`

- **Line 377** `[HARD_FORBIDDEN]`
  > `- Read-only guarantees enforced`

- **Line 585** `[HARD_FORBIDDEN]`
  > `Every guarantee is enforced at build time.`

## docs/PHASE_9_V2_FINAL_VERIFICATION.md

- **Line 149** `[HARD_FORBIDDEN]`
  > `## Core Guarantees (Enforced)`

- **Line 187** `[HARD_FORBIDDEN]`
  > `- guarantee, guaranteed`

- **Line 222** `[HARD_FORBIDDEN]`
  > `- Read-only guarantees`

- **Line 259** `[HARD_FORBIDDEN]`
  > `❌ "We guarantee no issues"             → detect "guarantee"`

- **Line 323** `[HARD_FORBIDDEN]`
  > `- ❌ Guarantee claims`

- **Line 340** `[HARD_FORBIDDEN]`
  > `- ✅ Read-only guarantees (5 items)`

- **Line 352** `[HARD_FORBIDDEN]`
  > `- ✅ Guarantee statement`

- **Line 361** `[HARD_FORBIDDEN]`
  > `## Canonicalization Guarantees`

- **Line 363** `[HARD_FORBIDDEN]`
  > `All of these are guaranteed by spec and verified by tests:`

## docs/PHASE_9_V2_SPEC.md

- **Line 61** `[HARD_FORBIDDEN]`
  > `- Read-only guarantees`

- **Line 113** `[HARD_FORBIDDEN]`
  > `- Read-only guarantees`

- **Line 178** `[HARD_FORBIDDEN]`
  > `- Guarantees: "We guarantee no issues"`

- **Line 215** `[HARD_FORBIDDEN]`
  > `- Read-only guarantees are true`

- **Line 386** `[HARD_FORBIDDEN]`
  > `## Non-Negotiable Guarantees`

## docs/PLACEHOLDERS_POLICY.md

- **Line 34** `[HARD_FORBIDDEN]`
  > `- Vague promises: `best-in-class`, `industry-leading`, `guaranteed` (without evidence)`

## docs/PLATFORM_DEPENDENCIES.md

- **Line 51** `[SLA_UNQUALIFIED]`
  > `| **Availability During Updates** | Atlassian platform SLA | FirstTry available based on Forge up...`

- **Line 89** `[HARD_FORBIDDEN]`
  > `- Guarantee uptime beyond Atlassian Forge SLA`

- **Line 89** `[SLA_UNQUALIFIED]`
  > `- Guarantee uptime beyond Atlassian Forge SLA`

- **Line 93** `[SLA_UNQUALIFIED]`
  > `- Promise support SLA beyond "best effort"`

- **Line 161** `[SLA_UNQUALIFIED]`
  > `| Uptime SLA | Forge SLA only | Customer's infra SLA | Customer's infra SLA |`

- **Line 174** `[SLA_UNQUALIFIED]`
  > `| **Dedicated support SLA** | ⏳ "Best effort" | Escalate to Atlassian support via Jira Cloud plan |`

- **Line 188** `[HARD_FORBIDDEN]`
  > `- Data residency guarantees outside US/EU`

- **Line 189** `[SLA_UNQUALIFIED]`
  > `- Dedicated support SLA`

## docs/PRICING_GUARANTEES.md

- **Line 1** `[HARD_FORBIDDEN]`
  > `# PRICING GUARANTEES (Phase P7)`

- **Line 3** `[HARD_FORBIDDEN]`
  > `Enterprise-ready commitment table for procurement and security review.`

- **Line 31** `[HARD_FORBIDDEN]`
  > `## Ungated Guarantees (NEVER Affected by Plan)`

- **Line 154** `[HARD_FORBIDDEN]`
  > `| Promise | Guarantee |`

- **Line 167** `[HARD_FORBIDDEN]`
  > `| Promise | Guarantee |`

- **Line 179** `[HARD_FORBIDDEN]`
  > `| Promise | Guarantee |`

- **Line 185** `[HARD_FORBIDDEN]`
  > `| "Can I regenerate with old rulesets?" | ✅ Yes, P6 pinning guarantees exact precision |`

## docs/PRICING_RATIONALE.md

- **Line 80** `[HARD_FORBIDDEN]`
  > `- **This document does NOT define Forge billing rates or pricing formulas**: Actual Forge costs a...`

- **Line 101** `[HARD_FORBIDDEN]`
  > `**Document Version**: 2.0 | **Updated**: 2026-01-11 | **Status**: Enterprise-Grade | **Compliance...`

## docs/PRIVACY.md

- **Line 165** `[SLA_UNQUALIFIED]`
  > `## Support Model & SLA Status`

- **Line 167** `[SLA_UNQUALIFIED]`
  > `FirstTry provides **NO SERVICE LEVEL AGREEMENT (SLA)** for privacy or data handling.`

- **Line 168** `[HARD_FORBIDDEN]`
  > `- **Response Time**: Best effort (no guaranteed response timeframe)`

## docs/README.md

- **Line 48** `[SLA_UNQUALIFIED]`
  > `- **[SUPPORT_POLICY.md](SUPPORT_POLICY.md)** — Support model and no-SLA disclaimer`

- **Line 55** `[SLA_UNQUALIFIED]`
  > `- **[legal/service-level-agreement.md](legal/service-level-agreement.md)** — SLA and support time...`

- **Line 140** `[HARD_FORBIDDEN]`
  > `2. **Evidence-Backed Claims** — Every claim is anchored to code, tests, or Forge platform guarantees`

- **Line 141** `[HARD_FORBIDDEN]`
  > `3. **No False Promises** — We avoid terms like "guarantee," "always," "never" without absolute proof`

## docs/ROI_JUSTIFICATION.md

- **Line 37** `[HARD_FORBIDDEN]`
  > `Consider an organization with 12 release cycles annually. Manual governance readiness verificatio...`

- **Line 59** `[HARD_FORBIDDEN]`
  > `- **Operational ROI Is Variable**: Organizations realize governance automation benefits through r...`

- **Line 86** `[HARD_FORBIDDEN]`
  > `- **This analysis does NOT provide numeric ROI guarantees**: This document provides an illustrati...`

## docs/SECURITY.md

- **Line 38** `[HARD_FORBIDDEN]`
  > `**Note**: Targets, not SLAs. FirstTry provides best-effort support with no guaranteed response ti...`

## docs/SECURITY_CONTACT.md

- **Line 5** `[SLA_UNQUALIFIED]`
  > `- Expected response: acknowledge within 2 business days (or update to your real SLA).`

- **Line 6** `[SLA_UNQUALIFIED]`
  > `- If you cannot meet this SLA, change this document to match reality.`

## docs/SHAKEDOWN.md

- **Line 7** `[HARD_FORBIDDEN]`
  > `**Key guarantee**: Shakedown can be run 10, 100, or 1000 times with identical results. Determinis...`

- **Line 184** `[HARD_FORBIDDEN]`
  > `## Determinism Guarantee`

## docs/SUPPORT.md

- **Line 3** `[HARD_FORBIDDEN]`
  > `⚠️ **IMPORTANT**: FirstTry provides **NO SERVICE LEVEL AGREEMENT** (SLA), no guaranteed response ...`

## docs/SUPPORT_POLICY.md

- **Line 3** `[HARD_FORBIDDEN]`
  > `⚠️ **NO SERVICE LEVEL AGREEMENT**: FirstTry provides support on a best-effort basis with no guara...`

## docs/SUPPORT_RUNBOOK.md

- **Line 15** `[SLA_UNQUALIFIED]`
  > `- ✅ SLA clock definition (when timer starts)`

- **Line 19** `[HARD_FORBIDDEN]`
  > `- ✅ Operating mode: **best-effort**, not guaranteed SLAs`

- **Line 95** `[SLA_UNQUALIFIED]`
  > `**Severity** determines SLA clock and escalation trigger. Requestor may suggest; maintainer makes...`

- **Line 99** `[SLA_UNQUALIFIED]`
  > `| Severity | Name | Criteria | SLA Triage | SLA Fix | Example |`

- **Line 108** `[SLA_UNQUALIFIED]`
  > `## 3. SLA Clock Definition`

- **Line 110** `[SLA_UNQUALIFIED]`
  > `### When SLA Timer Starts`

- **Line 112** `[SLA_UNQUALIFIED]`
  > `**SLA timer starts when**:`

- **Line 117** `[SLA_UNQUALIFIED]`
  > `### What SLA Clock Measures`

- **Line 119** `[SLA_UNQUALIFIED]`
  > `**"Triage SLA"** = Time from receipt to first maintainer response (acknowledgment + severity asse...`

- **Line 120** `[SLA_UNQUALIFIED]`
  > `**"Fix SLA"** = Time from triage to code fix or documented workaround (not necessarily released)`

- **Line 122** `[SLA_UNQUALIFIED]`
  > `### What SLA Clock Does NOT Cover`

- **Line 130** `[SLA_UNQUALIFIED]`
  > `### SLA Suspension`

- **Line 132** `[SLA_UNQUALIFIED]`
  > `SLA clock **pauses** if:`

- **Line 421** `[HARD_FORBIDDEN]`
  > `## 7. Operating Mode: Best-Effort, No Guaranteed SLAs`

- **Line 431** `[HARD_FORBIDDEN]`
  > `- ❌ We do NOT guarantee response times`

- **Line 432** `[HARD_FORBIDDEN]`
  > `- ❌ We do NOT guarantee fixes within specific timeframes`

- **Line 436** `[HARD_FORBIDDEN]`
  > `### SLA Targets (NOT Guarantees)`

- **Line 448** `[HARD_FORBIDDEN]`
  > `- Guaranteed response times`

- **Line 530** `[SLA_UNQUALIFIED]`
  > `## 9. SLA Breach & Escalation Process`

- **Line 553** `[SLA_UNQUALIFIED]`
  > `4. **Post-mortem** — After resolution, we discuss why SLA was missed`

## docs/TERMS.md

- **Line 30** `[HARD_FORBIDDEN]`
  > `- ❌ NOT guaranteed to detect all drift`

## docs/audit_reports/COPILOT_ENFORCEMENT_PROMPT.md

- **Line 62** `[HARD_FORBIDDEN]`
  > `- Support guarantees must be "best-effort" not "guaranteed"`

- **Line 338** `[HARD_FORBIDDEN]`
  > `- Removing previously established guarantees`

- **Line 489** `[HARD_FORBIDDEN]`
  > `Support is best-effort. FirstTry makes no guarantee of response time.`

- **Line 514** `[SLA_UNQUALIFIED]`
  > `**User says**: "Document our support SLA"`

- **Line 515** `[HARD_FORBIDDEN]`
  > `**No SLA defined**: "STOP: No SLA currently defined. Should support be 'best-effort' or guarantee...`

## docs/audit_reports/DOCS_AUDIT_REPORT.md

- **Line 63** `[HARD_FORBIDDEN]`
  > `- "guarantee", "always", "never", "100%", "SOC 2", "ISO 27001", "HIPAA" — all flagged and reviewed`

- **Line 65** `[HARD_FORBIDDEN]`
  > `- Disclaimer notes: "FirstTry inherits Atlassian/Forge platform guarantees"`

## docs/audit_reports/P18_FINAL_PROOF_SUMMARY.md

- **Line 139** `[SLA_UNQUALIFIED]`
  > `├── SECURITY_CONTACT.md         ← 2-day response SLA`

- **Line 154** `[SLA_UNQUALIFIED]`
  > `| 3 | d5efdf71 | docs(security): security contact SLA | P13 |`

- **Line 186** `[SLA_UNQUALIFIED]`
  > `✅ Security contact SLA (P13)`

## docs/audit_reports/RUNTIME_PROOF.md

- **Line 3** `[HARD_FORBIDDEN]`
  > `**Purpose**: Provide a reproducible, anonymized runtime proof artifact demonstrating FirstTry's r...`

- **Line 135** `[HARD_FORBIDDEN]`
  > `**Why this proves the guarantee**:`

- **Line 160** `[HARD_FORBIDDEN]`
  > `**Why this proves the guarantee**:`

- **Line 180** `[HARD_FORBIDDEN]`
  > `**Why this proves the guarantee**:`

- **Line 217** `[HARD_FORBIDDEN]`
  > `| `immutabilityProof` | UUID-based immutability guarantee | eventUUID prevents overwrites |`

- **Line 398** `[HARD_FORBIDDEN]`
  > `## Security Guarantees Proven`

- **Line 400** `[HARD_FORBIDDEN]`
  > `| Guarantee | Proven By | Evidence |`

## docs/evidence/20260113T131842Z_6ca63141/NOTE_LEGACY_WORDING.md

- **Line 8** `[HARD_FORBIDDEN]`
  > `- Current position: we only claim **"Tenant isolation guard passed (code-level static checks)"**,...`

## docs/index.html

- **Line 16** `[SLA_UNQUALIFIED]`
  > `<li><a href="legal/service-level-agreement.html">Service Level Agreement (SLA)</a></li>`

## docs/licensing.md

- **Line 55** `[HARD_FORBIDDEN]`
  > `- We guarantee that:`

- **Line 61** `[HARD_FORBIDDEN]`
  > `- We do NOT guarantee:`

## docs/terms.html

- **Line 114** `[HARD_FORBIDDEN]`
  > `<li><strong>No Warranty of Fitness:</strong> No guarantee that the App meets your specific requir...`

- **Line 115** `[HARD_FORBIDDEN]`
  > `<li><strong>No Warranty of Availability:</strong> No guarantee of uninterrupted, timely, secure, ...`

- **Line 116** `[HARD_FORBIDDEN]`
  > `<li><strong>No Warranty of Accuracy:</strong> No guarantee that data captured by the App is compl...`

- **Line 117** `[HARD_FORBIDDEN]`
  > `<li><strong>No Support Guarantee:</strong> Support is provided on a best-effort basis with no Ser...`

## ft_fastpath/README.md

- **Line 52** `[HARD_FORBIDDEN]`
  > `### Option 2: Python Fallback (Always Available)`

- **Line 241** `[HARD_FORBIDDEN]`
  > `✅ Safe fallback always available`

## vscode-extension/README.md

- **Line 16** `[HARD_FORBIDDEN]`
  > `- Guaranteed compatibility with remote Codespaces.`
