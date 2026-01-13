# Evidence Pack Quick Reference

**Generated**: 2026-01-13 13:11 UTC  
**Commit**: [b497b5c8](https://github.com/atlassian/firsttry/commit/b497b5c8)  
**Timestamp**: 20260113T130927Z  

## 📦 Location

```
docs/evidence/20260113T131033Z_0ac6d55e/
```

8 artifacts (all git-tracked, verifiable):

| File | Size | Purpose |
|------|------|---------|
| `00_state.txt` | 112 B | Repository state snapshot (branch, HEAD, status) |
| `10_placeholders.txt` | 85 B | Placeholder validator: ✅ PASS |
| `11_docs_gate.txt` | 291 B | Docs quality validator: ✅ PASS |
| `12_freeze_lock.txt` | 245 B | Freeze lock check (expected) |
| `30_manifest_scopes.txt` | 1.1 KB | Manifest scopes: `read:jira-work`, `storage:app` |
| `31_data_scan.txt` | 15.3 KB | Code audit: Forge storage only, zero external APIs |
| `50_EVIDENCE_SUMMARY.md` | 739 B | Human-readable summary |
| `50_evidence_summary.json` | 695 B | Machine-readable summary |

## 🎯 Key Facts (Verified)

✅ **Scopes**: `read:jira-work` (read-only), `storage:app` (Forge)  
✅ **Storage**: Atlassian Forge (encrypted, tenant-isolated)  
✅ **External APIs**: None configured  
✅ **Validators**: All passing (placeholders, docs)  

## ❌ Customer-Measured Inputs

The following remain framework examples (customer validates):
- Setup time (e.g., "8 hours")
- ROI percentages (e.g., "12,092%")
- Audit time savings (e.g., "60% faster")
- Compliance certifications (SOC2/GDPR/ISO — status TBD)

## 🔗 References

- [Detailed Guide](EVIDENCE_REFERENCE.md)
- [ROI Model with Evidence](ROI_MODEL.md#10-evidence-pack)
- [Placeholder Validator](../tools/validate_placeholders.py)
- [Evidence Anchor Validator](../tools/validate_evidence_anchors.py)

## 📋 Marketplace Use

Reference commit `b497b5c8` in your submission:

> "Our technical claims are backed by verifiable evidence. See commit b497b5c8, evidence pack: `docs/evidence/20260113T131033Z_0ac6d55e/`. Full guide in `docs/EVIDENCE_REFERENCE.md`."

---

**Status**: ✅ READY FOR MARKETPLACE SUBMISSION
