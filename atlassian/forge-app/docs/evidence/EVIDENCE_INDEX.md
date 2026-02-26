# Evidence Index

**Version**: 1.0  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual
**Doc ID**: FT-EVID-002  

---

## 1. Purpose

This index provides a structured map of all compliance and audit evidence maintained by FirstTry Solutions for the Firsttry Atlassian Forge application. It is the authoritative entry point for procurement, security review, and certification activities.

---

## 2. Evidence Categories

### 2.1 Security Evidence

| Category | Document | Doc ID |
|---|---|---|
| Retention Policy | evidence/retention-policy.html | FT-EVID-001 |
| Security Overview | trust/security-overview.html | FT-TRUST-001 |
| Threat Model (STRIDE) | trust/threat-model.html | FT-TRUST-007 |
| Resolver Inventory (0 mutations) | trust/resolver-inventory.html | FT-TRUST-008 |
| Architecture | trust/architecture.html | FT-TRUST-011 |
| Ledger Crypto Spec | trust/ledger-crypto-spec.html | FT-TRUST-017 |

### 2.2 Privacy Evidence

| Category | Document | Doc ID |
|---|---|---|
| Privacy Policy | trust/privacy-policy.html | FT-TRUST-004 |
| Data Flow | trust/data-flow.html | FT-TRUST-009 |
| Data Classification and PII | trust/data-classification-pii.html | FT-TRUST-010 |
| Subprocessors | trust/subprocessors.html | FT-TRUST-005 |
| Uninstall and Deletion | trust/uninstall-deletion.html | FT-TRUST-015 |

### 2.3 Operational Evidence

| Category | Document | Doc ID |
|---|---|---|
| SLA | operations/sla.html | FT-OPS-001 |
| Incident Response Plan | operations/incident-response-plan.html | FT-OPS-002 |
| Business Continuity & DR | operations/bcp-drp.html | FT-OPS-004 |
| CI/CD Evidence | operations/ci-cd-evidence.html | FT-OPS-006 |
| Logging and Monitoring | operations/logging-monitoring.html | FT-OPS-010 |
| Secrets Management | operations/secrets-management.html | FT-OPS-011 |

### 2.4 Procurement Evidence

| Category | Document | Doc ID |
|---|---|---|
| Enterprise Security Pack Index | procurement/enterprise-pack-index.html | FT-PROC-001 |
| Security Questionnaire Master | procurement/security-questionnaire.html | FT-PROC-002 |
| Control Mapping Matrix | procurement/control-mapping-matrix.html | FT-PROC-003 |

---

## 3. Evidence Artefact Locations

Evidence bundles (generated at release time) are stored in the `evidence/` directory of this repository as git-committed artefacts:

- **Baselines**: `atlassian/forge-app/docs/evidence/baselines/` — SHA-256 hashes of deterministic build artefacts
- **Release bundles**: Committed at each tagged release alongside the corresponding `portal_pack_version` string

---

## 4. Evidence Currency

All documents carry a `Last Updated` date and `Review Cycle` field. The `portal_pack_version` on each published page identifies the exact release that produced it.

To verify currency:
1. Check `portal_pack_version` on any published page matches the latest tagged release
2. Cross-reference `Last Updated` dates against the CHANGELOG

---

## 5. Contact

For evidence requests related to procurement or security review:

- **Email**: security.contact@firsttry.run
- **Enterprise Security Pack**: procurement/enterprise-pack-index.html
