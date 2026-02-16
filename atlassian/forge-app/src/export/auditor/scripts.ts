/**
 * Generate verification scripts
 * Cross-platform verifiers: Linux/Mac (verify.sh) and Windows PowerShell (verify.ps1)
 *
 * FT_PROOF_VERIFY_SH_v1: Linux/Mac shell script for SHA-256 verification
 * FT_PROOF_VERIFY_PS1_v1: Windows PowerShell script for SHA-256 verification
 */

export function generateVerifySh(): string {
  console.log("[FT_PROOF_VERIFY_SH_v1]", { marker: "FT_PROOF_VERIFY_SH_v1" });

  return `#!/bin/bash
# FirstTry Auditor Evidence Verification Script (UNIX/Linux/Mac)
# Verifies SHA-256 integrity of evidence.json against manifest

set -euo pipefail

# Check required files
if [ ! -f evidence.json ]; then
  echo "❌ FAIL: evidence.json not found"
  exit 1
fi

if [ ! -f manifest.json ]; then
  echo "❌ FAIL: manifest.json not found"
  exit 1
fi

echo "=== FirstTry Auditor Evidence Verification ==="
echo ""

# Read expected hash from manifest (using node or fallback grep + awk)
if command -v node &>/dev/null; then
  EXPECTED_HASH=$(node -e "console.log(JSON.parse(require('fs').readFileSync('manifest.json','utf8')).evidenceSha256)")
else
  # Fallback: grep + sed + awk (best-effort)
  EXPECTED_HASH=$(grep '"evidenceSha256"' manifest.json | sed 's/.*: *"\\([^"]*\\)".*/\\1/')
fi

if [ -z "$EXPECTED_HASH" ]; then
  echo "❌ FAIL: Could not extract evidenceSha256 from manifest.json"
  exit 1
fi

# Compute actual hash (prefer sha256sum, fallback to shasum)
if command -v sha256sum &>/dev/null; then
  COMPUTED_HASH=$(sha256sum evidence.json | awk '{print $1}')
elif command -v shasum &>/dev/null; then
  COMPUTED_HASH=$(shasum -a 256 evidence.json | awk '{print $1}')
else
  echo "❌ FAIL: Neither sha256sum nor shasum found"
  exit 1
fi

# Compare
echo "Expected:  $EXPECTED_HASH"
echo "Computed:  $COMPUTED_HASH"
echo ""

if [ "$EXPECTED_HASH" = "$COMPUTED_HASH" ]; then
  echo "✅ PASS: Internal consistency verified (evidence.json intact)"
  exit 0
else
  echo "❌ FAIL: Hash mismatch - possible tampering"
  exit 1
fi
`;
}

export function generateVerifyPs1(): string {
  console.log("[FT_PROOF_VERIFY_PS1_v1]", { marker: "FT_PROOF_VERIFY_PS1_v1" });

  return `# FirstTry Auditor Evidence Verification Script (Windows PowerShell)
# Verifies SHA-256 integrity of evidence.json against manifest

param(
    [string]$ManifestFile = "manifest.json",
    [string]$EvidenceFile = "evidence.json"
)

# Check required files
if (!(Test-Path $EvidenceFile)) {
    Write-Host "❌ FAIL: $EvidenceFile not found" -ForegroundColor Red
    exit 1
}

if (!(Test-Path $ManifestFile)) {
    Write-Host "❌ FAIL: $ManifestFile not found" -ForegroundColor Red
    exit 1
}

Write-Host "=== FirstTry Auditor Evidence Verification ===" -ForegroundColor Cyan
Write-Host ""

# Read manifest and extract expected hash
try {
    $manifestJson = Get-Content $ManifestFile -Raw | ConvertFrom-Json
    $expectedHash = $manifestJson.evidenceSha256
} catch {
    Write-Host "❌ FAIL: Could not parse $ManifestFile" -ForegroundColor Red
    exit 1
}

if (-not $expectedHash) {
    Write-Host "❌ FAIL: evidenceSha256 not found in manifest" -ForegroundColor Red
    exit 1
}

# Compute hash using Get-FileHash (PowerShell 4.0+)
try {
    $fileHash = Get-FileHash -Path $EvidenceFile -Algorithm SHA256
    $computedHash = $fileHash.Hash.ToLower()
} catch {
    Write-Host "❌ FAIL: Could not compute hash (Get-FileHash failed)" -ForegroundColor Red
    exit 1
}

# Compare
Write-Host "Expected:  $expectedHash"
Write-Host "Computed:  $computedHash"
Write-Host ""

if ($expectedHash -eq $computedHash) {
    Write-Host "✅ PASS: Internal consistency verified (evidence.json intact)" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ FAIL: Hash mismatch - possible tampering" -ForegroundColor Red
    exit 1
}
`;
}
