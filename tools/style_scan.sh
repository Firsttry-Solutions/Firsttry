#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

# FINAL-FINAL STYLE ENFORCEMENT SCAN
# Detects AI-generated patterns, hype language, emojis, and enforces professional standards

ENTERPRISE_DOCS=(
  "docs/SECURITY_SUMMARY.md"
  "docs/ENTERPRISE_ONE_PAGER.md"
  "docs/ROI_JUSTIFICATION.md"
  "docs/PRICING_RATIONALE.md"
  "docs/SUPPORT_POLICY.md"
  "docs/CHANGE_MANAGEMENT.md"
  "docs/ROADMAP.md"
  "docs/DOCS_INDEX.md"
)

AI_MARKERS=(
  "as an AI"
  "in conclusion"
  "overall"
  "it is important to note"
  "as mentioned above"
  "in summary"
  "as outlined above"
  "to summarize"
)

HYPE_WORDS=(
  "revolutionary"
  "cutting-edge"
  "best-in-class"
  "game-changer"
  "unparalleled"
  "world-class"
  "amazing"
  "incredible"
)

fail=0

echo "=========================================="
echo "FINAL-FINAL STYLE ENFORCEMENT SCAN"
echo "=========================================="
echo ""

# Phase A: AI marker detection
echo "PHASE A: AI Generated Pattern Detection"
for doc in "${ENTERPRISE_DOCS[@]}"; do
  [ ! -f "$doc" ] && continue
  
  doc_name=$(basename "$doc")
  
  for marker in "${AI_MARKERS[@]}"; do
    if grep -qi "$marker" "$doc"; then
      echo "✗ FAIL: $doc_name contains AI marker: '$marker'"
      grep -in "$marker" "$doc" | head -1
      fail=1
    fi
  done
done
echo "✓ No AI generation markers detected"
echo ""

# Phase B: Hype word detection
echo "PHASE B: Hype Word Detection"
for doc in "${ENTERPRISE_DOCS[@]}"; do
  [ ! -f "$doc" ] && continue
  
  doc_name=$(basename "$doc")
  
  for word in "${HYPE_WORDS[@]}"; do
    if grep -qi "$word" "$doc"; then
      echo "✗ FAIL: $doc_name contains hype word: '$word'"
      grep -in "$word" "$doc" | head -1
      fail=1
    fi
  done
done
echo "✓ No hype words detected"
echo ""

# Phase C: Emoji detection
echo "PHASE C: Emoji Character Detection"
for doc in "${ENTERPRISE_DOCS[@]}"; do
  [ ! -f "$doc" ] && continue
  
  doc_name=$(basename "$doc")
  
  # Check for common emoji characters (including symbols used in docs)
  if grep -P "[\x{1F300}-\x{1F9FF}✅❌⚠✓✗💡🎉✨🚀]" "$doc" >/dev/null 2>&1; then
    echo "✗ FAIL: $doc_name contains emoji characters"
    grep -Pno "[\x{1F300}-\x{1F9FF}✅❌⚠✓✗💡🎉✨🚀]" "$doc" | head -3
    fail=1
  fi
  
  # Also check for simple emoji patterns that appear in some shells
  if grep "✅\|❌\|⚠\|✓\|✗\|💡\|🎉\|✨\|🚀" "$doc" >/dev/null 2>&1; then
    echo "✗ FAIL: $doc_name contains emoji characters"
    grep -n "✅\|❌\|⚠\|✓\|✗\|💡\|🎉\|✨\|🚀" "$doc" | head -3
    fail=1
  fi
done
echo "✓ No emoji characters detected"
echo ""

# Phase D: Sentence cadence (avg words/sentence ≤ 28)
echo "PHASE D: Sentence Cadence Analysis"
for doc in "${ENTERPRISE_DOCS[@]}"; do
  [ ! -f "$doc" ] && continue
  
  doc_name=$(basename "$doc")
  
  words=$(wc -w < "$doc" 2>/dev/null || echo 0)
  sentences=$(grep -o "[.!?]" "$doc" 2>/dev/null | wc -l || echo 1)
  
  if [ "$sentences" -gt 0 ] && [ "$words" -gt 0 ]; then
    avg_sentence=$((words / sentences))
    
    if [ "$avg_sentence" -gt 28 ]; then
      echo "✗ FAIL: $doc_name has avg $avg_sentence words/sentence (max 28)"
      fail=1
    else
      echo "  $doc_name: $avg_sentence words/sentence (acceptable)"
    fi
  fi
done
echo "✓ Sentence cadence verified"
echo ""

# Summary
echo "=========================================="
if [ "$fail" -eq 0 ]; then
  echo "✓ FINAL-FINAL STYLE PASS"
  echo "=========================================="
  exit 0
else
  echo "✗ FINAL-FINAL STYLE FAIL"
  echo "=========================================="
  exit 1
fi
