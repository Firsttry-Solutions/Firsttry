# Skipped Tests Allowlist

The Proof Mode skip gate allowlists only these skipped test files:

- tests/backbone_fix_a_correlation_echoing.test.ts
- tests/p4_bridge_diagnostics_panel.test.ts

## Rationale
These tests are intentionally skipped because they are not part of the current Phase-4 evidence contract and are tracked separately.

## Rules
- No other test skips are allowed in Proof Mode.
- These skips must not increase in count without updating this doc.
- Removing a skip requires making the tests deterministic and enabling them in CI/proof runs.
