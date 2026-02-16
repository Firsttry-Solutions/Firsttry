# ADR 0003: Deterministic Exports and Golden Artifact Testing

## Context
Auditors and enterprises value reproducible evidence. Determinism reduces disputes about report integrity.

## Decision
Implement deterministic serialization and exclude timestamps from hash-input domains where required. Add golden tests to lock export representation and detect regression.

## Consequences
- Export artifacts become reproducible under consistent runtime/build constraints.
- Any change to canonical content is visible in code review via golden file updates.

## Alternatives Considered
- Hash-only regression (rejected: less reviewable).
- Include timestamps in hash domain (rejected: breaks determinism across runs).

References:
- [docs/reproducible-build.md](../reproducible-build.md)
- [docs/security-whitepaper.md](../security-whitepaper.md)
- [atlassian/forge-app/tests/determinism/exportGolden.spec.ts](../../atlassian/forge-app/tests/determinism/exportGolden.spec.ts)
- [atlassian/forge-app/tests/determinism/hashInvariant.spec.ts](../../atlassian/forge-app/tests/determinism/hashInvariant.spec.ts)
