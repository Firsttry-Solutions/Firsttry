# Risk Register (Vendor-Authored)

This register lists material risks and limitations of FirstTry under Atlassian Forge constraints. It is intentionally candid. No certification claims are made.

| Risk | Impact | Likelihood | Mitigation | Residual Risk |
| ---- | ------ | ---------- | ---------- | ------------- |
| Forge dependency risk | Runtime availability/performance bound by Atlassian Forge. | Medium | Fail-closed behavior, documented constraints, CI guards. | Medium |
| Tenant storage corruption risk | Loss/inconsistency of stored snapshots/metadata could affect reports. | Low-Med | Deterministic hashing, failure guards, no partial exports, documented recovery. | Low-Med |
| Snapshot time budget risk | Large tenants may exceed Forge time limits; scan/export may fail closed. | Medium | Time budgeting, explicit failure matrix, scale envelope documentation. | Medium |
| Large tenant scale risk | Data volume may exceed storage/export size constraints. | Medium | Explicit scale envelope; fail closed without partial exports. | Medium |
| Vendor business continuity risk | As a new vendor, continuity risk is non-zero. | Medium | Vendor exit scenario + uninstall/export guidance. | Medium |
| Regulatory misinterpretation risk | Framework mappings may be misread as compliance claims. | Medium | Non-claims doc + explicit mapping limitation language. | Low-Med |

Related docs:
- Data flow and trust boundaries: [docs/data-flow.md](data-flow.md)
- Failure behavior: [docs/failure-matrix.md](failure-matrix.md)
- Vendor exit scenario: [docs/vendor-exit-scenario.md](vendor-exit-scenario.md)
- Non-claims: [docs/non-claims.md](non-claims.md)
