# Evidence Pack Proof Logs

**Timestamp**: $(echo "$TS")  
**Commit**: $(echo "$HEAD")  
**Branch**: $(echo "$BRANCH")

## Contents

This directory contains captured validator logs from a single run:

- **10_placeholders.log** - Placeholder validator output (checks for unvalidated claims)
- **20_anchors.log** - Evidence anchor validator output (verifies referenced evidence exists)
- **30_network_scanner.log** - Network surface scanner output (detects external manifest permissions, HTTP clients)
- **32_network_surface_summary.json** - Scanner summary (JSON: has_external_manifest_permissions, has_webtriggers, etc.)
- **40_tenant_guard.log** - Tenant isolation guard output (code-level regression tests)
- **90_exit_codes.txt** - Summary of all validator exit codes

## Key Notes

### Tenant Isolation Guard (40_tenant_guard.log)

This is a **code-level regression guard**, not a platform isolation test.

**What it proves:**
- Static code analysis: Forge SDK usage, manifest scopes, obvious cache risks
- Scanner proof: Network surface scanner reported no external egress (exit 0)

**What it does NOT prove:**
- Runtime tenant isolation across actual Atlassian tenants (requires integration testing)
- Atlassian platform guarantees (vendor documentation is authoritative)

### Evidence Git-Tracking

This evidence pack is git-tracked at the commit above. Immutability depends on repository protection policies. Do not claim "immutable" unless the repo enforces write protection.

## Validator Status

All validators exited 0 (pass) when logs were captured.

