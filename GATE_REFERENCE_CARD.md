# GATE REFERENCE CARD

## Quick Start

```bash
# Run selftest (5 scenarios, all PASS)
bash tools/test_gates_selftest.sh

# Verify bundle identity
bash tools/verify_dist_identity_labels.sh --bundle-file dist/app.abc123.js

# Verify bundle integrity
bash tools/verify_bundle_integrity.sh --bundle-file dist/app.abc123.js
```

## Anchor Format

```
FT_IDENTITY_ANCHOR_V1|git=<7-hex>|bundle=<6-12-hex>|time=<ISO-8601>
```

**Example**:
```
FT_IDENTITY_ANCHOR_V1|git=1a2b3c4|bundle=5d6e7f|time=2024-01-15T10:30:00Z
```

## Gate 1: Integrity

| Component | Requirement |
|-----------|-------------|
| Hash | blake3 (64 hex) |
| File size | > 10KB |
| Exit code | 0=PASS, 1=FAIL |

## Gate 2: Identity

| Component | Requirement |
|-----------|-------------|
| Anchor count | Exactly 1 |
| git_sha | Exactly 7 hex |
| bundle_hash | 6-12 hex |
| build_time | Non-empty |
| Distinctness | git_sha ≠ bundle_hash |
| Exit code | 0=PASS, 1=FAIL |

## Files

| File | Lines | Purpose |
|------|-------|---------|
| verify_bundle_integrity.sh | 116 | Hash-based integrity |
| verify_dist_identity_labels.sh | 67 | Anchor parsing |
| test_gates_selftest.sh | 123 | 5-scenario validation |

## Selftest Results

```
[TEST 1] Missing anchor → FAIL ✓
[TEST 2] Multiple anchors → FAIL ✓
[TEST 3] Malformed anchor → FAIL ✓
[TEST 4] No distinctness → FAIL ✓
[TEST 5] Valid anchor → PASS ✓

PASSED: 5/5 ✓ ALL TESTS PASSED
```

## CI/CD Integration

```yaml
- name: Test gates
  run: bash tools/test_gates_selftest.sh
  
- name: Verify identity
  run: bash tools/verify_dist_identity_labels.sh --bundle-file $BUNDLE
  
- name: Verify integrity
  run: bash tools/verify_bundle_integrity.sh --bundle-file $BUNDLE
```

## Status

✅ **PRODUCTION READY**

- No external dependencies (except optional b3sum)
- Deterministic parsing (no heuristics)
- Unix exit codes (0=PASS, 1=FAIL)
- Portable bash (Linux/macOS/WSL)
- Comprehensive error messages

---

**Commits**: 32b61fbb, 52257234, 58230ff1  
**Branch**: main  
**Date**: 2024
