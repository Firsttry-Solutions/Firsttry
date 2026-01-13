# Evidence Reference

This document links to generated evidence artifacts that prove FirstTry's claims.

## Latest Evidence Pack

**Location**: [evidence/20260113T131033Z_0ac6d55e](evidence/20260113T131033Z_0ac6d55e/)
**Timestamp**: 20260113T130927Z
**Repository State**: 0ac6d55e

## What's Proven

### Validators (All Passing)
- ✅ **No Critical Placeholders**: [`10_placeholders.txt`](evidence/20260113T131033Z_0ac6d55e/10_placeholders.txt)
- ✅ **Documentation Quality**: [`11_docs_gate.txt`](evidence/20260113T131033Z_0ac6d55e/11_docs_gate.txt)

### Manifest & Scopes (From Code)
- **Declared Scopes**: read:jira-work, storage:app
- **External Egress**: None configured
- **Evidence**: [`30_manifest_scopes.txt`](evidence/20260113T131033Z_0ac6d55e/30_manifest_scopes.txt)

### Data Handling (Code Scan)
- ✅ **Read-Only**: No `write:jira` scopes declared
- ✅ **Storage**: Uses `storage:app` (Forge-managed, tenant-isolated)
- ✅ **No External APIs**: No `fetch()` or HTTP calls to external domains
- **Evidence**: [`31_data_scan.txt`](evidence/20260113T131033Z_0ac6d55e/31_data_scan.txt)

## How to Interpret

Each referenced file is an **actual execution output**, not a claim. For example:

- `10_placeholders.txt` shows the exact command run and its output (PASS or FAIL)
- `30_manifest_scopes.txt` shows parsed YAML from `atlassian/forge-app/manifest.yml`
- `31_data_scan.txt` shows ripgrep patterns found in actual source code

**This means**: Claims about scopes, storage, and data flow are **verifiable** by checking these artifacts.

## What's NOT Here

The following require **customer measurement** (not provided by FirstTry):
- ROI timings (hours per issue, error costs) — Use `tools/roi_calc.py` with your data
- Setup time (varies by governance model complexity)
- Error prevention value (depends on violation costs in your org)

See [docs/ROI_MODEL.md](ROI_MODEL.md) for how to measure these yourself.
