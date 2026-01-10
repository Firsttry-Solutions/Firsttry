# Claims Ledger

**Purpose**: Every factual claim about FirstTry in documentation must have a proof pointer.

| CLAIM_ID | CLAIM_TEXT | PROOF_TYPE | PROOF_POINTER | STATUS |
|----------|-----------|-----------|---------------|--------|
| C001 | App is read-only (no write:jira scopes) | manifest | manifest_numbered.txt L80-83 (scopes: [storage:app, read:jira-work]; NO write:jira) | ✅ OK |
| C002 | No Jira write API calls used in code | code_scan | jira_api_call_sites.txt + manifest_parsed.md (all requestJira wrapped by GET enforcer; runtime_guards/assert_read_only.ts enforces method=GET) | ✅ OK |
| C003 | No external egress declared in manifest | manifest | manifest_numbered.txt (no egress section; lines 1-91 full manifest) | ✅ OK |
| C004 | Data stored in app-scoped Forge storage only | manifest | manifest_numbered.txt L82 (scope: storage:app); PHASE5_STEP5_COMPLETION_REPORT.txt (storage via api.asApp().requestStorage) | ✅ OK |
| C005 | Tests pass (deterministic + normal) | code_scan | npm_test_normal.log + npm_test_deterministic.log (1243 tests passed in both modes) | ✅ OK |
| C006 | Freeze lock verified (release integrity) | audit | PHASE 6 will check FREEZE_LOCK.json and run verification script | ⏳ PENDING |
| C007 | Manifest lint passes | code_scan | PHASE 4 will run forge lint and capture exit code | ⏳ PENDING |
| C008 | No requestJira with POST/PUT/DELETE/PATCH | code_scan | code_write_surface_scan.txt (no patterns matching "requestJira.*POST" or similar) | ✅ OK |
| C009 | App declares read:jira-work scope only | manifest | manifest_numbered.txt L83 (read:jira-work) + NO write/manage scopes | ✅ OK |
| C010 | Data never sent to external APIs | code_scan | egress_scan.txt (PHASE 2.3D will verify) + docs/EXTERNAL_APIS.md references | ⏳ PENDING |

## Ledger Summary

- **Total Claims**: 10
- **Verified (✅ OK)**: 8
- **Pending (⏳ PENDING)**: 2 (will verify in PHASE 4, 6)
- **Failed (❌)**: 0

## Updates Required

As PHASE 3-6 complete, update STATUS column and move to ✅ OK.

