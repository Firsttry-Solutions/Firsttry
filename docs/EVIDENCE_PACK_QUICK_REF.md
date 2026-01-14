# Evidence Pack Quick Reference

**Latest Evidence Pack**: See [docs/evidence/](evidence/) for most recent  
**Full Guide**: [EVIDENCE_REFERENCE.md](EVIDENCE_REFERENCE.md)  

## 📦 Latest Pack Location

Evidence packs are generated with timestamps in the format:

```
docs/evidence/{YYYYMMDDTHHMMSSZ}_{GIT_HASH}/
```

Check [docs/evidence/](evidence/) for the most recent pack.

## 📋 Artifact Contents

Each evidence pack includes:

| File | Purpose |
|------|---------|
| `README.md` | Explanation of all artifacts and how to reproduce |
| `10_placeholders.txt` | Placeholder validator output (PASS/FAIL) |
| `11_docs_gate.txt` | Docs quality validator output |
| `12_freeze_lock.txt` | Freeze lock check output |
| `30_manifest_surface.txt` | Manifest scopes and external permissions |
| `31_code_network_scan.txt` | Code audit for external HTTP clients |
| `40_tenant_isolation_test.txt` | Tenant isolation proof test output |
| `32_network_surface_summary.json` | Machine-readable summary |

## 🎯 Key Facts (Verified)

✅ **Scopes**: `read:jira-work` (read-only), `storage:app` (Forge)  
✅ **Storage**: Atlassian Forge app storage (see [Atlassian Forge documentation](https://developer.atlassian.com/platform/forge/manifest-reference/#storage) for encryption and tenant isolation)  
✅ **External APIs**: None configured (verified by code scan)  
✅ **Validators**: All passing (placeholders, docs)  
✅ **Tenant Isolation**: Proven by test suite  

## ❌ Customer-Measured Inputs

The following remain framework examples (customer validates):
- Setup time (e.g., "8 hours")
- ROI percentages (e.g., "12,092%")
- Audit time savings (e.g., "60% faster")
- Compliance: see Atlassian Trust Center for certification details

## 🔗 References

- [Detailed Guide](EVIDENCE_REFERENCE.md)
- [ROI Model with Evidence](ROI_MODEL.md#10-evidence-pack)
- [Placeholder Validator](../tools/validate_placeholders.py)
- [Evidence Anchor Validator](../tools/validate_evidence_anchors.py)

## 📋 Marketplace Use

Reference the latest evidence pack in your submission:

> "Our technical claims are backed by verifiable evidence. See `docs/evidence/` (most recent pack) for complete proof. Full guide in `docs/EVIDENCE_REFERENCE.md`."

---

**Status**: ✅ READY FOR MARKETPLACE SUBMISSION
