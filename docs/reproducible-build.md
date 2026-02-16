# Reproducible Build Documentation

## Objective

Ensure that builds of FirstTry Forge application are reproducible, deterministic, and auditable across environments.

## Build Environment Requirements

### Node.js Version (MANDATORY)

```
EXPECTED_NODE_MAJOR=20
EXPECTED_NODE_MINOR=20
EXPECTED_NODE_PATCH=0
```

**Current**:  
- Node: 20.20.0
- npm: 10.8.2 (pinned)

**Verification**: `scripts/proof/verify_node_version.sh` must pass before build.

### Lock File

- **package-lock.json**: Present and committed
- Changes to lock file must be audited
- npm ci (not npm install) must be used for deterministic installs

### Build Output

```bash
cd atlassian/forge-app
npm ci
npm run build
```

Expected deterministic outputs:
- `dist/` directory with stable file hashes
- No timestamps in artifact attribution (see docs/security-whitepaper.md)

## Reproducibility Scope

Deterministic guarantees hold for:
- **Included**: JavaScript transpilation, bundling, asset minification
- **Included**: Manifest parsing and validation
- **Excluded**: File system modification times (preserved as metadata only)
- **Excluded**: Timestamps in exported metadata (kept separate from hash inputs)

## Hash Inputs

Canonical deterministic hashing MUST exclude timestamps:
- No createdUtc in hash payload
- No lastUpdatedUtc in hash payload
- No buildUtc in hash payload (may exist in exported metadata, never in hash)
- No calculatedAt in hash payload
- No decidedUtc in hash payload

See `atlassian/forge-app/tests/determinism/hashInvariant.spec.ts` for enforcement.

## Verification Scripts

| Script | Purpose | Failure Action |
|--------|---------|-----------------|
| `scripts/proof/verify_node_version.sh` | Confirm Node/npm versions | Exit 1 |
| `scripts/proof/guard_pdf_determinism_contract.sh` | Verify doc completeness | Exit 1 |
| `scripts/proof/verify_deterministic_build.sh` | Full build verification | Exit 1 |

## Clean Build Procedure

```bash
cd atlassian/forge-app
rm -rf node_modules dist
npm ci
npm run build
npm test
bash ../../scripts/proof/verify_deterministic_build.sh
```

## CI Integration

GitHub Actions workflow runs:
- `npm ci && npm run build`
- `npm test`
- `bash scripts/proof/verify_deterministic_build.sh`

See `.github/workflows/` for current configuration.

## Failure Diagnosis

If build is non-deterministic:
1. Check Node/npm version matches expected
2. Verify package-lock.json is committed and not stale
3. Inspect `npm test` output for markers:
   - `[FT_EXPORT_GOLDEN_TEST_PASS]`
   - `[FT_HASH_INVARIANT_PASS]`
4. If golden hash mismatches, run: `bash scripts/proof/update_export_golden.sh`
5. Commit updated golden file

---

**Version**: 4.2.1  
**Last Updated**: 2026-02-16
