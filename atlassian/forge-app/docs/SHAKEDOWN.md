# Shakedown Testing and Verification

## Overview

Shakedown tests verify that the FirstTry Governance app meets critical operational and compliance requirements without requiring configuration or manual intervention.

## Test Coverage

### SHK-090: Manifest Zero-Configuration Proof
Verifies that the app manifest declares only required modules (dashboardGadget, adminPage) with no configuration interfaces or manual intervention steps.

### SHK-091: Source Code Configuration-Free Proof
Scans production code to verify no configuration patterns, configuration logic, or manual intervention flows in critical paths.

### SHK-096: Test-Only Drift Guard
Ensures production source code contains no test-only branches or conditional logic that would mask real issues.

### SHK-097: Docs Compliance Schema Validator
Validates that all documentation claims are backed by code evidence and free of unsupported marketing language.

## Compliance Claims

- **No Configuration Required**: App is immediately functional after installation with no per-workspace configuration steps
- **Automatic Operation**: All functionality is event-driven or scheduled; no manual triggers or configuration wizards
- **Production-Ready Code**: Source code contains no debug flags or test-only paths

## Evidence

All claims are verified by automated tests that scan:
- manifest.yml for module declarations
- Source code for forbidden patterns
- Documentation for consistency and accuracy

## Running Shakedown Tests

```bash
npm test -- --run tests/shakedown/
```

Expected result: All tests pass, proving the app meets operational requirements.

