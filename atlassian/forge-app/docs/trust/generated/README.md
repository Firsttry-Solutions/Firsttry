# Generated Trust Documentation

**⚠️ DO NOT EDIT FILES IN THIS DIRECTORY MANUALLY**

This directory contains auto-generated documentation files that are derived from source files elsewhere in the repository. These files are created to maintain GitHub Pages linkability while staying synchronized with the actual codebase.

## Purpose

The trust documentation needs to reference implementation details (scopes, external URLs, storage usage, etc.) that are defined in code. Rather than maintaining duplicate information that could drift out of sync, we generate markdown mirrors from the canonical source.

## Regeneration

To regenerate all files in this directory:

```bash
cd atlassian/forge-app
bash tools/marketplace/regenerate_trust_facts.sh
```

This script:
1. Extracts data from source files (manifest.yml, TypeScript files, etc.)
2. Generates markdown documentation with proper formatting
3. Adds generation metadata (timestamp, source file path)

## Generated Files

| File | Source | Purpose |
|------|--------|---------|
| `manifest_scopes.md` | `../../manifest.yml` | Documents all Forge permission scopes declared in manifest |
| `external_urls_inventory.md` | Output of `tools/marketplace/inventory_external_urls.sh` | Lists all external URLs referenced by the app |
| `storage_usage_inventory.md` | Derived from storage facts | Documents Forge storage API usage patterns |

## Integration

These generated files are referenced by documentation in `docs/trust/` and must pass offline link checking via:

```bash
bash tools/marketplace/build_docs_site_offline.sh
```

All links must resolve within the `docs/` tree (no escaping to parent directories like `../../manifest.yml`).

## Verification

The generated files are validated by:
- `tools/marketplace/verify_privacy_security_pack.sh` (Phase 04: Linkability gate)
- `tools/marketplace/build_docs_site_offline.sh` (Standalone link checker)

If verification fails, the marketplace deployment is blocked.
