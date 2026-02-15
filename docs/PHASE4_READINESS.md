# PHASE 4 - READINESS SUMMARY

## Overview

Phase 4 is a **policy mapping and governance layer** that adds no new runtime constraints but provides reviewers with evidence of alignment to enterprise security governance frameworks.

**Key Property**: Phase 4 has NO code enforcement, NO runtime guards, NO blocking gates. It is documentation + mapping + metadata only.

---

## Scope: What Phase 4 Is

### Policy Mapping Layer
- Maps Forge permissions to NIST CSF / ISO 27001 controls
- Maps Phase 1-3 implementation evidence to governance questionnaires
- Enables policy teams to validate "yes, this app meets our policy"

### Security Review Shortcut
- One-time policy alignment mapping reduces future review cycles
- Reviewers skip re-validating basic controls (we've mapped them)
- Speeds "is this policy-compliant?" questions from weeks to hours

### Enterprise Export Additions
- Phase 4 exports include: control mappings, evidence pointers, reviewer sign-offs
- Deterministic export format (same inputs → same export)
- Exportable to security dashboards, risk registers, compliance portals

---

## Inputs: What We Consume

Phase 4 depends on **Phase 2 + Phase 3 artifacts**:

### From Phase 2 (Governance Pack)
- `governance_pack.json` - Roles, permissions, scope matrix
- Enterprise controls checklist (security, compliance, data protection)
- DPA/SLA templates (Atlassian-provided)

### From Phase 3 (Review Packs)
- Tenant isolation proof (authentication gates, data partitioning)
- Audit log integration (immutability, compliance tracking)
- Export signing removal (safe mode, no external dependencies)
- RBAC freeze (reviewer group is locked, temporal guarantees)
- Rate limiting policy (token bucket, abuse prevention)
- Retention + purge scheduling (GDPR + data minimization)

---

## Phase 4 Data Additions

### 1. Control Mappings (New in Phase 4)
```json
{
  "policy_mappings": {
    "NIST_CSF": {
      "PR.AC-1": {
        "control": "Identity and Access Management",
        "phase_3_evidence": "phase3_rbac_freeze.log",
        "proof_marker": "[FT_RBAC_FROZEN]",
        "status": "PASSED"
      },
      "PR.DS-1": {
        "control": "Data Security - Confidentiality",
        "phase_3_evidence": "phase3_tenant_isolation.log",
        "proof_marker": "[FT_TENANT_ISOLATION_OK]",
        "status": "PASSED"
      }
    },
    "ISO_27001": {
      "A.6.1.1": {
        "control": "Information security roles and responsibilities",
        "phase_2_evidence": "governance_pack.json",
        "status": "MAPPED"
      }
    }
  }
}
```

### 2. Evidence Pointers (New in Phase 4)
```json
{
  "evidence_manifest": {
    "phase_2_governance": {
      "url": "s3://evidence-bucket/phase2/governance_pack.json",
      "hash": "sha256:...",
      "reviewed_by": "security-team@company.com",
      "review_date": "2025-01-15"
    },
    "phase_3_proofs": [
      {
        "marker": "[FT_PHASE32_BORING_RELIABILITY_PASS]",
        "evidence_file": "ft_phase32_boring_*/master-gate.log",
        "date_generated": "2025-01-15T12:34:56Z"
      }
    ]
  }
}
```

### 3. Enterprise Export Metadata (New in Phase 4)
```json
{
  "export_metadata": {
    "export_version": "4.0.0-policy-mapped",
    "deterministic": true,
    "inputs_hash": "sha256:...",
    "outputs_hash": "sha256:...",
    "policy_alignment_status": "COMPLIANT",
    "last_validated": "2025-01-15T12:34:56Z",
    "next_review_date": "2025-07-15"
  }
}
```

---

## Phase 4 New Resolvers (Read-Only Only)

Phase 4 resolver functions do NOT modify state. They ONLY read and map.

### Resolver: `getControlMappings()`
- Input: Phase 3 proof markers, Phase 2 permissions
- Output: NIST CSF / ISO 27001 control alignment
- Side-effects: None (read-only)

### Resolver: `getEvidencePointers()`
- Input: Phase 2 + Phase 3 artifact hashes
- Output: Evidence location + chain-of-custody metadata
- Side-effects: None (read-only)

### Resolver: `getPolicyAlignment()`
- Input: Control mappings + Phase 3 proof statuses
- Output: Boolean (is app policy-compliant?)
- Side-effects: None (read-only)

### Resolver: `getDeterministicExport()`
- Input: All control mappings + evidence metadata
- Output: Deterministic JSON export (same inputs → byte-for-byte identical output)
- Side-effects: None (read-only, appends to export array)

---

## Storage Key Strategy (Versioned)

Phase 4 uses versioned storage keys to prevent collision:

```
ft-phase4:control-mappings:v1:<app-install-key>
ft-phase4:evidence-manifest:v1:<app-install-key>
ft-phase4:export-metadata:v1:<app-install-key>
ft-phase4:policy-alignment:v1:<app-install-key>
```

If Phase 4 data format changes, storage versioning allows old + new to coexist during migration.

---

## Deterministic Export Format

Phase 4 exports must be **deterministic**: same inputs always produce identical outputs.

### Pseudo-code:
```python
def generate_phase4_export(phase2_pack, phase3_proofs):
    # 1. Sort all inputs canonically
    sorted_phase2 = canonical_sort(phase2_pack)
    sorted_phase3 = canonical_sort(phase3_proofs)
    
    # 2. Generate control mappings (ordered by control ID)
    control_maps = generate_mappings(sorted_phase2, sorted_phase3)
    
    # 3. Generate evidence pointers (ordered by marker)
    evidence_ptrs = extract_pointers(sorted_phase3)
    
    # 4. Generate export metadata (include input hashes)
    export_meta = {
      "inputs_hash": sha256(sorted_phase2 + sorted_phase3),
      "output_hash": sha256(export_json),
      "deterministic": true
    }
    
    # 5. Return JSON (sorted keys, no random fields)
    return json.dumps({
      "control_mappings": control_maps,
      "evidence_pointers": evidence_ptrs,
      "export_metadata": export_meta
    }, sort_keys=True)
```

---

## What Phase 4 Does NOT Do

- ❌ No runtime enforcement (that's Phases 1-3)
- ❌ No new backend code (that's Phase 2)
- ❌ No build gates (those are Phase 3, v3.2.3)
- ❌ No credential rotation (that's Phase 2 SLA timers)
- ❌ No external dependencies (Phase 3.2.2 stripped all Slack/webhooks)
- ❌ No mutable state on app (all enterprise data is read-only)

Phase 4 is **policy storytelling + governance metadata**, not operational code.

---

## Integration Timeline

### Prerequisite: All Phase 3 Proofs Pass
```bash
# Phase 3 master gate must succeed:
bash scripts/proof/ship_phase32_boring_reliability_gate.sh
# Expected marker: [FT_PROOF_PHASE32_BORING_RELIABILITY_PASS]
```

### Phase 4 Deliverable Sequence
1. **Phase 4a** (Week 1): Control mappings + evidence pointers (mapping layer)
2. **Phase 4b** (Week 2): Deterministic export integration + resolver functions
3. **Phase 4c** (Week 3): Enterprise export augmentation + audit logging
4. **Phase 4 Final**: One-shot deploy with Phase 4 data (no runtime changes)

---

## Reviewer Clarity

**For Security Reviewers**:
> "Phase 4 is a roadmap to policy compliance, not a new operational commitment. All proofs come from Phases 1-3. Phase 4 just organizes and maps them to your control frameworks."

**For Engineering**:
> "Phase 4 is read-only resolvers + metadata. No code enforcement, no new build gates, no new dependencies. Minimal risk, high reviewer value."

**For Compliance Teams**:
> "Phase 4 enables fast questionnaire answering: 'Yes, this app meets NIST CSF PR.AC-1' with evidence pointers. Reduces RFI cycles from 3 rounds to 1."

---

## Acceptance Criteria

Phase 4 is ready when:
- ✅ All Phase 3 master gates PASS ([FT_PROOF_PHASE32_BORING_RELIABILITY_PASS])
- ✅ Phase 2 governance pack is finalized and checked into repo
- ✅ Control mapping schema is defined + documented
- ✅ Deterministic export algorithm is reviewed + approved
- ✅ Read-only resolvers pass code review (no side-effects)
- ✅ Enterprise export format is backward-compatible with Phase 2/3 exports

---

## Questions for Exploratory Review

1. **Are the NIST CSF / ISO 27001 mappings accurate?** (Compliance team validates)
2. **Do evidence pointers lead to actual proofs?** (Engineering validates)
3. **Is the export deterministic?** (Code review + reproducibility test)
4. **Can this export replace RFI questionnaires for policy teams?** (Business validates)
5. **Are read-only resolvers truly side-effect-free?** (Security architecture validates)

---

**Status**: Phase 4 specification complete. Ready for Phase 3 gate completion followed by iterative Phase 4 implementation.

**Expected Phase 4 Start**: After v3.2.3 hardy-reliability master gates pass and are tagged.

---

*Document Last Updated: Phase 3 v3.2.3 - Boring Reliability*
