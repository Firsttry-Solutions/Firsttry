# Dashboard Audit Tool

Automated audit of Jira Forge dashboard implementation against the enterprise backbone checklist (A1–A6).

## Running the Audit

```bash
bash tools/dashboard_audit_report.sh
```

This will:
1. Create a timestamped evidence directory: `/tmp/ft_dashboard_audit_<UTC_TS>/`
2. Collect raw evidence (git metadata, file structure, ripgrep searches)
3. Generate structured reports

## Output Files

After running, you'll find:

### Human-Readable Report
- **`REPORT.md`** – Markdown report with findings, evidence snippets, and next steps

### Machine-Readable Report
- **`report.json`** – JSON summary suitable for CI/CD pipelines and tooling

### Raw Evidence
- **`git_head.txt`** – Current git commit
- **`git_status.txt`** – Uncommitted changes
- **`ls_tree.txt`** – Directory structure listing
- **`rg_*.txt`** – Ripgrep search outputs for specific markers

## Checklist Items (A1–A6)

### A1: Evidence status at-a-glance
- Status display (AVAILABLE/NO_DATA/ERROR)
- Last updated timestamp (UTC)
- Capture trigger indication
- Error reason + correlation ID (if error)

### A2: Change provenance
- App version/build SHA
- Capture trigger
- Integrity/immutability claims or "NOT DECLARED"

### A3: Scope & coverage summary
- Included/excluded specification
- Counts if computed, explicit "not computed" if not

### A4: Export for procurement
- JSON export capability
- Deterministic naming (snapshotId + timestamp + schemaVersion)
- Includes provenance in export

### A5: Filtering / targeting
- Snapshot selection (latest vs seed vs chosen)
- Environment label (STG/PROD)
- UI control present

### A6: Supportability hooks
- Support link in UI
- Correlation ID visible in UI
- Copy diagnostics button

## Status Legend

- **PRESENT**: All requirements for this item are met
- **PARTIAL**: Some requirements met, others incomplete
- **MISSING**: No evidence found for this requirement

## Example: Viewing Results

```bash
# View the markdown report
cat /tmp/ft_dashboard_audit_*/REPORT.md

# View the JSON report
jq . /tmp/ft_dashboard_audit_*/report.json

# List all evidence files
ls -lh /tmp/ft_dashboard_audit_*/
```

## Extending the Audit

Edit `tools/dashboard_audit_report.mjs` to:

1. **Add new search patterns** – Modify the `PATTERNS` object in the shell script
2. **Add new requirements** – Add to the `requirements` array in the Node.js script
3. **Change evaluation logic** – Modify the `evaluator` function for each requirement

## Notes

- This audit is **read-only** – it does not modify any product code
- All searches use **ripgrep** for performance
- Snapshots are taken once; re-run the script for fresh results
- Reports are timestamped for easy tracking of changes over time
