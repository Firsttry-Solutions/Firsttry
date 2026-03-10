# Deploy and Submit Commands - FirstTry Marketplace Submission

**CRITICAL**: Execute commands in this exact order. Do NOT skip any verification steps.

---

## Phase 1: Verify Submission Readiness

### Step 1a: Verify Latest Artifact

```bash
# Verify the submission artifacts pass all checks
bash tools/reviewer_demo/verify_demo_results.sh audit_artifacts/reviewer_demo/20260310T053204Z

# Expected output:
#   ✅ VERIFICATION PASSED
#   Overall Result: PASS_WITH_GAPS
#   Marketplace criticals: single_reviewer_command_ready=YES, demo_flow_ready=NO, read_only_scope_proof_ready=YES
```

### Step 1b: Check Repository State

```bash
# Review current git status
git status

# Expected: Clean working tree (or only untracked audit_export files)
# If you see modified tracked files, resolve before proceeding
```

### Step 1c: Confirm Scopes and Proofs

```bash
# View extracted scopes
cat audit_artifacts/reviewer_demo/20260310T053204Z/manifest_scopes_canonical.txt

# Expected:
#   read:jira-user
#   read:jira-work
#   storage:app

# Confirm all are read-only (no mutation capability)
cat audit_artifacts/reviewer_demo/20260310T053204Z/manifest_scope_audit.json | jq '.scope_classification'
```

---

## Phase 2: Prepare Submission Package

### Step 2a: Create Submission Archive

```bash
# Archive the submission packet and latest artifacts
mkdir -p submission_export
cp -r docs/marketplace/submission_packet/* submission_export/
cp -r audit_artifacts/reviewer_demo/20260310T053204Z submission_export/artifact_latest
cp docs/marketplace/REVIEWER_DEMO.md submission_export/
tar -czf FirstTry_Marketplace_Submission_20260310.tar.gz submission_export/

# Verify archive contents
tar -tzf FirstTry_Marketplace_Submission_20260310.tar.gz | head -20
```

### Step 2b: Generate Submission Metadata

```bash
# Create submission manifest
cat > submission_export/SUBMISSION_MANIFEST.json << 'EOF'
{
  "app_name": "FirstTry",
  "submission_timestamp": "2026-03-10T05:40:00Z",
  "submission_version": "1.0",
  "artifact_directory": "audit_artifacts/reviewer_demo/20260310T053204Z",
  "verification_status": "PASS_WITH_GAPS",
  "marketplace_criticals": {
    "single_reviewer_command_ready": "YES",
    "demo_flow_ready": "NO",
    "read_only_scope_proof_ready": "YES"
  },
  "evidence_files": {
    "scope_audit": "submission_export/artifact_latest/manifest_scope_audit.json",
    "egress_proof": "submission_export/artifact_latest/no_egress_status.json",
    "mutation_proof": "submission_export/artifact_latest/no_mutation_status.json",
    "blocker_file": "submission_export/artifact_latest/blocker_first.json",
    "summary": "submission_export/artifact_latest/summary.json",
    "demo_runbook": "submission_export/artifact_latest/reviewer_demo_recording_runbook.md"
  }
}
EOF

# Verify manifest
cat submission_export/SUBMISSION_MANIFEST.json | jq .
```

---

## Phase 3: Marketplace Submission

### Step 3a: Upload to Atlassian Marketplace

Follow your Marketplace submission process:

1. **Log in** to https://marketplace.atlassian.com (vendor account)
2. **Select app**: FirstTry
3. **Upload new version**:
   - Source: `FirstTry_Marketplace_Submission_20260310.tar.gz`
   - Version: (from package.json)
   - Release notes: See SUBMISSION_STATUS.md
4. **Attach documentation**:
   - REVIEWER_NOTES.md
   - KNOWN_GAPS.md
   - Link to artifact: `audit_artifacts/reviewer_demo/20260310T053204Z`
5. **Submit for review**

### Step 3b: Communicate Proof Status

In submission notes, include:

```
=== FirstTry Marketplace Submission - Proof Status ===

PASS_WITH_GAPS Status:
- ✅ Static proofs complete: scope audit, egress audit, mutation audit (all PASS)
- ✅ Marketplace single command ready: YES
- ✅ Read-only scope proof ready: YES
- ⚠️  Demo flow proof ready: NO (runtime environment not available in build context)

Evidence Location:
  audit_artifacts/reviewer_demo/20260310T053204Z/

Reviewer Action:
  1. Run: bash tools/reviewer_demo/verify_demo_results.sh audit_artifacts/reviewer_demo/20260310T053204Z
  2. Execute: reviewer_demo_recording_runbook.md (10 min, 6 screenshots)
  3. Verify: Gadget renders on dashboard
  4. Upload: Runtime proof files back to artifact directory

No blocker to submission – all static proofs valid and ready.
```

---

## Phase 4: Local Merge/Deploy (Optional - After Marketplace Approval)

### Step 4a: Prepare for merge

```bash
# Clean up temporary directories if needed
rm -rf audit_export submission_export
git status  # Confirm clean or expected state

# Review changes
git log --oneline -10
```

### Step 4b: Merge to main (if CI/CD clean)

```bash
# Ensure you're on main
git checkout main
git pull origin main

# Merge submission branch if used
# git merge submission/20260310 (if applicable)

# Push to origin if CI pipeline approves
git push origin main
```

### Step 4c: Tag Release

```bash
# After successful Marketplace approval, tag the release
git tag -a FirstTry/v1.0.0-marketplace -m "FirstTry Marketplace Submission - PASS_WITH_GAPS - 20260310"
git push origin FirstTry/v1.0.0-marketplace
```

---

## Phase 5: Verification Checklist

- [x] Artifact directory: `audit_artifacts/reviewer_demo/20260310T053204Z` exists
- [x] Verification passed: `bash tools/reviewer_demo/verify_demo_results.sh` → ✅ VERIFICATION PASSED
- [x] Result: PASS_WITH_GAPS (confirmed)
- [x] Marketplace criticals: 2/3 YES (1/3 NO is expected due to environment)
- [x] Submission packet: 6 files created in `docs/marketplace/submission_packet/`
- [x] Archive ready: `FirstTry_Marketplace_Submission_20260310.tar.gz`

---

## Troubleshooting

### If verification fails:

```bash
# Re-run harness to regenerate artifacts
bash tools/reviewer_demo/run_reviewer_demo.sh

# Verify new artifacts
bash tools/reviewer_demo/verify_demo_results.sh <NEW_ARTIFACT_DIR>
```

### If marketplace upload fails:

1. Check file permissions
2. Ensure archive integrity: `tar -tzf FirstTry_Marketplace_Submission_20260310.tar.gz > /dev/null`
3. Review manifest format: `cat submission_export/SUBMISSION_MANIFEST.json | jq .`
4. Check Marketplace service status

### If demo flow recording fails:

See: `reviewer_demo_recording_runbook.md` for deterministic steps. Each step is independent – can retry from any point.

---

## Success Indicators

✅ Submission uploaded to Marketplace  
✅ Marketplace team downloads artifacts  
✅ Marketplace verifier runs: `bash tools/reviewer_demo/verify_demo_results.sh audit_artifacts/reviewer_demo/20260310T053204Z` → VERIFICATION PASSED  
✅ Demo flow recorded (6 screenshots captured)  
✅ Gadget render verified on dashboard  
✅ Marketplace approval issued  
✅ App published to production marketplace

---

**Do not modify these commands. Execute as written. Report any deviations to the team.**
