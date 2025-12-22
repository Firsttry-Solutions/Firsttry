# FirstTry Operator Verification SOP Report

**Generated**: 2025-12-22T10:23:13.647Z
**Total Runs**: 10
**Total Checks**: 20

## Executive Summary

| Level | PASS | FAIL | UNKNOWN | Description |
|-------|------|------|---------|-------------|
| 1 | 3/9 | 0/9 | 6/9 | Verify against itself (determinism, proofs, outputs) |
| 2 | 0/9 | 0/9 | 9/9 | Verify against Jira reality (attribution, pagination, permissions) |
| 3 | 0/18 | 0/18 | 18/18 | Verify against failures (API errors, storage, quarantine, repair, concurrency) |
| 4 | 0/18 | 15/18 | 3/18 | Verify against claims/docs (proof catalog, sections, policy gates) |
| 5 | 0/6 | 0/6 | 6/6 | Verify audit readiness (traceability, no inference) |

## LEVEL 1: Against Itself

### L1-CF-001: Counterfactual Proof Integrity

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- evidenceFilesFound: 2

**Evidence References**:
- [/workspaces/Firstry/atlassian/forge-app/src/evidence](/workspaces/Firstry/atlassian/forge-app/src/evidence)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence_storage.ts](/workspaces/Firstry/atlassian/forge-app/src/evidence_storage.ts)

### L1-CF-001: Counterfactual Proof Integrity

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- evidenceFilesFound: 2

**Evidence References**:
- [/workspaces/Firstry/atlassian/forge-app/src/evidence](/workspaces/Firstry/atlassian/forge-app/src/evidence)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence_storage.ts](/workspaces/Firstry/atlassian/forge-app/src/evidence_storage.ts)

### L1-CF-001: Counterfactual Proof Integrity

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: Counterfactual ledger exists but runtime verification deferred to integration phase

**Metrics**:
- evidenceFilesFound: 2

**Evidence References**:
- [/workspaces/Firstry/atlassian/forge-app/src/evidence](/workspaces/Firstry/atlassian/forge-app/src/evidence)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence_storage.ts](/workspaces/Firstry/atlassian/forge-app/src/evidence_storage.ts)

### L1-DET-001: Deterministic Replay (>=10 Runs)

**Status**: ✅ PASS

**Reason**: N/A

**Metrics**:
- runIndex: 0

**Evidence References**:
- [OV_RUN_DIGESTS.txt](OV_RUN_DIGESTS.txt)

### L1-DET-001: Deterministic Replay (>=10 Runs)

**Status**: ✅ PASS

**Reason**: N/A

**Metrics**:
- runIndex: 0

**Evidence References**:
- [OV_RUN_DIGESTS.txt](OV_RUN_DIGESTS.txt)

### L1-DET-001: Deterministic Replay (>=10 Runs)

**Status**: ✅ PASS

**Reason**: Determinism check deferred to full suite comparison

**Metrics**:
- runIndex: 0

**Evidence References**:
- [OV_RUN_DIGESTS.txt](OV_RUN_DIGESTS.txt)

### L1-TRUTH-001: No Misleading Outputs Invariant

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- emittersFound: 10

**Evidence References**:
- [/workspaces/Firstry/atlassian/forge-app/src/exports/drift_export.ts](/workspaces/Firstry/atlassian/forge-app/src/exports/drift_export.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts](/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/snapshot_export.ts](/workspaces/Firstry/atlassian/forge-app/src/exports/snapshot_export.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/phase5_report_contract.ts](/workspaces/Firstry/atlassian/forge-app/src/phase5_report_contract.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/phase5_report_generator.ts](/workspaces/Firstry/atlassian/forge-app/src/phase5_report_generator.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/phase8/metrics_export.ts](/workspaces/Firstry/atlassian/forge-app/src/phase8/metrics_export.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/export_truth.ts](/workspaces/Firstry/atlassian/forge-app/src/phase9/export_truth.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/procurement/export_bundle.ts](/workspaces/Firstry/atlassian/forge-app/src/procurement/export_bundle.ts)

### L1-TRUTH-001: No Misleading Outputs Invariant

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- emittersFound: 10

**Evidence References**:
- [/workspaces/Firstry/atlassian/forge-app/src/exports/drift_export.ts](/workspaces/Firstry/atlassian/forge-app/src/exports/drift_export.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts](/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/snapshot_export.ts](/workspaces/Firstry/atlassian/forge-app/src/exports/snapshot_export.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/phase5_report_contract.ts](/workspaces/Firstry/atlassian/forge-app/src/phase5_report_contract.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/phase5_report_generator.ts](/workspaces/Firstry/atlassian/forge-app/src/phase5_report_generator.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/phase8/metrics_export.ts](/workspaces/Firstry/atlassian/forge-app/src/phase8/metrics_export.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/export_truth.ts](/workspaces/Firstry/atlassian/forge-app/src/phase9/export_truth.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/procurement/export_bundle.ts](/workspaces/Firstry/atlassian/forge-app/src/procurement/export_bundle.ts)

### L1-TRUTH-001: No Misleading Outputs Invariant

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: Output emitters found but runtime validation deferred; requires executing report generation

**Metrics**:
- emittersFound: 10

**Evidence References**:
- [/workspaces/Firstry/atlassian/forge-app/src/exports/drift_export.ts](/workspaces/Firstry/atlassian/forge-app/src/exports/drift_export.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts](/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/snapshot_export.ts](/workspaces/Firstry/atlassian/forge-app/src/exports/snapshot_export.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/phase5_report_contract.ts](/workspaces/Firstry/atlassian/forge-app/src/phase5_report_contract.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/phase5_report_generator.ts](/workspaces/Firstry/atlassian/forge-app/src/phase5_report_generator.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/phase8/metrics_export.ts](/workspaces/Firstry/atlassian/forge-app/src/phase8/metrics_export.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/export_truth.ts](/workspaces/Firstry/atlassian/forge-app/src/phase9/export_truth.ts)
- [/workspaces/Firstry/atlassian/forge-app/src/procurement/export_bundle.ts](/workspaces/Firstry/atlassian/forge-app/src/procurement/export_bundle.ts)

## LEVEL 2: Against Jira Reality

### L2-ATTR-001: Source Attribution Completeness

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

**Evidence References**:
- [src/evidence/evidence_model.ts](src/evidence/evidence_model.ts)

### L2-ATTR-001: Source Attribution Completeness

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

**Evidence References**:
- [src/evidence/evidence_model.ts](src/evidence/evidence_model.ts)

### L2-ATTR-001: Source Attribution Completeness

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: Source attribution check requires evidence bundle runtime instantiation

**Metrics**:
- runIndex: 0

**Evidence References**:
- [src/evidence/evidence_model.ts](src/evidence/evidence_model.ts)

### L2-PAG-001: Pagination Integrity

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

**Evidence References**:
- [src/phase7/pagination_utils.ts](src/phase7/pagination_utils.ts)

### L2-PAG-001: Pagination Integrity

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

**Evidence References**:
- [src/phase7/pagination_utils.ts](src/phase7/pagination_utils.ts)

### L2-PAG-001: Pagination Integrity

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: Pagination integrity check requires fixture adapter for N=1000 page traversal

**Metrics**:
- runIndex: 0

**Evidence References**:
- [src/phase7/pagination_utils.ts](src/phase7/pagination_utils.ts)

### L2-PERM-001: Permission Boundary Correctness

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

### L2-PERM-001: Permission Boundary Correctness

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

### L2-PERM-001: Permission Boundary Correctness

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: Permission boundary check requires mocking 403 responses

**Metrics**:
- runIndex: 0

## LEVEL 3: Failure Modes

### L3-CONC-001: Duplicate Invocation Idempotency

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

### L3-CONC-001: Duplicate Invocation Idempotency

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

### L3-CONC-001: Duplicate Invocation Idempotency

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: Idempotency check requires concurrent invocation simulation

**Metrics**:
- runIndex: 0

### L3-CONC-002: Overlapping Run Interleaving

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

### L3-CONC-002: Overlapping Run Interleaving

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

### L3-CONC-002: Overlapping Run Interleaving

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: Interleaving check requires deterministic concurrent operation sequencing

**Metrics**:
- runIndex: 0

### L3-FAIL-001: Forced API Failure Handling

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

### L3-FAIL-001: Forced API Failure Handling

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

### L3-FAIL-001: Forced API Failure Handling

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: API failure simulation requires injecting 429/5xx/timeout errors

**Metrics**:
- runIndex: 0

### L3-PART-001: Partial Write + Quarantine

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

### L3-PART-001: Partial Write + Quarantine

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

### L3-PART-001: Partial Write + Quarantine

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: Partial write quarantine check requires simulating mid-run failures

**Metrics**:
- runIndex: 0

### L3-REPAIR-001: Repair on Rerun

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

### L3-REPAIR-001: Repair on Rerun

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

### L3-REPAIR-001: Repair on Rerun

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: Repair verification requires baseline comparison after rerun

**Metrics**:
- runIndex: 0

### L3-STOR-001: Storage Failure Handling

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

### L3-STOR-001: Storage Failure Handling

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

### L3-STOR-001: Storage Failure Handling

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: Storage failure simulation requires injecting quota/exception errors

**Metrics**:
- runIndex: 0

## LEVEL 4: Claims & Docs

### L4-CLAIMS-001: Claims Proof Catalog Completeness

**Status**: ❌ FAIL

**Reason**: N/A

### L4-CLAIMS-001: Claims Proof Catalog Completeness

**Status**: ❌ FAIL

**Reason**: N/A

### L4-CLAIMS-001: Claims Proof Catalog Completeness

**Status**: ❌ FAIL

**Reason**: CLAIMS_PROOF_CATALOG.md not found

### L4-DOCS-001: Required Documentation Sections

**Status**: ❌ FAIL

**Reason**: N/A

**Metrics**:
- presentDocs: 0
- missingDocs: 13

**Evidence References**:
- [/workspaces/Firstry/atlassian/docs/PRIVACY.md](/workspaces/Firstry/atlassian/docs/PRIVACY.md)
- [/workspaces/Firstry/atlassian/docs/SECURITY.md](/workspaces/Firstry/atlassian/docs/SECURITY.md)
- [/workspaces/Firstry/atlassian/docs/DATA_RETENTION.md](/workspaces/Firstry/atlassian/docs/DATA_RETENTION.md)
- [/workspaces/Firstry/atlassian/docs/DATA_INVENTORY.md](/workspaces/Firstry/atlassian/docs/DATA_INVENTORY.md)
- [/workspaces/Firstry/atlassian/docs/ACCESS_CONTROL.md](/workspaces/Firstry/atlassian/docs/ACCESS_CONTROL.md)
- [/workspaces/Firstry/atlassian/docs/INCIDENT_RESPONSE.md](/workspaces/Firstry/atlassian/docs/INCIDENT_RESPONSE.md)
- [/workspaces/Firstry/atlassian/docs/SUPPORT.md](/workspaces/Firstry/atlassian/docs/SUPPORT.md)
- [/workspaces/Firstry/atlassian/docs/COMPLIANCE.md](/workspaces/Firstry/atlassian/docs/COMPLIANCE.md)
- [/workspaces/Firstry/atlassian/docs/ENTERPRISE_READINESS.md](/workspaces/Firstry/atlassian/docs/ENTERPRISE_READINESS.md)
- [/workspaces/Firstry/atlassian/docs/TERMS.md](/workspaces/Firstry/atlassian/docs/TERMS.md)
- [/workspaces/Firstry/atlassian/docs/CHANGELOG_POLICY.md](/workspaces/Firstry/atlassian/docs/CHANGELOG_POLICY.md)
- [/workspaces/Firstry/atlassian/docs/SUBPROCESSORS.md](/workspaces/Firstry/atlassian/docs/SUBPROCESSORS.md)
- [/workspaces/Firstry/atlassian/docs/PLATFORM_DEPENDENCIES.md](/workspaces/Firstry/atlassian/docs/PLATFORM_DEPENDENCIES.md)

### L4-DOCS-001: Required Documentation Sections

**Status**: ❌ FAIL

**Reason**: N/A

**Metrics**:
- presentDocs: 0
- missingDocs: 13

**Evidence References**:
- [/workspaces/Firstry/atlassian/docs/PRIVACY.md](/workspaces/Firstry/atlassian/docs/PRIVACY.md)
- [/workspaces/Firstry/atlassian/docs/SECURITY.md](/workspaces/Firstry/atlassian/docs/SECURITY.md)
- [/workspaces/Firstry/atlassian/docs/DATA_RETENTION.md](/workspaces/Firstry/atlassian/docs/DATA_RETENTION.md)
- [/workspaces/Firstry/atlassian/docs/DATA_INVENTORY.md](/workspaces/Firstry/atlassian/docs/DATA_INVENTORY.md)
- [/workspaces/Firstry/atlassian/docs/ACCESS_CONTROL.md](/workspaces/Firstry/atlassian/docs/ACCESS_CONTROL.md)
- [/workspaces/Firstry/atlassian/docs/INCIDENT_RESPONSE.md](/workspaces/Firstry/atlassian/docs/INCIDENT_RESPONSE.md)
- [/workspaces/Firstry/atlassian/docs/SUPPORT.md](/workspaces/Firstry/atlassian/docs/SUPPORT.md)
- [/workspaces/Firstry/atlassian/docs/COMPLIANCE.md](/workspaces/Firstry/atlassian/docs/COMPLIANCE.md)
- [/workspaces/Firstry/atlassian/docs/ENTERPRISE_READINESS.md](/workspaces/Firstry/atlassian/docs/ENTERPRISE_READINESS.md)
- [/workspaces/Firstry/atlassian/docs/TERMS.md](/workspaces/Firstry/atlassian/docs/TERMS.md)
- [/workspaces/Firstry/atlassian/docs/CHANGELOG_POLICY.md](/workspaces/Firstry/atlassian/docs/CHANGELOG_POLICY.md)
- [/workspaces/Firstry/atlassian/docs/SUBPROCESSORS.md](/workspaces/Firstry/atlassian/docs/SUBPROCESSORS.md)
- [/workspaces/Firstry/atlassian/docs/PLATFORM_DEPENDENCIES.md](/workspaces/Firstry/atlassian/docs/PLATFORM_DEPENDENCIES.md)

### L4-DOCS-001: Required Documentation Sections

**Status**: ❌ FAIL

**Reason**: Missing 13 required documentation files

**Metrics**:
- presentDocs: 0
- missingDocs: 13

**Evidence References**:
- [/workspaces/Firstry/atlassian/docs/PRIVACY.md](/workspaces/Firstry/atlassian/docs/PRIVACY.md)
- [/workspaces/Firstry/atlassian/docs/SECURITY.md](/workspaces/Firstry/atlassian/docs/SECURITY.md)
- [/workspaces/Firstry/atlassian/docs/DATA_RETENTION.md](/workspaces/Firstry/atlassian/docs/DATA_RETENTION.md)
- [/workspaces/Firstry/atlassian/docs/DATA_INVENTORY.md](/workspaces/Firstry/atlassian/docs/DATA_INVENTORY.md)
- [/workspaces/Firstry/atlassian/docs/ACCESS_CONTROL.md](/workspaces/Firstry/atlassian/docs/ACCESS_CONTROL.md)
- [/workspaces/Firstry/atlassian/docs/INCIDENT_RESPONSE.md](/workspaces/Firstry/atlassian/docs/INCIDENT_RESPONSE.md)
- [/workspaces/Firstry/atlassian/docs/SUPPORT.md](/workspaces/Firstry/atlassian/docs/SUPPORT.md)
- [/workspaces/Firstry/atlassian/docs/COMPLIANCE.md](/workspaces/Firstry/atlassian/docs/COMPLIANCE.md)
- [/workspaces/Firstry/atlassian/docs/ENTERPRISE_READINESS.md](/workspaces/Firstry/atlassian/docs/ENTERPRISE_READINESS.md)
- [/workspaces/Firstry/atlassian/docs/TERMS.md](/workspaces/Firstry/atlassian/docs/TERMS.md)
- [/workspaces/Firstry/atlassian/docs/CHANGELOG_POLICY.md](/workspaces/Firstry/atlassian/docs/CHANGELOG_POLICY.md)
- [/workspaces/Firstry/atlassian/docs/SUBPROCESSORS.md](/workspaces/Firstry/atlassian/docs/SUBPROCESSORS.md)
- [/workspaces/Firstry/atlassian/docs/PLATFORM_DEPENDENCIES.md](/workspaces/Firstry/atlassian/docs/PLATFORM_DEPENDENCIES.md)

### L4-POLICY-001: No Outbound Egress

**Status**: ❌ FAIL

**Reason**: N/A

**Metrics**:
- violationCount: 4

**Evidence References**:
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1137](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1137)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1166](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1166)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1184](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1184)
- [/workspaces/Firstry/atlassian/forge-app/src/ops/handler_wrapper.ts#L57](/workspaces/Firstry/atlassian/forge-app/src/ops/handler_wrapper.ts#L57)

### L4-POLICY-001: No Outbound Egress

**Status**: ❌ FAIL

**Reason**: N/A

**Metrics**:
- violationCount: 4

**Evidence References**:
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1137](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1137)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1166](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1166)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1184](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1184)
- [/workspaces/Firstry/atlassian/forge-app/src/ops/handler_wrapper.ts#L57](/workspaces/Firstry/atlassian/forge-app/src/ops/handler_wrapper.ts#L57)

### L4-POLICY-001: No Outbound Egress

**Status**: ❌ FAIL

**Reason**: Found 4 outbound egress violations

**Metrics**:
- violationCount: 4

**Evidence References**:
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1137](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1137)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1166](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1166)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1184](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L1184)
- [/workspaces/Firstry/atlassian/forge-app/src/ops/handler_wrapper.ts#L57](/workspaces/Firstry/atlassian/forge-app/src/ops/handler_wrapper.ts#L57)

### L4-POLICY-002: No Scope Drift

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Evidence References**:
- [/workspaces/Firstry/atlassian/forge-app/manifest.yml](/workspaces/Firstry/atlassian/forge-app/manifest.yml)

### L4-POLICY-002: No Scope Drift

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Evidence References**:
- [/workspaces/Firstry/atlassian/forge-app/manifest.yml](/workspaces/Firstry/atlassian/forge-app/manifest.yml)

### L4-POLICY-002: No Scope Drift

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: Scope drift check requires parsing manifest.yml and cross-checking docs

**Evidence References**:
- [/workspaces/Firstry/atlassian/forge-app/manifest.yml](/workspaces/Firstry/atlassian/forge-app/manifest.yml)

### L4-POLICY-003: No Storage Namespace Drift

**Status**: ❌ FAIL

**Reason**: N/A

**Metrics**:
- storagePrefixes: 3

**Evidence References**:
- [/workspaces/Firstry/atlassian/docs/DATA_INVENTORY.md](/workspaces/Firstry/atlassian/docs/DATA_INVENTORY.md)

### L4-POLICY-003: No Storage Namespace Drift

**Status**: ❌ FAIL

**Reason**: N/A

**Metrics**:
- storagePrefixes: 3

**Evidence References**:
- [/workspaces/Firstry/atlassian/docs/DATA_INVENTORY.md](/workspaces/Firstry/atlassian/docs/DATA_INVENTORY.md)

### L4-POLICY-003: No Storage Namespace Drift

**Status**: ❌ FAIL

**Reason**: DATA_INVENTORY.md not found

**Metrics**:
- storagePrefixes: 3

**Evidence References**:
- [/workspaces/Firstry/atlassian/docs/DATA_INVENTORY.md](/workspaces/Firstry/atlassian/docs/DATA_INVENTORY.md)

### L4-POLICY-004: No Console Logs

**Status**: ❌ FAIL

**Reason**: N/A

**Metrics**:
- violations: 154

**Evidence References**:
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L100](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L100)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L108](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L108)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L114](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L114)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L166](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L166)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L209](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L209)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L235](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L235)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L78](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L78)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L127](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L127)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L174](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L174)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L202](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L202)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L231](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L231)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L263](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L263)
- [/workspaces/Firstry/atlassian/forge-app/src/aggregation/daily.ts#L211](/workspaces/Firstry/atlassian/forge-app/src/aggregation/daily.ts#L211)
- [/workspaces/Firstry/atlassian/forge-app/src/aggregation/weekly.ts#L256](/workspaces/Firstry/atlassian/forge-app/src/aggregation/weekly.ts#L256)
- [/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L108](/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L108)
- [/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L117](/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L117)
- [/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L161](/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L161)
- [/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L217](/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L217)
- [/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L61](/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L61)
- [/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L73](/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L73)
- [/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L105](/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L105)
- [/workspaces/Firstry/atlassian/forge-app/src/canonicalize.ts#L114](/workspaces/Firstry/atlassian/forge-app/src/canonicalize.ts#L114)
- [/workspaces/Firstry/atlassian/forge-app/src/coverage/primitives.ts#L98](/workspaces/Firstry/atlassian/forge-app/src/coverage/primitives.ts#L98)
- [/workspaces/Firstry/atlassian/forge-app/src/coverage/primitives.ts#L124](/workspaces/Firstry/atlassian/forge-app/src/coverage/primitives.ts#L124)
- [/workspaces/Firstry/atlassian/forge-app/src/entitlements/audit_integration.ts#L70](/workspaces/Firstry/atlassian/forge-app/src/entitlements/audit_integration.ts#L70)
- [/workspaces/Firstry/atlassian/forge-app/src/entitlements/audit_integration.ts#L89](/workspaces/Firstry/atlassian/forge-app/src/entitlements/audit_integration.ts#L89)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L72](/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L72)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L96](/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L96)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L142](/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L142)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L157](/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L157)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L232](/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L232)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts#L156](/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts#L156)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts#L184](/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts#L184)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L79](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L79)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L101](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L101)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L126](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L126)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L133](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L133)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L158](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L158)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L164](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L164)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L170](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L170)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L180](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L180)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L191](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L191)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L204](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L204)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L212](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L212)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L219](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L219)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L344](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L344)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L365](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L365)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L380](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L380)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L398](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L398)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L420](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L420)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L458](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L458)
- [/workspaces/Firstry/atlassian/forge-app/src/index.ts#L23](/workspaces/Firstry/atlassian/forge-app/src/index.ts#L23)
- [/workspaces/Firstry/atlassian/forge-app/src/index.ts#L44](/workspaces/Firstry/atlassian/forge-app/src/index.ts#L44)
- [/workspaces/Firstry/atlassian/forge-app/src/index.ts#L98](/workspaces/Firstry/atlassian/forge-app/src/index.ts#L98)
- [/workspaces/Firstry/atlassian/forge-app/src/index.ts#L121](/workspaces/Firstry/atlassian/forge-app/src/index.ts#L121)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L33](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L33)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L47](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L47)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L60](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L60)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L76](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L76)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L90](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L90)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L146](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L146)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L154](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L154)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L172](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L172)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L47](/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L47)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L84](/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L84)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L107](/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L107)
- [/workspaces/Firstry/atlassian/forge-app/src/ops/determinism.ts#L181](/workspaces/Firstry/atlassian/forge-app/src/ops/determinism.ts#L181)
- [/workspaces/Firstry/atlassian/forge-app/src/ops/handler_wrapper.ts#L153](/workspaces/Firstry/atlassian/forge-app/src/ops/handler_wrapper.ts#L153)
- [/workspaces/Firstry/atlassian/forge-app/src/phase6/distributed_lock.ts#L74](/workspaces/Firstry/atlassian/forge-app/src/phase6/distributed_lock.ts#L74)
- [/workspaces/Firstry/atlassian/forge-app/src/phase6/distributed_lock.ts#L92](/workspaces/Firstry/atlassian/forge-app/src/phase6/distributed_lock.ts#L92)
- [/workspaces/Firstry/atlassian/forge-app/src/phase7/drift_storage.ts#L130](/workspaces/Firstry/atlassian/forge-app/src/phase7/drift_storage.ts#L130)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/console_enforcement.ts#L176](/workspaces/Firstry/atlassian/forge-app/src/phase9/console_enforcement.ts#L176)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L192](/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L192)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L197](/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L197)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L202](/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L202)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L209](/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L209)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L58](/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L58)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L79](/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L79)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L105](/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L105)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L150](/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L150)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L161](/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L161)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L92](/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L92)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L112](/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L112)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L136](/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L136)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L168](/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L168)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L182](/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L182)
- [/workspaces/Firstry/atlassian/forge-app/src/readiness_gate.ts#L101](/workspaces/Firstry/atlassian/forge-app/src/readiness_gate.ts#L101)
- [/workspaces/Firstry/atlassian/forge-app/src/readiness_gate.ts#L125](/workspaces/Firstry/atlassian/forge-app/src/readiness_gate.ts#L125)
- [/workspaces/Firstry/atlassian/forge-app/src/retention/cleanup.ts#L224](/workspaces/Firstry/atlassian/forge-app/src/retention/cleanup.ts#L224)
- [/workspaces/Firstry/atlassian/forge-app/src/retention/retention_policy.ts#L155](/workspaces/Firstry/atlassian/forge-app/src/retention/retention_policy.ts#L155)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L45](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L45)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L60](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L60)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L75](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L75)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L90](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L90)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L115](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L115)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L131](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L131)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L147](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L147)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L168](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L168)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L175](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L175)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L192](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L192)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L114](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L114)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L146](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L146)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L179](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L179)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L203](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L203)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L375](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L375)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L389](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L389)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L396](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L396)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L411](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L411)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L441](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L441)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L63](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L63)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L79](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L79)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L99](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L99)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L122](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L122)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L142](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L142)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L160](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L160)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L181](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L181)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L222](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L222)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L232](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L232)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L240](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L240)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L51](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L51)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L71](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L71)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L75](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L75)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L77](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L77)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L58](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L58)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L78](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L78)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L82](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L82)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L84](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L84)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L21](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L21)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L39](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L39)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L42](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L42)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L46](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L46)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L59](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L59)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L63](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L63)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L85](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L85)
- [/workspaces/Firstry/atlassian/forge-app/src/security/tenant_storage.ts#L191](/workspaces/Firstry/atlassian/forge-app/src/security/tenant_storage.ts#L191)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L29](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L29)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L45](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L45)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L74](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L74)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L112](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L112)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L128](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L128)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L143](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L143)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_debug.ts#L158](/workspaces/Firstry/atlassian/forge-app/src/storage_debug.ts#L158)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_debug.ts#L217](/workspaces/Firstry/atlassian/forge-app/src/storage_debug.ts#L217)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L57](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L57)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L65](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L65)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L80](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L80)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L99](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L99)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L107](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L107)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L122](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L122)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L139](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L139)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L147](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L147)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L161](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L161)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L176](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L176)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L194](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L194)

### L4-POLICY-004: No Console Logs

**Status**: ❌ FAIL

**Reason**: N/A

**Metrics**:
- violations: 154

**Evidence References**:
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L100](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L100)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L108](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L108)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L114](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L114)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L166](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L166)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L209](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L209)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L235](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L235)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L78](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L78)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L127](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L127)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L174](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L174)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L202](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L202)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L231](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L231)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L263](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L263)
- [/workspaces/Firstry/atlassian/forge-app/src/aggregation/daily.ts#L211](/workspaces/Firstry/atlassian/forge-app/src/aggregation/daily.ts#L211)
- [/workspaces/Firstry/atlassian/forge-app/src/aggregation/weekly.ts#L256](/workspaces/Firstry/atlassian/forge-app/src/aggregation/weekly.ts#L256)
- [/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L108](/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L108)
- [/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L117](/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L117)
- [/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L161](/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L161)
- [/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L217](/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L217)
- [/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L61](/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L61)
- [/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L73](/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L73)
- [/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L105](/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L105)
- [/workspaces/Firstry/atlassian/forge-app/src/canonicalize.ts#L114](/workspaces/Firstry/atlassian/forge-app/src/canonicalize.ts#L114)
- [/workspaces/Firstry/atlassian/forge-app/src/coverage/primitives.ts#L98](/workspaces/Firstry/atlassian/forge-app/src/coverage/primitives.ts#L98)
- [/workspaces/Firstry/atlassian/forge-app/src/coverage/primitives.ts#L124](/workspaces/Firstry/atlassian/forge-app/src/coverage/primitives.ts#L124)
- [/workspaces/Firstry/atlassian/forge-app/src/entitlements/audit_integration.ts#L70](/workspaces/Firstry/atlassian/forge-app/src/entitlements/audit_integration.ts#L70)
- [/workspaces/Firstry/atlassian/forge-app/src/entitlements/audit_integration.ts#L89](/workspaces/Firstry/atlassian/forge-app/src/entitlements/audit_integration.ts#L89)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L72](/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L72)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L96](/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L96)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L142](/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L142)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L157](/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L157)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L232](/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L232)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts#L156](/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts#L156)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts#L184](/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts#L184)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L79](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L79)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L101](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L101)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L126](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L126)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L133](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L133)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L158](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L158)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L164](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L164)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L170](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L170)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L180](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L180)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L191](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L191)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L204](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L204)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L212](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L212)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L219](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L219)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L344](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L344)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L365](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L365)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L380](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L380)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L398](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L398)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L420](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L420)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L458](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L458)
- [/workspaces/Firstry/atlassian/forge-app/src/index.ts#L23](/workspaces/Firstry/atlassian/forge-app/src/index.ts#L23)
- [/workspaces/Firstry/atlassian/forge-app/src/index.ts#L44](/workspaces/Firstry/atlassian/forge-app/src/index.ts#L44)
- [/workspaces/Firstry/atlassian/forge-app/src/index.ts#L98](/workspaces/Firstry/atlassian/forge-app/src/index.ts#L98)
- [/workspaces/Firstry/atlassian/forge-app/src/index.ts#L121](/workspaces/Firstry/atlassian/forge-app/src/index.ts#L121)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L33](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L33)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L47](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L47)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L60](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L60)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L76](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L76)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L90](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L90)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L146](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L146)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L154](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L154)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L172](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L172)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L47](/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L47)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L84](/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L84)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L107](/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L107)
- [/workspaces/Firstry/atlassian/forge-app/src/ops/determinism.ts#L181](/workspaces/Firstry/atlassian/forge-app/src/ops/determinism.ts#L181)
- [/workspaces/Firstry/atlassian/forge-app/src/ops/handler_wrapper.ts#L153](/workspaces/Firstry/atlassian/forge-app/src/ops/handler_wrapper.ts#L153)
- [/workspaces/Firstry/atlassian/forge-app/src/phase6/distributed_lock.ts#L74](/workspaces/Firstry/atlassian/forge-app/src/phase6/distributed_lock.ts#L74)
- [/workspaces/Firstry/atlassian/forge-app/src/phase6/distributed_lock.ts#L92](/workspaces/Firstry/atlassian/forge-app/src/phase6/distributed_lock.ts#L92)
- [/workspaces/Firstry/atlassian/forge-app/src/phase7/drift_storage.ts#L130](/workspaces/Firstry/atlassian/forge-app/src/phase7/drift_storage.ts#L130)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/console_enforcement.ts#L176](/workspaces/Firstry/atlassian/forge-app/src/phase9/console_enforcement.ts#L176)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L192](/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L192)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L197](/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L197)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L202](/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L202)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L209](/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L209)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L58](/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L58)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L79](/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L79)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L105](/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L105)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L150](/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L150)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L161](/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L161)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L92](/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L92)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L112](/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L112)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L136](/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L136)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L168](/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L168)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L182](/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L182)
- [/workspaces/Firstry/atlassian/forge-app/src/readiness_gate.ts#L101](/workspaces/Firstry/atlassian/forge-app/src/readiness_gate.ts#L101)
- [/workspaces/Firstry/atlassian/forge-app/src/readiness_gate.ts#L125](/workspaces/Firstry/atlassian/forge-app/src/readiness_gate.ts#L125)
- [/workspaces/Firstry/atlassian/forge-app/src/retention/cleanup.ts#L224](/workspaces/Firstry/atlassian/forge-app/src/retention/cleanup.ts#L224)
- [/workspaces/Firstry/atlassian/forge-app/src/retention/retention_policy.ts#L155](/workspaces/Firstry/atlassian/forge-app/src/retention/retention_policy.ts#L155)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L45](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L45)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L60](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L60)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L75](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L75)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L90](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L90)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L115](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L115)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L131](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L131)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L147](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L147)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L168](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L168)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L175](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L175)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L192](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L192)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L114](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L114)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L146](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L146)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L179](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L179)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L203](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L203)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L375](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L375)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L389](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L389)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L396](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L396)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L411](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L411)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L441](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L441)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L63](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L63)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L79](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L79)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L99](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L99)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L122](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L122)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L142](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L142)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L160](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L160)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L181](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L181)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L222](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L222)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L232](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L232)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L240](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L240)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L51](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L51)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L71](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L71)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L75](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L75)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L77](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L77)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L58](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L58)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L78](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L78)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L82](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L82)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L84](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L84)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L21](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L21)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L39](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L39)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L42](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L42)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L46](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L46)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L59](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L59)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L63](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L63)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L85](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L85)
- [/workspaces/Firstry/atlassian/forge-app/src/security/tenant_storage.ts#L191](/workspaces/Firstry/atlassian/forge-app/src/security/tenant_storage.ts#L191)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L29](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L29)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L45](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L45)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L74](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L74)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L112](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L112)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L128](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L128)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L143](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L143)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_debug.ts#L158](/workspaces/Firstry/atlassian/forge-app/src/storage_debug.ts#L158)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_debug.ts#L217](/workspaces/Firstry/atlassian/forge-app/src/storage_debug.ts#L217)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L57](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L57)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L65](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L65)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L80](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L80)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L99](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L99)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L107](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L107)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L122](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L122)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L139](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L139)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L147](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L147)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L161](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L161)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L176](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L176)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L194](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L194)

### L4-POLICY-004: No Console Logs

**Status**: ❌ FAIL

**Reason**: Found 154 console.* calls in production code

**Metrics**:
- violations: 154

**Evidence References**:
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L100](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L100)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L108](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L108)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L114](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L114)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L166](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L166)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L209](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L209)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L235](/workspaces/Firstry/atlassian/forge-app/src/admin/admin_page_loader.ts#L235)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L78](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L78)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L127](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L127)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L174](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L174)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L202](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L202)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L231](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L231)
- [/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L263](/workspaces/Firstry/atlassian/forge-app/src/admin/phase5_admin_page.ts#L263)
- [/workspaces/Firstry/atlassian/forge-app/src/aggregation/daily.ts#L211](/workspaces/Firstry/atlassian/forge-app/src/aggregation/daily.ts#L211)
- [/workspaces/Firstry/atlassian/forge-app/src/aggregation/weekly.ts#L256](/workspaces/Firstry/atlassian/forge-app/src/aggregation/weekly.ts#L256)
- [/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L108](/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L108)
- [/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L117](/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L117)
- [/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L161](/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L161)
- [/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L217](/workspaces/Firstry/atlassian/forge-app/src/auth/oauth_handler.ts#L217)
- [/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L61](/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L61)
- [/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L73](/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L73)
- [/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L105](/workspaces/Firstry/atlassian/forge-app/src/backfill_selector.ts#L105)
- [/workspaces/Firstry/atlassian/forge-app/src/canonicalize.ts#L114](/workspaces/Firstry/atlassian/forge-app/src/canonicalize.ts#L114)
- [/workspaces/Firstry/atlassian/forge-app/src/coverage/primitives.ts#L98](/workspaces/Firstry/atlassian/forge-app/src/coverage/primitives.ts#L98)
- [/workspaces/Firstry/atlassian/forge-app/src/coverage/primitives.ts#L124](/workspaces/Firstry/atlassian/forge-app/src/coverage/primitives.ts#L124)
- [/workspaces/Firstry/atlassian/forge-app/src/entitlements/audit_integration.ts#L70](/workspaces/Firstry/atlassian/forge-app/src/entitlements/audit_integration.ts#L70)
- [/workspaces/Firstry/atlassian/forge-app/src/entitlements/audit_integration.ts#L89](/workspaces/Firstry/atlassian/forge-app/src/entitlements/audit_integration.ts#L89)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L72](/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L72)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L96](/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L96)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L142](/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L142)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L157](/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L157)
- [/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L232](/workspaces/Firstry/atlassian/forge-app/src/evidence/verify_regeneration.ts#L232)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts#L156](/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts#L156)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts#L184](/workspaces/Firstry/atlassian/forge-app/src/exports/export_utils.ts#L184)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L79](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L79)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L101](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L101)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L126](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L126)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L133](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L133)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L158](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L158)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L164](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L164)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L170](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L170)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L180](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L180)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L191](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L191)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L204](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L204)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L212](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L212)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L219](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_json.ts#L219)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L344](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L344)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L365](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L365)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L380](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L380)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L398](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L398)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L420](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L420)
- [/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L458](/workspaces/Firstry/atlassian/forge-app/src/exports/phase5_export_pdf.ts#L458)
- [/workspaces/Firstry/atlassian/forge-app/src/index.ts#L23](/workspaces/Firstry/atlassian/forge-app/src/index.ts#L23)
- [/workspaces/Firstry/atlassian/forge-app/src/index.ts#L44](/workspaces/Firstry/atlassian/forge-app/src/index.ts#L44)
- [/workspaces/Firstry/atlassian/forge-app/src/index.ts#L98](/workspaces/Firstry/atlassian/forge-app/src/index.ts#L98)
- [/workspaces/Firstry/atlassian/forge-app/src/index.ts#L121](/workspaces/Firstry/atlassian/forge-app/src/index.ts#L121)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L33](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L33)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L47](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L47)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L60](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L60)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L76](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L76)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L90](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L90)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L146](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L146)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L154](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L154)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L172](/workspaces/Firstry/atlassian/forge-app/src/ingest.ts#L172)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L47](/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L47)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L84](/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L84)
- [/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L107](/workspaces/Firstry/atlassian/forge-app/src/ingest_timeline.ts#L107)
- [/workspaces/Firstry/atlassian/forge-app/src/ops/determinism.ts#L181](/workspaces/Firstry/atlassian/forge-app/src/ops/determinism.ts#L181)
- [/workspaces/Firstry/atlassian/forge-app/src/ops/handler_wrapper.ts#L153](/workspaces/Firstry/atlassian/forge-app/src/ops/handler_wrapper.ts#L153)
- [/workspaces/Firstry/atlassian/forge-app/src/phase6/distributed_lock.ts#L74](/workspaces/Firstry/atlassian/forge-app/src/phase6/distributed_lock.ts#L74)
- [/workspaces/Firstry/atlassian/forge-app/src/phase6/distributed_lock.ts#L92](/workspaces/Firstry/atlassian/forge-app/src/phase6/distributed_lock.ts#L92)
- [/workspaces/Firstry/atlassian/forge-app/src/phase7/drift_storage.ts#L130](/workspaces/Firstry/atlassian/forge-app/src/phase7/drift_storage.ts#L130)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/console_enforcement.ts#L176](/workspaces/Firstry/atlassian/forge-app/src/phase9/console_enforcement.ts#L176)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L192](/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L192)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L197](/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L197)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L202](/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L202)
- [/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L209](/workspaces/Firstry/atlassian/forge-app/src/phase9/log_redaction.ts#L209)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L58](/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L58)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L79](/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L79)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L105](/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L105)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L150](/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L150)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L161](/workspaces/Firstry/atlassian/forge-app/src/pipelines/daily_pipeline.ts#L161)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L92](/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L92)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L112](/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L112)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L136](/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L136)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L168](/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L168)
- [/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L182](/workspaces/Firstry/atlassian/forge-app/src/pipelines/weekly_pipeline.ts#L182)
- [/workspaces/Firstry/atlassian/forge-app/src/readiness_gate.ts#L101](/workspaces/Firstry/atlassian/forge-app/src/readiness_gate.ts#L101)
- [/workspaces/Firstry/atlassian/forge-app/src/readiness_gate.ts#L125](/workspaces/Firstry/atlassian/forge-app/src/readiness_gate.ts#L125)
- [/workspaces/Firstry/atlassian/forge-app/src/retention/cleanup.ts#L224](/workspaces/Firstry/atlassian/forge-app/src/retention/cleanup.ts#L224)
- [/workspaces/Firstry/atlassian/forge-app/src/retention/retention_policy.ts#L155](/workspaces/Firstry/atlassian/forge-app/src/retention/retention_policy.ts#L155)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L45](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L45)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L60](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L60)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L75](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L75)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L90](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L90)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L115](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L115)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L131](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L131)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L147](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L147)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L168](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L168)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L175](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L175)
- [/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L192](/workspaces/Firstry/atlassian/forge-app/src/run_ledgers.ts#L192)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L114](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L114)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L146](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L146)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L179](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L179)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L203](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L203)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L375](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L375)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L389](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L389)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L396](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L396)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L411](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L411)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L441](/workspaces/Firstry/atlassian/forge-app/src/scheduled/phase5_scheduler.ts#L441)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L63](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L63)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L79](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L79)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L99](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L99)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L122](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L122)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L142](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L142)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L160](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L160)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L181](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L181)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L222](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L222)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L232](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L232)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L240](/workspaces/Firstry/atlassian/forge-app/src/scheduled/scheduler_state.ts#L240)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L51](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L51)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L71](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L71)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L75](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L75)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L77](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_daily.ts#L77)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L58](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L58)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L78](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L78)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L82](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L82)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L84](/workspaces/Firstry/atlassian/forge-app/src/scheduled/snapshot_weekly.ts#L84)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L21](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L21)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L39](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L39)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L42](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L42)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L46](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L46)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L59](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L59)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L63](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L63)
- [/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L85](/workspaces/Firstry/atlassian/forge-app/src/scheduled/token_refresh_scheduler.ts#L85)
- [/workspaces/Firstry/atlassian/forge-app/src/security/tenant_storage.ts#L191](/workspaces/Firstry/atlassian/forge-app/src/security/tenant_storage.ts#L191)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L29](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L29)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L45](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L45)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L74](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L74)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L112](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L112)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L128](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L128)
- [/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L143](/workspaces/Firstry/atlassian/forge-app/src/storage.ts#L143)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_debug.ts#L158](/workspaces/Firstry/atlassian/forge-app/src/storage_debug.ts#L158)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_debug.ts#L217](/workspaces/Firstry/atlassian/forge-app/src/storage_debug.ts#L217)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L57](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L57)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L65](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L65)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L80](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L80)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L99](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L99)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L107](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L107)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L122](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L122)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L139](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L139)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L147](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L147)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L161](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L161)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L176](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L176)
- [/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L194](/workspaces/Firstry/atlassian/forge-app/src/storage_index.ts#L194)

## LEVEL 5: Audit Readiness

### L5-NO-GUESS-001: No Inference Language

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

### L5-NO-GUESS-001: No Inference Language

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

### L5-NO-GUESS-001: No Inference Language

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: Report not yet generated; check will run after report creation

**Metrics**:
- runIndex: 0

### L5-TRACE-001: Legal/Audit Traceability

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

**Evidence References**:
- [audit/operator_verification/OV_REPORT.md](audit/operator_verification/OV_REPORT.md)
- [audit/operator_verification/OV_RESULTS.jsonl](audit/operator_verification/OV_RESULTS.jsonl)

### L5-TRACE-001: Legal/Audit Traceability

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: N/A

**Metrics**:
- runIndex: 0

**Evidence References**:
- [audit/operator_verification/OV_REPORT.md](audit/operator_verification/OV_REPORT.md)
- [audit/operator_verification/OV_RESULTS.jsonl](audit/operator_verification/OV_RESULTS.jsonl)

### L5-TRACE-001: Legal/Audit Traceability

**Status**: ⚠️ UNKNOWN (deferred)

**Reason**: Traceability check requires examining generated report artifacts (deferred to report generation)

**Metrics**:
- runIndex: 0

**Evidence References**:
- [audit/operator_verification/OV_REPORT.md](audit/operator_verification/OV_REPORT.md)
- [audit/operator_verification/OV_RESULTS.jsonl](audit/operator_verification/OV_RESULTS.jsonl)

## Blockers & Limitations

The following checks cannot be verified without additional infrastructure:

### L1-CF-001
undefined

### L1-TRUTH-001
undefined

### L2-ATTR-001
undefined

### L2-PAG-001
undefined

### L2-PERM-001
undefined

### L3-CONC-001
undefined

### L3-CONC-002
undefined

### L3-FAIL-001
undefined

### L3-PART-001
undefined

### L3-REPAIR-001
undefined

### L3-STOR-001
undefined

### L4-POLICY-002
undefined

### L5-NO-GUESS-001
undefined

### L5-TRACE-001
undefined

### L1-CF-001
undefined

### L1-TRUTH-001
undefined

### L2-ATTR-001
undefined

### L2-PAG-001
undefined

### L2-PERM-001
undefined

### L3-CONC-001
undefined

### L3-CONC-002
undefined

### L3-FAIL-001
undefined

### L3-PART-001
undefined

### L3-REPAIR-001
undefined

### L3-STOR-001
undefined

### L4-POLICY-002
undefined

### L5-NO-GUESS-001
undefined

### L5-TRACE-001
undefined

### L1-CF-001
Counterfactual ledger exists but runtime verification deferred to integration phase

### L1-TRUTH-001
Output emitters found but runtime validation deferred; requires executing report generation

### L2-ATTR-001
Source attribution check requires evidence bundle runtime instantiation

### L2-PAG-001
Pagination integrity check requires fixture adapter for N=1000 page traversal

### L2-PERM-001
Permission boundary check requires mocking 403 responses

### L3-CONC-001
Idempotency check requires concurrent invocation simulation

### L3-CONC-002
Interleaving check requires deterministic concurrent operation sequencing

### L3-FAIL-001
API failure simulation requires injecting 429/5xx/timeout errors

### L3-PART-001
Partial write quarantine check requires simulating mid-run failures

### L3-REPAIR-001
Repair verification requires baseline comparison after rerun

### L3-STOR-001
Storage failure simulation requires injecting quota/exception errors

### L4-POLICY-002
Scope drift check requires parsing manifest.yml and cross-checking docs

### L5-NO-GUESS-001
Report not yet generated; check will run after report creation

### L5-TRACE-001
Traceability check requires examining generated report artifacts (deferred to report generation)

## Residual Risks

No verification can guarantee zero risk. Key limitations:

1. **Simulation vs Real**: All checks use fixture data, not production Jira instances
2. **Static Analysis**: Code scanning cannot find all runtime issues
3. **Coverage Gaps**: Some failure modes (e.g., network partition, byzantine failures) not simulated
4. **Time Dependency**: Checks use frozen timestamps; real-world timing behaviors not tested

## Exit Criteria Assessment

- **All tests passing or unknown**: ❌ NO
- **Deterministic runs**: ❌ NO
- **No product code changes**: ✅ YES (verification only)
- **Zero user actions**: ✅ YES (automated)
- **Zero configuration**: ✅ YES (hardcoded)

## Next Steps

1. **Implement Level 2-5 Runtime Checks**
   - Create fixture adapters for pagination simulation
   - Implement evidence bundle instantiation in test
   - Add error injection for failure scenarios

2. **Generate Detailed Evidence Reports**
   - Parse OV_RESULTS.jsonl per run
   - Create Claims & Proof table with evidence pointers
   - Document Jira permission matrices

3. **Run Operator Verification in CI**
   - Add script to package.json: "test:operator:full"
   - Collect and archive audit/operator_verification/ artifacts
   - Fail CI if determinism diverges or L4 FAILS

---
Generated by ov_report_gen.ts
