# Change Management Policy

## Purpose

This policy governs changes to FirstTry Forge application, ensuring changes are auditable, tested, and traceable.

## Scope Changes

Scope additions/removals are forbidden without explicit RFC (Request for Change). Any scope change requires:
1. RFC document explaining business justification
2. Security review approval
3. New version tag
4. Team notification

**Verification**: tests/security/scopeAllowlist.spec.ts enforces scope set immutability.

## Dependency Changes

All dependency changes are tracked in package-lock.json (committed, immutable).

Changes require:
1. npm ci (not npm install) for deterministic lock
2. CI verification pass
3. Changelog entry
4. Version bump

## Determinism Verification

All changes must pass:
- npm run build (no errors)
- npm test (all tests pass)
- bash scripts/proof/verify_deterministic_build.sh

## Release Process

1. Feature/fix implemented and tested locally
2. GitHub PR review and approval
3. CI checks pass (all guards and tests)
4. Merge to main
5. Tag with vX.Y.Z-description
6. Changelog updated

## Rollback Procedure

In case of production issue:
1. Identify commit/tag causing issue
2. git revert or create fix branch
3. Run full verification suite
4. Deploy and tag with -hotfix
5. Document incident

---

**Version**: 4.2.1  
**Effective**: 2026-02-16
