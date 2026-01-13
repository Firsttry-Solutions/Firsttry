# Evidence Pack Retention Policy

**Policy**: Keep the last 5 evidence pack directories; archive or delete older ones.

**Rationale**:
- Evidence packs can be large (100s of MB with full code scans)
- Repository bloat must be controlled
- Latest evidence is most relevant for Marketplace submission

## Evidence Pack Naming Convention

Evidence packs are stored with names following this pattern:

```
docs/evidence/{TIMESTAMP}_{GIT_SHORT_HASH}/
```

Example:
```
docs/evidence/20260113T131842Z_6ca63141/
```

**Timestamp**: ISO 8601 UTC (`YYYYMMDDTHHMMSSz`)  
**Git Hash**: Short form (7 chars)

## Retention Rules

1. **Keep**: Last 5 evidence packs (most recent first)
2. **Archive**: Packs #6 and older → `archived/` subdirectory
3. **Delete**: After 30 days in archive → delete permanently
4. **Frequency**: Pruning runs manually (see below)

## Manual Cleanup

To see what would be pruned (dry-run):
```bash
python3 tools/prune_evidence_packs.py --dry-run
```

To actually prune and archive:
```bash
python3 tools/prune_evidence_packs.py
```

To keep all evidence packs (for audit trail):
```bash
python3 tools/prune_evidence_packs.py --keep 999
```

## Exceptions

Do NOT delete evidence packs that:
- Are referenced in Marketplace submission
- Are linked in committed docs (check git history)
- Are part of security audit trail

Archive them instead using `--no-delete` flag.

