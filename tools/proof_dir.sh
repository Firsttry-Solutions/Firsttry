#!/bin/bash
# proof_dir.sh: Create and return deterministic proof output directory
set -euo pipefail

UTCSTAMP=$(date -u +%Y%m%dT%H%M%SZ)
EVID="/tmp/ft_dash_fix_${UTCSTAMP}"
mkdir -p "$EVID"
echo "$EVID"
