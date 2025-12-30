# Evidence Integrity and Determinism

This document explains how the project reduces nondeterminism in generated evidence and what reviewers should expect.

Determinism approach (evidence-backed)
- The repository includes a determinism harness and operator verification tests (see tests under `tests/credibility/_harness` and related files). These harnesses freeze time, seed randomness, and trap external network calls in tests to minimize flaky outputs.
- Deterministic test runs are used to validate export formats and evidence structure prior to submission. See the submission freeze artifacts for test logs.

How false positives are minimized
- Deterministic seeds and fixed timestamps in the test harness reduce variability in proof-of-life outputs.
- Operator verification tests assert expected evidence fields and report generation behavior; failures are investigated before release.

Integrity checks
- The submission freeze includes SHA256 checksums in `SHA256SUMS.txt` for packaged release artifacts (see freeze bundle). Consumers may verify checksums to ensure artifact integrity.

Limitations
- Determinism is enforced within the harness and CI; runtime behavior in production may differ because Forge runtime scheduling and external platform timing can vary. The harness reduces nondeterminism but does not alter platform scheduling guarantees.
