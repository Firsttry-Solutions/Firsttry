# Dependency Inventory

**Generated**: 2026-01-10 12:21 UTC  
**Source**: npm ls --depth=0 (top-level deps) + npm ls --all (full tree in npm_ls_all.json)  
**Audit Status**: ✅ Zero vulnerabilities (npm_audit.json)

## Top-Level Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @forge/api | 6.4.2 | Forge-provided API wrapper (requestJira, storage, etc.) |
| glob | 13.0.0 | File path pattern matching (artifact discovery, config loading) |
| uuid | 13.0.0 | UUID generation (evidence IDs, deduplication) |
| yaml | 2.8.2 | YAML parsing (config files, policy documents) |

## Top-Level Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @types/node | 20.19.27 | TypeScript types for Node.js |
| @types/react | 18.3.27 | TypeScript types for React (gadget UI) |
| @vitest/ui | 4.0.16 | Vitest test runner UI |
| typescript | 5.9.3 | TypeScript compiler |
| vitest | 4.0.16 | Vitest test runner (primary test framework) |

## Dependency Health

- ✅ **All packages up-to-date**: npm audit shows zero vulnerabilities
- ✅ **No deprecated packages**: No warnings from npm ci
- ✅ **Production count**: 87 packages (direct + transitive)
- ✅ **Development count**: 102 packages (test-only)
- ✅ **Optional count**: 49 packages (polyfills, optional features)

## Security Posture

- **Vulnerability Scan**: Zero critical/high/moderate findings
- **Transitive Dependency Risk**: Low (well-maintained maintainers like Atlassian, Microsoft, Vitest team)
- **License Risk**: Production deps use permissive licenses (Apache-2.0, MIT, ISC, BSD)

## Notable Dependencies

- **@forge/api**: Atlassian-maintained, stable (v6 major)
- **vitest**: Modern alternative to Jest, well-maintained, active community
- **typescript**: 5.9.x (latest stable), supports strict mode

