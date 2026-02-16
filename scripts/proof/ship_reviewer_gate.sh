#!/bin/bash

##############################################################################
# [DEPRECATED in v3.2.7] - Use ship_reviewer_gate_ci.sh or ship_reviewer_gate_dev.sh
##############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib_proof.sh"

log_fail "═══════════════════════════════════════════════════════════════════"
log_fail "DEPRECATED SCRIPT"
log_fail "─────────────────────────────────────────────────────────────────"
log_fail "ship_reviewer_gate.sh is deprecated as of v3.2.7."
log_fail "Use one of:"
log_fail "  • ship_reviewer_gate_ci.sh  (for CI - strict, no fallback)"
log_fail "  • ship_reviewer_gate_dev.sh (for dev - may fallback)"
log_fail "═══════════════════════════════════════════════════════════════════"

exit 1
