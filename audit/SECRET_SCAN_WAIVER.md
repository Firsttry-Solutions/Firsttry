# Secret Scan Waiver

**Purpose**: This document explains why certain secret-like patterns exist in the repository.

**Scope**: All allowed patterns are either:
- Test fixtures using well-known example tokens (e.g., AWS official documentation examples)
- Documentation files referencing previously remediated secrets or explaining security practices
- Audit/proof documents that quote known example tokens for verification purposes

**Generated**: ft_final_secret_20260206T085635Z

## Classification Results

- **Total secret pattern matches**: 26
- **Allowed (waived)**: 26
- **Forbidden (real secrets)**: 0

## Allowed Patterns (Redacted)

**Note**: Tokens shown below are redacted to prevent self-referential scanning. See `44_secret_scan_classified.json` for SHA256 hashes for deterministic verification.

| File | Line | Token Type | Redacted Token | SHA256 (first 16) | Reason |
|------|-----:|------------|----------------|-------------------|--------|
| `FINAL_VERIFICATION_REPORT.txt` | 9 | PRIVATE_KEY_HEADER | `PRIVATE_KEY_HEADER` | `8bcac7908eb95041…` | Test/doc file with known example token |
| `FINAL_VERIFICATION_REPORT.txt` | 10 | AWS_ACCESS_KEY | `AKIA…MPLE` | `1a5d44a2dca19669…` | Test/doc file with known example token |
| `FINAL_VERIFICATION_REPORT.txt` | 13 | PRIVATE_KEY_HEADER | `PRIVATE_KEY_HEADER` | `8bcac7908eb95041…` | Test/doc file with known example token |
| `FINAL_VERIFICATION_REPORT.txt` | 14 | AWS_ACCESS_KEY | `AKIA…MPLE` | `1a5d44a2dca19669…` | Test/doc file with known example token |
| `FINAL_VERIFICATION_REPORT.txt` | 77 | PRIVATE_KEY_HEADER | `PRIVATE_KEY_HEADER` | `8bcac7908eb95041…` | Test/doc file with known example token |
| `FINAL_VERIFICATION_REPORT.txt` | 82 | AWS_ACCESS_KEY | `AKIA…MPLE` | `1a5d44a2dca19669…` | Test/doc file with known example token |
| `scripts/strict_secret_scan.sh` | 74 | AWS_ACCESS_KEY | `AKIA…MPLE` | `1a5d44a2dca19669…` | Test/doc file with known example token |
| `scripts/strict_secret_scan.sh` | 75 | AWS_ACCESS_KEY | `AKIA…0000` | `57028a916a4ba4e7…` | Test/doc file with known example token |
| `scripts/strict_secret_scan.sh` | 76 | AWS_ACCESS_KEY | `AKIA…CDEF` | `743554670c6065b3…` | Test/doc file with known example token |
| `SECRET_REMEDIATE_PROOF_SUMMARY.txt` | 14 | PRIVATE_KEY_HEADER | `PRIVATE_KEY_HEADER` | `8bcac7908eb95041…` | Test/doc file with known example token |
| `SECRET_REMEDIATE_PROOF_SUMMARY.txt` | 19 | AWS_ACCESS_KEY | `AKIA…MPLE` | `1a5d44a2dca19669…` | Test/doc file with known example token |
| `COMPLETE_REMEDIATION_REPORT.md` | 15 | PRIVATE_KEY_HEADER | `PRIVATE_KEY_HEADER` | `8bcac7908eb95041…` | Test/doc file with known example token |
| `COMPLETE_REMEDIATION_REPORT.md` | 16 | AWS_ACCESS_KEY | `AKIA…MPLE` | `1a5d44a2dca19669…` | Test/doc file with known example token |
| `COMPLETE_REMEDIATION_REPORT.md` | 21 | PRIVATE_KEY_HEADER | `PRIVATE_KEY_HEADER` | `8bcac7908eb95041…` | Test/doc file with known example token |
| `COMPLETE_REMEDIATION_REPORT.md` | 22 | AWS_ACCESS_KEY | `AKIA…MPLE` | `1a5d44a2dca19669…` | Test/doc file with known example token |
| `MERGE_READINESS_PROOF_PACK_V2.md` | 92 | PRIVATE_KEY_HEADER | `PRIVATE_KEY_HEADER` | `8bcac7908eb95041…` | Test/doc file with known example token |
| `MERGE_READINESS_PROOF_PACK_V2.md` | 97 | AWS_ACCESS_KEY | `AKIA…MPLE` | `1a5d44a2dca19669…` | Test/doc file with known example token |
| `MERGE_READINESS_PROOF_PACK_V2.md` | 187 | PRIVATE_KEY_HEADER | `PRIVATE_KEY_HEADER` | `8bcac7908eb95041…` | Test/doc file with known example token |
| `MERGE_READINESS_PROOF_PACK_V2.md` | 196 | AWS_ACCESS_KEY | `AKIA…MPLE` | `1a5d44a2dca19669…` | Test/doc file with known example token |
| `MERGE_READINESS_PROOF_PACK_V2.md` | 201 | AWS_ACCESS_KEY | `AKIA…0000` | `57028a916a4ba4e7…` | Test/doc file with known example token |
| `atlassian/forge-app/tests/p1_logging_safety.test.ts` | 86 | AWS_ACCESS_KEY | `AKIA…MPLE` | `1a5d44a2dca19669…` | Test/doc file with known example token |
| `tests/enterprise/test_secrets_scanning.py` | 35 | PRIVATE_KEY_HEADER | `PRIVATE_KEY_HEADER` | `8bcac7908eb95041…` | Test/doc file with known example token |
| `tests/enterprise/test_secrets_scanning.py` | 85 | AWS_ACCESS_KEY | `AKIA…CDEF` | `743554670c6065b3…` | Test/doc file with known example token |
| `tests/enterprise/test_secrets_scanning.py` | 98 | AWS_ACCESS_KEY | `AKIA…CDEF` | `743554670c6065b3…` | Test/doc file with known example token |
| `tests/enterprise/test_secrets_scanning.py` | 124 | PRIVATE_KEY_HEADER | `PRIVATE_KEY_HEADER` | `8bcac7908eb95041…` | Test/doc file with known example token |
| `tests/enterprise/test_secrets_scanning.py` | 131 | PRIVATE_KEY_HEADER | `PRIVATE_KEY_HEADER` | `8bcac7908eb95041…` | Test/doc file with known example token |

## Known Safe Token Types

The following token types are allowed in test/doc contexts:

- **AWS_ACCESS_KEY**: AWS official documentation examples (format: AKIA + 16 alphanumeric)
- **PRIVATE_KEY_HEADER**: PEM format key headers (allowed in test fixtures)
- **GITHUB_TOKEN**: GitHub personal access tokens (format: ghp_ + 36 chars)
- **SLACK_TOKEN**: Slack API tokens (format: xox[baprs]- + chars)
- **GOOGLE_API_KEY**: Google API keys (format: AIza + 35 chars)
- **OPENAI_KEY**: OpenAI API keys (format: sk- + 20+ chars)

