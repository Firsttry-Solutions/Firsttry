# Evidence Pack Proof Logs

Timestamp: 20260113T131842Z
Run commit (validators executed from): 6ca63141da20391fa8537329a92c34d09848b2c7
Evidence committed-at: <filled-by-git-after-commit>
Branch: main

## Notes (legacy)

# Evidence Pack (20260113T131842Z_6ca63141)

**Timestamp**: 20260113T131842Z (locked for determinism)  
**Commit**: 6ca63141 (initial evidence pack)  
**Generated**: Phase E3+ Hardening  

## Artifacts & Reproducibility

### `10_placeholders.txt`
- **What**: Output of `python3 tools/validate_placeholders.py`
- **Purpose**: Verify no fabricated claims, placeholder text, or ACME Corp examples
- **Reproduce**: `python3 tools/validate_placeholders.py`
- **Pass criteria**: Exit 0, no FABRICATED_* blocks

### `11_docs_gate.txt`
- **What**: Output of `bash tools/validate_docs.sh` (if exists)
- **Purpose**: Docs meet quality standards (length, structure, clarity)
- **Reproduce**: `bash tools/validate_docs.sh`
- **Pass criteria**: Exit 0

### `12_freeze_lock.txt`
- **What**: Output of freeze lock check
- **Purpose**: Verify or skip freeze commit verification
- **Reproduce**: `bash atlassian/forge-app/audit/verify_freeze_lock.sh`
- **Note**: Expected mismatch is acceptable (HEAD vs. HEAD~1 freeze)

### `30_manifest_surface.txt`
- **What**: Manifest scopes + permissions.external extraction
- **Purpose**: Prove what Jira/external permissions are declared
- **Reproduce**: `python3 tools/scan_network_surface.py --repo . --manifest-only`
- **Format**: Structured YAML/JSON with scopes, external URLs, webtriggers

### `31_code_network_scan.txt`
- **What**: FULL output of network surface code scan (NO TRUNCATION)
- **Purpose**: Verify no external HTTP client usage (fetch, axios, https.request, etc.)
- **Reproduce**: `python3 tools/scan_network_surface.py --repo . --code-scan-only`
- **Critical**: Must show all matches (not head-truncated), exit 1 if external egress found

### `32_network_surface_run.txt`
- **What**: Full run output with both manifest + code scan
- **Purpose**: Diagnostic output from the combined scan
- **Reproduce**: `python3 tools/scan_network_surface.py --repo .`

### `40_tenant_isolation_test.txt`
- **What**: Output from tenant isolation proof test
- **Purpose**: Verify storage keys are tenant-partitioned (no cross-tenant leakage)
- **Reproduce**: Run tenant isolation test suite
- **Pass criteria**: Test suite passes, storage keys differ per tenant

### `50_EVIDENCE_SUMMARY.md`
- **What**: Human-readable summary of all artifacts
- **Purpose**: Quick reference for Marketplace reviewers
- **Content**: Links to all proofs, interpretation of results

### `50_evidence_summary.json`
- **What**: Machine-readable summary (for tooling)
- **Purpose**: Automated evidence validation, CI checks
- **Format**: JSON with timestamp, scopes, validators status, network surface results

## How to Verify

```bash
# 1. Check if evidence pack exists
ls docs/evidence/20260113T131842Z_6ca63141/

# 2. Verify validators
cat docs/evidence/20260113T131842Z_6ca63141/10_placeholders.txt
grep "PASS\|FAIL" docs/evidence/20260113T131842Z_6ca63141/10_placeholders.txt

# 3. Check network surface (FULL, no truncation)
cat docs/evidence/20260113T131842Z_6ca63141/31_code_network_scan.txt | wc -l
# Should be complete output, not head/tail

# 4. Verify tenant isolation test
cat docs/evidence/20260113T131842Z_6ca63141/40_tenant_isolation_test.txt
```

## What's Proven vs. What's Customer-Measured

### Proven (Code-backed)
- ✅ Manifest scopes (extracted from source)
- ✅ No external HTTP clients (code scan with full output)
- ✅ Tenant isolation (test proof)
- ✅ No critical placeholders (validator)
- ✅ Docs quality (validator)

### Customer-Measured (Framework Examples)
- ❌ Setup time (varies by org)
- ❌ ROI % (depends on customer baseline)
- ❌ Error prevention value (org-specific)

### Not Claimed (Due Diligence)
- ❌ Encryption (cite Atlassian Forge documentation instead)
- ❌ SOC2/GDPR/ISO claims (no claims made; see Atlassian Trust Center)
- ❌ Audit savings (customer measures)

## Retention Policy

- Keep: Last 5 evidence packs
- Archive: Older packs (see tools/prune_evidence_packs.py)
- This pack: Kept if less than 5 total
