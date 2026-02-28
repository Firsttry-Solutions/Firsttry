#!/usr/bin/env bash
# lib/scoring.sh — F100 Hostile Audit v3.1 scoring model
# Call compute_final_score after all phases complete.

set -euo pipefail

compute_final_score() {
  local e="${E}"
  local score=100
  local decision=""
  local has_fail=0
  local high_count=0
  local high_count_blocking=0
  local med_count=0
  local low_count=0

  # Check for any FAIL
  if [[ -f "${e}/.all_fails" ]] && [[ -s "${e}/.all_fails" ]]; then
    has_fail=1
  fi

  # Count flags by severity from results.json
  # Count total HIGHs and blocking HIGHs separately
  if [[ -f "${e}/results.json" ]]; then
    high_count=$(jq '[.results[] | select(.status=="FLAG" and .severity=="HIGH")] | length' "${e}/results.json" 2>/dev/null || echo 0)
    high_count_blocking=$(jq '[.results[] | select(.status=="FLAG" and .severity=="HIGH" and (.allowlisted != true))] | length' "${e}/results.json" 2>/dev/null || echo 0)
    med_count=$(jq  '[.results[] | select(.status=="FLAG" and .severity=="MEDIUM")]| length' "${e}/results.json" 2>/dev/null || echo 0)
    low_count=$(jq  '[.results[] | select(.status=="FLAG" and .severity=="LOW")]   | length' "${e}/results.json" 2>/dev/null || echo 0)
  fi

  # CRITICAL FAIL penalty
  if [[ "$has_fail" -eq 1 ]]; then
    score=$(( score < 30 ? score : 30 ))
  fi

  # High FLAG penalties (use blocking count only for score)
  if [[ "$high_count_blocking" -eq 1 ]]; then
    score=$(( score - 15 ))
  elif [[ "$high_count_blocking" -eq 2 ]]; then
    score=$(( score < 65 ? score : 65 ))
    score=$(( score - 15 ))
  elif [[ "$high_count_blocking" -ge 3 ]]; then
    score=$(( score < 45 ? score : 45 ))
  fi

  # Medium FLAG penalty (cap 25 points total)
  local med_penalty=$(( med_count * 5 ))
  [[ $med_penalty -gt 25 ]] && med_penalty=25
  score=$(( score - med_penalty ))

  # Low FLAG penalty (cap 10 points total)
  local low_penalty=$low_count
  [[ $low_penalty -gt 10 ]] && low_penalty=10
  score=$(( score - low_penalty ))

  # Floor at 0
  [[ $score -lt 0 ]] && score=0

  # Decision rules (use blocking HIGH count only)
  if [[ "$has_fail" -eq 1 ]] || [[ "$score" -lt 50 ]]; then
    decision="REJECT"
  elif [[ "$high_count_blocking" -ge 3 ]]; then
    decision="REJECT"
  elif [[ "$score" -ge 85 ]] && [[ "$has_fail" -eq 0 ]] && [[ "$high_count_blocking" -lt 3 ]]; then
    decision="CONDITIONAL_ACCEPT"
  elif [[ "$score" -ge 70 ]]; then
    decision="CONDITIONAL_REMEDIATION_REQUIRED"
  elif [[ "$score" -ge 50 ]]; then
    decision="HIGH_RISK"
  else
    decision="REJECT"
  fi

  # Write scoring summary (include both total and blocking HIGH counts)
  cat > "${e}/SCORING_SUMMARY.json" <<EOF
{
  "score": ${score},
  "decision": "${decision}",
  "has_fail": ${has_fail},
  "high_flags": ${high_count},
  "high_flags_blocking": ${high_count_blocking},
  "high_flags_allowlisted": $(( high_count - high_count_blocking )),
  "medium_flags": ${med_count},
  "low_flags": ${low_count}
}
EOF

  echo "$score|$decision|$has_fail|$high_count|$med_count|$low_count|$high_count_blocking"
}

export -f compute_final_score
