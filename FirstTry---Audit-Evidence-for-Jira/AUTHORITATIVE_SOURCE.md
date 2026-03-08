# ✅ AUTHORITATIVE MARKETPLACE RELEASE SOURCE

**Status**: ACTIVE — canonical production source  
**Declared authoritative**: 2026-03-08  
**Supersedes**: `atlassian/forge-app/` (comparison-only, non-authoritative)

---

## This directory is the single authoritative source for:

- `forge deploy` (run from this directory)
- `forge install --upgrade` (run from this directory)
- CI/CD pipelines
- Freeze lock generation
- Reviewer demo infrastructure
- Marketplace listing submission
- All live production references

## Non-authoritative (comparison only)

```
atlassian/forge-app/
```

`atlassian/forge-app/` is retained as a read-only comparison reference only.  
It must NOT be used for any deploy, upgrade, listing, or proof operation.

## Canonical source proof

- **Manifest**: `FirstTry---Audit-Evidence-for-Jira/manifest.yml`
- **Freeze lock**: `FirstTry---Audit-Evidence-for-Jira/audit/FREEZE_LOCK.json`
- **Reviewer gate**: `FirstTry---Audit-Evidence-for-Jira/audit/reviewer_ready_gate.sh`
- **Audit evidence**: `audit_artifacts/vendor_tree_release_readiness_20260308T050102Z/`
