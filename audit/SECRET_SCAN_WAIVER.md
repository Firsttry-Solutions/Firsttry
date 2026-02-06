# Secret Scan Waiver

**Purpose**: This document explains why certain secret-like patterns exist in the repository.

**Scope**: All allowed patterns are either:
- Test fixtures using well-known example tokens (e.g., AWS official documentation examples)
- Documentation files referencing previously remediated secrets or explaining security practices
- Audit/proof documents that quote known example tokens for verification purposes

**Generated**: ft_final_reviewer_bundle_strict_20260206T083328Z

## Classification Results

- **Total secret pattern matches**: 62
- **Allowed (waived)**: 62
- **Forbidden (real secrets)**: 0

## Allowed Patterns

| File | Line | Reason | Content Preview |
|------|-----:|--------|-----------------|
| `SECRET_REMEDIATE_PROOF_SUMMARY.txt` | 14 | Test/doc file with known example token | `- Replaced: -----BEGIN RSA PRIVATE KEY-----` |
| `SECRET_REMEDIATE_PROOF_SUMMARY.txt` | 19 | Test/doc file with known example token | `- Replaced: AKIAIOSFODNN7EXAMPLE` |
| `audit/SECRET_SCAN_WAIVER.md` | 22 | Test/doc file with known example token | `\| `SECRET_REMEDIATE_PROOF_SUMMARY.txt` \| 14 \| Test/doc file ...` |
| `audit/SECRET_SCAN_WAIVER.md` | 23 | Test/doc file with known example token | `\| `SECRET_REMEDIATE_PROOF_SUMMARY.txt` \| 19 \| Test/doc file ...` |
| `audit/SECRET_SCAN_WAIVER.md` | 25 | Test/doc file with known example token | `\| `COMPLETE_REMEDIATION_REPORT.md` \| 16 \| Test/doc file with...` |
| `audit/SECRET_SCAN_WAIVER.md` | 26 | Test/doc file with known example token | `\| `COMPLETE_REMEDIATION_REPORT.md` \| 21 \| Test/doc file with...` |
| `audit/SECRET_SCAN_WAIVER.md` | 27 | Test/doc file with known example token | `\| `COMPLETE_REMEDIATION_REPORT.md` \| 22 \| Test/doc file with...` |
| `audit/SECRET_SCAN_WAIVER.md` | 28 | Test/doc file with known example token | `\| `scripts/strict_secret_scan.sh` \| 73 \| Test/doc file with ...` |
| `audit/SECRET_SCAN_WAIVER.md` | 29 | Test/doc file with known example token | `\| `scripts/strict_secret_scan.sh` \| 74 \| Test/doc file with ...` |
| `audit/SECRET_SCAN_WAIVER.md` | 30 | Test/doc file with known example token | `\| `scripts/strict_secret_scan.sh` \| 75 \| Test/doc file with ...` |
| `audit/SECRET_SCAN_WAIVER.md` | 31 | Test/doc file with known example token | `\| `scripts/strict_secret_scan.sh` \| 229 \| Test/doc file with...` |
| `audit/SECRET_SCAN_WAIVER.md` | 32 | Test/doc file with known example token | `\| `scripts/strict_secret_scan.sh` \| 230 \| Test/doc file with...` |
| `audit/SECRET_SCAN_WAIVER.md` | 33 | Test/doc file with known example token | `\| `scripts/strict_secret_scan.sh` \| 231 \| Test/doc file with...` |
| `audit/SECRET_SCAN_WAIVER.md` | 34 | Test/doc file with known example token | `\| `scripts/strict_secret_scan.sh` \| 232 \| Test/doc file with...` |
| `audit/SECRET_SCAN_WAIVER.md` | 35 | Test/doc file with known example token | `\| `MERGE_READINESS_PROOF_PACK_V2.md` \| 92 \| Test/doc file wi...` |
| `audit/SECRET_SCAN_WAIVER.md` | 36 | Test/doc file with known example token | `\| `MERGE_READINESS_PROOF_PACK_V2.md` \| 97 \| Test/doc file wi...` |
| `audit/SECRET_SCAN_WAIVER.md` | 37 | Test/doc file with known example token | `\| `MERGE_READINESS_PROOF_PACK_V2.md` \| 187 \| Test/doc file w...` |
| `audit/SECRET_SCAN_WAIVER.md` | 38 | Test/doc file with known example token | `\| `MERGE_READINESS_PROOF_PACK_V2.md` \| 196 \| Test/doc file w...` |
| `audit/SECRET_SCAN_WAIVER.md` | 39 | Test/doc file with known example token | `\| `MERGE_READINESS_PROOF_PACK_V2.md` \| 201 \| Test/doc file w...` |
| `audit/SECRET_SCAN_WAIVER.md` | 40 | Test/doc file with known example token | `\| `atlassian/forge-app/tests/p1_logging_safety.test.ts` \| 86...` |
| `audit/SECRET_SCAN_WAIVER.md` | 42 | Test/doc file with known example token | `\| `FINAL_VERIFICATION_REPORT.txt` \| 10 \| Test/doc file with ...` |
| `audit/SECRET_SCAN_WAIVER.md` | 43 | Test/doc file with known example token | `\| `FINAL_VERIFICATION_REPORT.txt` \| 13 \| Test/doc file with ...` |
| `audit/SECRET_SCAN_WAIVER.md` | 44 | Test/doc file with known example token | `\| `FINAL_VERIFICATION_REPORT.txt` \| 14 \| Test/doc file with ...` |
| `audit/SECRET_SCAN_WAIVER.md` | 45 | Test/doc file with known example token | `\| `FINAL_VERIFICATION_REPORT.txt` \| 77 \| Test/doc file with ...` |
| `audit/SECRET_SCAN_WAIVER.md` | 46 | Test/doc file with known example token | `\| `FINAL_VERIFICATION_REPORT.txt` \| 82 \| Test/doc file with ...` |
| `audit/SECRET_SCAN_WAIVER.md` | 47 | Test/doc file with known example token | `\| `tests/enterprise/test_secrets_scanning.py` \| 35 \| Test/do...` |
| `audit/SECRET_SCAN_WAIVER.md` | 48 | Test/doc file with known example token | `\| `tests/enterprise/test_secrets_scanning.py` \| 85 \| Test/do...` |
| `audit/SECRET_SCAN_WAIVER.md` | 49 | Test/doc file with known example token | `\| `tests/enterprise/test_secrets_scanning.py` \| 98 \| Test/do...` |
| `audit/SECRET_SCAN_WAIVER.md` | 50 | Test/doc file with known example token | `\| `tests/enterprise/test_secrets_scanning.py` \| 124 \| Test/d...` |
| `audit/SECRET_SCAN_WAIVER.md` | 51 | Test/doc file with known example token | `\| `tests/enterprise/test_secrets_scanning.py` \| 131 \| Test/d...` |
| `audit/SECRET_SCAN_WAIVER.md` | 57 | Test/doc file with known example token | `- `AKIAIOSFODNN7EXAMPLE` - AWS official documentation exampl...` |
| `audit/SECRET_SCAN_WAIVER.md` | 58 | Test/doc file with known example token | `- `AKIA0000000000000000` - Placeholder format` |
| `audit/SECRET_SCAN_WAIVER.md` | 59 | Test/doc file with known example token | `- `AKIA1234567890ABCDEF` - Test fixture` |
| `audit/SECRET_SCAN_WAIVER.md` | 60 | Test/doc file with known example token | `- `-----BEGIN RSA PRIVATE KEY-----` - Header line (allowed i...` |
| `COMPLETE_REMEDIATION_REPORT.md` | 15 | Test/doc file with known example token | `- `PHASE2D_ENTERPRISE_FEATURES.md`: `-----BEGIN RSA PRIVATE ...` |
| `COMPLETE_REMEDIATION_REPORT.md` | 16 | Test/doc file with known example token | `- `S3_INTEGRATION_GUIDE.md`: `AKIAIOSFODNN7EXAMPLE`` |
| `COMPLETE_REMEDIATION_REPORT.md` | 21 | Test/doc file with known example token | `- `-----BEGIN RSA PRIVATE KEY-----` → `[REDACTED_PRIVATE_KEY...` |
| `COMPLETE_REMEDIATION_REPORT.md` | 22 | Test/doc file with known example token | `- `AKIAIOSFODNN7EXAMPLE` → `[REDACTED_AWS_ACCESS_KEY_ID]`` |
| `scripts/strict_secret_scan.sh` | 73 | Test/doc file with known example token | `"AKIAIOSFODNN7EXAMPLE",  # AWS official docs example` |
| `scripts/strict_secret_scan.sh` | 74 | Test/doc file with known example token | `"AKIA0000000000000000",  # Placeholder` |
| `scripts/strict_secret_scan.sh` | 75 | Test/doc file with known example token | `"AKIA1234567890ABCDEF",  # Test fixture` |
| `scripts/strict_secret_scan.sh` | 229 | Test/doc file with known example token | `waiver_lines.append("- `AKIAIOSFODNN7EXAMPLE` - AWS official...` |
| `scripts/strict_secret_scan.sh` | 230 | Test/doc file with known example token | `waiver_lines.append("- `AKIA0000000000000000` - Placeholder ...` |
| `scripts/strict_secret_scan.sh` | 231 | Test/doc file with known example token | `waiver_lines.append("- `AKIA1234567890ABCDEF` - Test fixture...` |
| `scripts/strict_secret_scan.sh` | 232 | Test/doc file with known example token | `waiver_lines.append("- `-----BEGIN RSA PRIVATE KEY-----` - H...` |
| `MERGE_READINESS_PROOF_PACK_V2.md` | 92 | Test/doc file with known example token | `- Pattern: `-----BEGIN RSA PRIVATE KEY-----`` |
| `MERGE_READINESS_PROOF_PACK_V2.md` | 97 | Test/doc file with known example token | `- Pattern: `AKIAIOSFODNN7EXAMPLE`` |
| `MERGE_READINESS_PROOF_PACK_V2.md` | 187 | Test/doc file with known example token | `- ✅ Private Keys: Pattern `-----BEGIN RSA PRIVATE KEY-----`` |
| `MERGE_READINESS_PROOF_PACK_V2.md` | 196 | Test/doc file with known example token | `export S3_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"` |
| `MERGE_READINESS_PROOF_PACK_V2.md` | 201 | Test/doc file with known example token | `export S3_ACCESS_KEY_ID="AKIA0000000000000000"` |
| `atlassian/forge-app/tests/p1_logging_safety.test.ts` | 86 | Test/doc file with known example token | `const awsKey = 'AKIAIOSFODNN7EXAMPLE';` |
| `FINAL_VERIFICATION_REPORT.txt` | 9 | Test/doc file with known example token | `- PHASE2D_ENTERPRISE_FEATURES.md: -----BEGIN RSA PRIVATE KEY...` |
| `FINAL_VERIFICATION_REPORT.txt` | 10 | Test/doc file with known example token | `- S3_INTEGRATION_GUIDE.md: AKIAIOSFODNN7EXAMPLE` |
| `FINAL_VERIFICATION_REPORT.txt` | 13 | Test/doc file with known example token | `- File 1: -----BEGIN RSA PRIVATE KEY----- → [REDACTED_PRIVAT...` |
| `FINAL_VERIFICATION_REPORT.txt` | 14 | Test/doc file with known example token | `- File 2: AKIAIOSFODNN7EXAMPLE → [REDACTED_AWS_ACCESS_KEY_ID...` |
| `FINAL_VERIFICATION_REPORT.txt` | 77 | Test/doc file with known example token | `✓ Pattern removed: -----BEGIN RSA PRIVATE KEY-----` |
| `FINAL_VERIFICATION_REPORT.txt` | 82 | Test/doc file with known example token | `✓ Pattern removed: AKIAIOSFODNN7EXAMPLE` |
| `tests/enterprise/test_secrets_scanning.py` | 35 | Test/doc file with known example token | `"pattern": "-----BEGIN RSA PRIVATE KEY-----",` |
| `tests/enterprise/test_secrets_scanning.py` | 85 | Test/doc file with known example token | `AWS_KEY = "AKIA1234567890ABCDEF"  # Fake key for testing` |
| `tests/enterprise/test_secrets_scanning.py` | 98 | Test/doc file with known example token | `assert "AKIA1234567890ABCDEF" in matches` |
| `tests/enterprise/test_secrets_scanning.py` | 124 | Test/doc file with known example token | `"""-----BEGIN RSA PRIVATE KEY-----` |
| `tests/enterprise/test_secrets_scanning.py` | 131 | Test/doc file with known example token | `assert "-----BEGIN RSA PRIVATE KEY-----" in content` |

## Known Safe Examples

The following tokens are known to be safe examples from official documentation:

- `AKIAIOSFODNN7EXAMPLE` - AWS official documentation example
- `AKIA0000000000000000` - Placeholder format
- `AKIA1234567890ABCDEF` - Test fixture
- `-----BEGIN RSA PRIVATE KEY-----` - Header line (allowed in tests/docs only)

