#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

# Human-Professional Style Scanner for Enterprise Docs Only
OUTPUT_FILE="${1:-.style_scan_report.txt}"

# Only scan these enterprise docs
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

echo "=================================================="
echo "HUMAN-PROFESSIONAL STYLE SCAN (Enterprise Docs)"
echo "=================================================="
echo ""

{
  echo "STYLE SCAN REPORT - ENTERPRISE DOCUMENTATION"
  echo "=============================================="
  echo ""
  echo "Scan Date: $(date)"
  echo ""

  style_issues=0

  for doc in "${ENTERPRISE_DOCS[@]}"; do
    [ -f "$doc" ] || continue
    
    doc_issues=0
    doc_name=$(basename "$doc")
    
    echo ""
    echo "FILE: $doc_name"
    echo "---"

    # Check for hedging language 
    hedges=$(grep -ci "arguably\|might\|perhaps\|possibly\|seems\|appears\|could be\|may be" "$doc" 2>/dev/null || true)
    if [ "$hedges" -gt 3 ]; then
      echo "  ⚠ HEDGING_LANGUAGE: Found $hedges instances (consider direct language)"
      ((doc_issues++))
      ((style_issues++))
    else
      echo "  ✓ Hedging language acceptable ($hedges instances)"
    fi

    # Calculate average sentence length
    sentences=$(grep -o "[.!?]" "$doc" 2>/dev/null | wc -l)
    words=$(wc -w < "$doc" 2>/dev/null || echo 0)
    if [ "$sentences" -gt 0 ]; then
      avg_sentence_length=$((words / sentences))
      if [ "$avg_sentence_length" -gt 28 ]; then
        echo "  ⚠ LONG_SENTENCES: Avg $avg_sentence_length words/sentence (goal: ≤28)"
        ((doc_issues++))
        ((style_issues++))
      else
        echo "  ✓ Sentence cadence: $avg_sentence_length words/sentence (good)"
      fi
    fi

    # Check for passive voice
    passive=$(grep -cE " is | are | was | were " "$doc" 2>/dev/null || true)
    passive_ratio=$((passive * 100 / (words > 0 ? words : 1)))
    if [ "$passive_ratio" -gt 15 ]; then
      echo "  ⚠ PASSIVE_VOICE: High passive voice usage (${passive_ratio}% of words)"
      ((doc_issues++))
      ((style_issues++))
    else
      echo "  ✓ Voice balance acceptable"
    fi

    if [ "$doc_issues" -eq 0 ]; then
      echo "  ✅ STYLE_PASS"
    else
      echo "  Issues: $doc_issues"
    fi
  done

  echo ""
  echo "=================================================="
  echo "SUMMARY"
  echo "=================================================="
  if [ "$style_issues" -eq 0 ]; then
    echo "✅ STYLE_SCAN_PASS"
    echo "All enterprise documentation meets style standards"
  else
    echo "⚠️  STYLE_ISSUES: $style_issues found"
    echo "Review flagged items"
  fi
  
} | tee "$OUTPUT_FILE"

echo ""
echo "Report saved to: $OUTPUT_FILE"
exit 0
