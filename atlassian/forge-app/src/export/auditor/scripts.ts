/**
 * Generate verification scripts
 * Cross-platform verifiers: Linux/Mac (verify.sh) and Windows PowerShell (verify.ps1)
 * Validates CRITICAL artifacts: evidence.json and verifier scripts (no HTML hash)
 * HTML is a container only; not independently verified.
 *
 * FT_PROOF_VERIFY_SH_v1: Linux/Mac shell script for SHA-256 verification
 * FT_PROOF_VERIFY_PS1_v1: Windows PowerShell script for SHA-256 verification
 * FT_PROOF_VERIFY_CRITICAL_ARTIFACTS_ONLY_v1: Verifiers validate critical artifacts only (evidence + scripts)
 */

export function generateVerifySh(): string {
  console.log("[FT_PROOF_VERIFY_SH_v1]", { marker: "FT_PROOF_VERIFY_SH_v1" });
  console.log("[FT_PROOF_VERIFY_CRITICAL_ARTIFACTS_ONLY_v1]", { marker: "FT_PROOF_VERIFY_CRITICAL_ARTIFACTS_ONLY_v1" });

  return `#!/bin/bash
# FirstTry Auditor Evidence Verification Script (UNIX/Linux/Mac)
# Verifies SHA-256 integrity of CRITICAL artifacts: evidence.json and verifier scripts
# HTML is a container only; not independently verified

set -euo pipefail

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

# Check required files
echo "=== FirstTry Auditor Evidence Verification ==="
echo ""

FAIL_COUNT=0

if [ ! -f manifest.json ]; then
  echo -e "\${RED}❌ FAIL: manifest.json not found\${NC}"
  exit 1
fi

# Parse manifest (prefer node for JSON, fallback to grep)
if command -v node &>/dev/null; then
  extractHash() {
    node -e "console.log(JSON.parse(require('fs').readFileSync('manifest.json','utf8')).$1 || '')"
  }
else
  extractHash() {
    grep "\"$1\"" manifest.json | sed 's/.*: *"\\([^"]*\\)".*/\\1/' || echo ""
  }
fi

MANIFEST_EVIDENCE=$(extractHash "evidenceSha256")
MANIFEST_VERIFY_SH=$(extractHash "verifyShSha256")
MANIFEST_VERIFY_PS1=$(extractHash "verifyPs1Sha256")

# Helper: compute and compare hash
verifyFile() {
  local file=$1
  local expectedHash=$2
  local fileType=$3

  if [ -z "$expectedHash" ]; then
    echo -e "\${YELLOW}⚠️  SKIP: $fileType hash not in manifest\${NC}"
    return 0
  fi

  if [ ! -f "$file" ]; then
    echo -e "\${RED}❌ FAIL: $file not found\${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return 1
  fi

  # Compute actual hash
  local computedHash=""
  if command -v sha256sum &>/dev/null; then
    computedHash=$(sha256sum "$file" | awk '{print $1}')
  elif command -v shasum &>/dev/null; then
    computedHash=$(shasum -a 256 "$file" | awk '{print $1}')
  else
    echo -e "\${RED}❌ FAIL: Neither sha256sum nor shasum found\${NC}"
    exit 1
  fi

  if [ "$expectedHash" = "$computedHash" ]; then
    echo -e "\${GREEN}✅ PASS\${NC}: $fileType integrity verified"
    return 0
  else
    echo -e "\${RED}❌ FAIL\${NC}: $fileType hash mismatch"
    echo "  File:      $file"
    echo "  Expected:  $expectedHash"
    echo "  Computed:  $computedHash"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return 1
  fi
}

echo "Verifying CRITICAL artifacts..."
echo ""

# Verify critical artifacts (evidence + scripts; no HTML)
verifyFile "evidence.json" "$MANIFEST_EVIDENCE" "Evidence JSON"
verifyFile "verify.sh" "$MANIFEST_VERIFY_SH" "Verify.sh Script"
verifyFile "verify.ps1" "$MANIFEST_VERIFY_PS1" "Verify.ps1 Script"

echo ""
if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "\${GREEN}✅ SUCCESS: All critical artifacts verified intact (tamper-evident confirmed)\${NC}"
  exit 0
else
  echo -e "\${RED}❌ FAILURE: $FAIL_COUNT artifact(s) failed verification\${NC}"
  exit 1
fi
`;
}

export function generateVerifyPs1(): string {
  console.log("[FT_PROOF_VERIFY_PS1_v1]", { marker: "FT_PROOF_VERIFY_PS1_v1" });
  console.log("[FT_PROOF_VERIFY_CRITICAL_ARTIFACTS_ONLY_v1]", { marker: "FT_PROOF_VERIFY_CRITICAL_ARTIFACTS_ONLY_v1" });

  return `# FirstTry Auditor Evidence Verification Script (Windows PowerShell)
# Verifies SHA-256 integrity of CRITICAL artifacts: evidence.json and verifier scripts
# HTML is a container only; not independently verified

$FailCount = 0

# Check manifest exists
if (!(Test-Path "manifest.json")) {
    Write-Host "❌ FAIL: manifest.json not found" -ForegroundColor Red
    exit 1
}

Write-Host "=== FirstTry Auditor Evidence Verification ===" -ForegroundColor Cyan
Write-Host ""

# Read manifest
try {
    $manifestJson = Get-Content "manifest.json" -Raw | ConvertFrom-Json
} catch {
    Write-Host "❌ FAIL: Could not parse manifest.json" -ForegroundColor Red
    exit 1
}

# Helper function to verify a file
function Verify-ArtifactHash {
    param(
        [string]$FilePath,
        [string]$ExpectedHash,
        [string]$ArtifactName
    )

    if (-not $ExpectedHash) {
        Write-Host "⚠️  SKIP: $ArtifactName hash not in manifest" -ForegroundColor Yellow
        return
    }

    if (!(Test-Path $FilePath)) {
        Write-Host "❌ FAIL: $FilePath not found" -ForegroundColor Red
        $script:FailCount++
        return
    }

    try {
        $fileHash = Get-FileHash -Path $FilePath -Algorithm SHA256
        $computedHash = $fileHash.Hash.ToLower()

        if ($ExpectedHash -eq $computedHash) {
            Write-Host "✅ PASS: $ArtifactName integrity verified" -ForegroundColor Green
        } else {
            Write-Host "❌ FAIL: $ArtifactName hash mismatch" -ForegroundColor Red
            Write-Host "  File:      $FilePath" -ForegroundColor Red
            Write-Host "  Expected:  $ExpectedHash" -ForegroundColor Red
            Write-Host "  Computed:  $computedHash" -ForegroundColor Red
            $script:FailCount++
        }
    } catch {
        Write-Host "❌ FAIL: Could not compute hash for $FilePath" -ForegroundColor Red
        $script:FailCount++
    }
}

Write-Host "Verifying CRITICAL artifacts..." -ForegroundColor Cyan
Write-Host ""

# Verify critical artifacts (evidence + scripts; no HTML)
Verify-ArtifactHash "evidence.json" $manifestJson.evidenceSha256 "Evidence JSON"
Verify-ArtifactHash "verify.sh" $manifestJson.verifyShSha256 "Verify.sh Script"
Verify-ArtifactHash "verify.ps1" $manifestJson.verifyPs1Sha256 "Verify.ps1 Script"

Write-Host ""
if ($FailCount -eq 0) {
    Write-Host "✅ SUCCESS: All critical artifacts verified intact (tamper-evident confirmed)" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ FAILURE: $FailCount artifact(s) failed verification" -ForegroundColor Red
    exit 1
}
`;
}
