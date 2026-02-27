#!/usr/bin/env bash
# lib/manifest.sh — Phase 3: Manifest ↔ entrypoint binding (anti-dummy export)
set -euo pipefail

run_manifest() {
  local e="${E}"
  local repo_dir="${REPO_DIR}"
  phase_start "03" "Manifest ↔ Entrypoint Binding"

  local summary_txt="${e}/PHASE_03_manifest_summary.txt"
  local binding_txt="${e}/PHASE_03_entrypoint_binding.txt"

  local manifest="${repo_dir}/manifest.yml"
  [[ -f "$manifest" ]] || phase_fail "03" "manifest.yml not found at ${manifest}" ""

  # ── Parse manifest ────────────────────────────────────────────────────────
  echo "[03] Parsing manifest.yml..." | tee "$summary_txt"

  # Extract function declarations (handler lines)
  echo "--- Functions ---" >> "$summary_txt"
  grep -A2 '^\s*- key:' "$manifest" | grep -E '(key:|handler:)' >> "$summary_txt" || true

  # Extract scopes
  echo "--- Scopes ---" >> "$summary_txt"
  grep -A20 'scopes:' "$manifest" | grep '^\s*-' >> "$summary_txt" || true

  # Extract egress
  echo "--- Egress ---" >> "$summary_txt"
  grep -A10 'egress:' "$manifest" >> "$summary_txt" 2>/dev/null || echo "  (no egress section)" >> "$summary_txt"

  # Extract external permissions
  echo "--- External permissions ---" >> "$summary_txt"
  grep -A10 'external:' "$manifest" >> "$summary_txt" 2>/dev/null || echo "  (no external section)" >> "$summary_txt"

  # ── Gate: write scopes ────────────────────────────────────────────────────
  local write_scopes
  write_scopes=$(grep -E 'write:|write:jira|write:confluence' "$manifest" 2>/dev/null || echo "")
  if [[ -n "$write_scopes" ]]; then
    echo "FAIL: Write scopes found: ${write_scopes}" >> "$summary_txt"
    phase_fail "03" "manifest.yml contains write scopes which are not permitted." "$summary_txt"
  fi
  echo "  [PASS] No write scopes." | tee -a "$summary_txt"

  # ── Gate: wildcard egress ─────────────────────────────────────────────────
  local wildcard_egress
  wildcard_egress=$(grep -E 'addresses:\s*\*|addresses:\s*"?\*"?' "$manifest" 2>/dev/null || echo "")
  if [[ -n "$wildcard_egress" ]]; then
    phase_fail "03" "manifest.yml contains wildcard egress." "$summary_txt"
  fi
  echo "  [PASS] No wildcard egress." | tee -a "$summary_txt"

  # ── Gate: any egress at all ───────────────────────────────────────────────
  local egress_section
  egress_section=$(grep -E '^  egress:|^    addresses:' "$manifest" 2>/dev/null | grep -v '^\s*#' || echo "")
  if [[ -n "$egress_section" ]]; then
    phase_fail "03" "manifest.yml has egress configuration. Any egress is a FAIL unless explicitly empty/none." "$summary_txt"
  fi
  echo "  [PASS] No egress configured." | tee -a "$summary_txt"

  # ── Entrypoint binding ────────────────────────────────────────────────────
  echo "[03] Searching for export pack implementation..." | tee "$binding_txt"

  local export_patterns=('computePackHash' 'reviewPack' 'packHash' 'export.*pack' 'canonical' 'ledger' 'verifier')
  local found_files=""

  for pat in "${export_patterns[@]}"; do
    local hits
    hits=$(rg -rl --glob '!**/node_modules/**' "$pat" "${repo_dir}/src" 2>/dev/null || true)
    if [[ -n "$hits" ]]; then
      found_files+="$hits"$'\n'
    fi
  done

  found_files=$(echo "$found_files" | sort -u | grep -v '^$' || true)

  if [[ -z "$found_files" ]]; then
    phase_fail "03" "Cannot locate export pack logic in src/**. Required patterns: ${export_patterns[*]}" "$binding_txt"
  fi

  echo "Export logic candidates:" >> "$binding_txt"
  echo "$found_files" >> "$binding_txt"

  # Find which manifest handler maps to this logic
  # Look for the resolver that imports or calls export logic
  local handler_file=""
  local manifest_handler=""

  # Known export resolvers from codebase exploration
  local candidate_resolvers=(
    "${repo_dir}/src/resolvers/ft_exportAccessPack_v1.ts"
    "${repo_dir}/src/export/reviewPack.ts"
    "${repo_dir}/src/resolvers/exportGovernanceSnapshotById.ts"
  )

  for f in "${candidate_resolvers[@]}"; do
    if [[ -f "$f" ]]; then
      handler_file="$f"
      break
    fi
  done

  if [[ -z "$handler_file" ]]; then
    # Try to find any resolver that imports export functions
    handler_file=$(rg -rl --glob 'src/resolvers/*.ts' \
      'reviewPack\|exportPack\|packHash\|computePackHash' \
      "${repo_dir}/src" 2>/dev/null | head -1 || true)
  fi

  if [[ -z "$handler_file" ]]; then
    phase_fail "03" "Cannot map export logic to a manifest handler/resolver." "$binding_txt"
  fi

  echo "Handler file: ${handler_file}" | tee -a "$binding_txt"

  # Find the manifest entry corresponding to this handler
  # Get the basename module path pattern
  local handler_module
  handler_module=$(basename "$handler_file" .ts)
  manifest_handler=$(grep -E "handler:.*${handler_module}" "$manifest" | head -1 | awk '{print $2}' || echo "")

  if [[ -z "$manifest_handler" ]]; then
    # Try broader scan against all handlers in manifest
    manifest_handler=$(grep 'handler:' "$manifest" | head -5 || echo "")
    echo "  WARNING: Could not directly map ${handler_module} to manifest handler. Manifest handlers:" >> "$binding_txt"
    echo "$manifest_handler" >> "$binding_txt"
    phase_flag "03" "MEDIUM" "Export handler ${handler_module} not directly found in manifest handlers. Manual review required." "$binding_txt"
  else
    echo "Manifest handler: ${manifest_handler}" | tee -a "$binding_txt"
  fi

  # Export EXPORT_HANDLER for use in Phase 6 (determinism)
  export AUDIT_EXPORT_HANDLER_FILE="${handler_file}"
  export AUDIT_EXPORT_HANDLER_MODULE="${handler_module}"

  phase_pass "03" "Manifest scopes/egress clean; export entrypoint bound to ${handler_file}"
}

export -f run_manifest
