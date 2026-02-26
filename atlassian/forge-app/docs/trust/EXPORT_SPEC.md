# Export Specification

**Version**: 4.4.2  
**Owner**: FirstTry Solutions  
**Last Updated**: 2026-02-26  
**Review Cycle**: Annual
**Doc ID**: FT-TRUST-016  

---

## Export Archive Format

FirstTry compliance exports are distributed as ZIP archives containing governance snapshots, audit ledger, and proof markers.

### Archive Structure
```
export_firsttry_2026-02-26.zip
├── manifest.json              # Export metadata + proof markers
├── ledger.jsonl               # Audit trail (JSON lines)
├── snapshots/
│   ├── snapshot_1_2026-02-21.json   # Governance state snapshot
│   ├── snapshot_2_2026-02-23.json
│   └── snapshot_3_2026-02-26.json
├── hashes.txt                 # SHA256 manifest (for offline verification)
└── README.txt                 # Human-readable export guide
```

### Manifest Structure (manifest.json)
```json
{
  "export_timestamp": "2026-02-26T11:00:00Z",
  "export_version": "1.0",
  "app_version": "0.4.1",
  "audit_root_hash": "7a3b9c2d1e4f...",
  "audit_record_count": 147,
  "snapshot_count": 3,
  "build_git_sha": "abc123def456...",
  "build_ui_bundle_hash": "xyz789",
  "deterministic_zip_hash": "sha256_of_entire_zip",
  "customer_jira_site": "https://customer.atlassian.net",
  "export_scope": "complete",
  "integrity_status": "verified"
}
```

### Snapshots (snapshot_N.json)
Each snapshot contains a point-in-time governance state:
```json
{
  "snapshot_id": 1,
  "timestamp": "2026-02-21T14:30:00Z",
  "projects": [
    {
      "id": "PROJ1",
      "name": "Project One",
      "lead": "user123"
    }
  ],
  "permissions": [
    {
      "subject": "user456",
      "permission": "ADMINISTER_PROJECTS",
      "resource": "PROJ1"
    }
  ]
}
```

### Ledger (ledger.jsonl)
Append-only audit trail, one JSON object per line:
```json
{"action":"snapshot","snapshot_id":1,"hash":"abc123","nonce":"xyz","timestamp":"2026-02-21T14:30:00Z"}
{"action":"export","export_id":"exp_1","hash":"def456","nonce":"uvw","timestamp":"2026-02-26T11:00:00Z"}
```

### Hash Manifest (hashes.txt)
SHA256 checksums for offline verification:
```
7a3b9c2d1e4f5a6b7c8d9e0f1a2b3c4d  manifest.json
8b4d0a2e1f6c7a9b3d1e5f2c0a7b4d8e  ledger.jsonl
a1c3e5f0b8d2a7c5e9f1b3d7a2c6e0f4  snapshots/snapshot_1_2026-02-21.json
...
```

---

## Deterministic ZIP Ordering Rules

ZIP archives must be created with deterministic ordering to ensure reproducible hashes. Rules:

1. **File order**: Files listed in alphabetical order within the ZIP
2. **Compression**: All files compressed with DEFLATE (if used); no compression variation
3. **Timestamps**: All file timestamps set to fixed reference (e.g., 1980-01-01T00:00:00Z)
4. **Permissions**: All file permissions set to 0644 (standard read)
5. **No extra headers**: No ZIP comment, no metadata beyond standard ZIP format
6. **No hidden files**: No dot-files or temporary files

**Determinism check**:
```bash
# Create export twice; hashes must match
sha256sum export_firsttry_2026-02-26_attempt1.zip
sha256sum export_firsttry_2026-02-26_attempt2.zip
# Both SHA256 values must be identical
```

---

## Verification Steps

### Step 1: Download and Extract
```bash
unzip export_firsttry_2026-02-26.zip
cd export_firsttry_2026-02-26
```

### Step 2: Verify Hashes (Offline)
```bash
sha256sum -c hashes.txt
# Output: manifest.json: OK
#         ledger.jsonl: OK
#         ...
```

### Step 3: Extract Root Hash
```bash
grep "audit_root_hash" manifest.json
# Output: "audit_root_hash": "7a3b9c2d1e4f..."
```

### Step 4: Verify Ledger Chain
Use FirstTry offline verification tool (if available):
```bash
node tools/verify_ecl_state.mjs --export-dir ./export_firsttry_2026-02-26 \
  --expected-root-hash 7a3b9c2d1e4f...
# Output: LEDGER_INTEGRITY_VERIFIED
```

### Step 5: Manual Spot-Check (Readable)
```bash
head -5 ledger.jsonl  # Verify first 5 ledger entries are readable JSON
tail -5 ledger.jsonl  # Verify last 5 entries are present
cat snapshots/snapshot_1*.json | jq .timestamp  # Verify snapshot timestamps
```

---

## Build Identity and Reproducibility

**Build markers enable reproducibility checks**:

| Marker | Source | Field | Purpose |
|--------|--------|-------|---------|
| **Git SHA** | build system | build_git_sha | Reproducible source version |
| **UI Bundle Hash** | build system | build_ui_bundle_hash | Reproducible gadget build |
| **App Version** | manifest.yml | app_version | Release version lock |
| **ZIP Hash** | deterministic build | deterministic_zip_hash | Export artifact fingerprint |

**Reproducibility**: Given the same git SHA + app version, running `forge deploy` and exporting should produce an identical ZIP hash.

---

## References

- [LEDGER_CRYPTO_SPEC.md](LEDGER_CRYPTO_SPEC.md): Ledger hash chain formula
- [SERIALIZATION_SCHEMA.md](SERIALIZATION_SCHEMA.md): JSON serialization rules
- [ARCHITECTURE.md](ARCHITECTURE.md): Export component details
