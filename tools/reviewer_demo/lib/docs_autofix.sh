#!/usr/bin/env bash
set -euo pipefail

log_docs() { echo "[DOCS-FIX] $*" >&2; }

fix_file() {
  local file="$1"

  # Skip dangerous paths/files
  [[ "$file" == *"BANNED_CLAIMS.txt"* ]] && return 0
  [[ "$file" == */node_modules/* ]] && return 0
  [[ "$file" == */.git/* ]] && return 0

  local tmpfile="${file}.tmp_autofix"

  # NOTE: Keep deterministic, no GNU-only flags.
  sed \
    -e 's/100%/best-effort/g' \
    -e 's/[Gg]uaranteed/intended/g' \
    -e 's/[Ee]nterprise-[Gg]rade/enterprise-oriented/g' \
    -e 's/[Ee]nterprise grade/enterprise-oriented/g' \
    -e 's/[Uu]nhackable/security-focused/g' \
    -e 's/[Mm]ilitary-[Gg]rade/hardened/g' \
    -e 's/[Bb]ulletproof/resilient/g' \
    -e 's/[Uu]nbreakable/robust/g' \
    -e 's/[Ff]oolproof/fail-safe/g' \
    -e 's/[Zz]ero-[Rr]isk/mitigated-risk/g' \
    "$file" > "$tmpfile"

  if ! diff -q "$file" "$tmpfile" >/dev/null 2>&1; then
    mv "$tmpfile" "$file"
    return 1  # indicate "changed"
  else
    rm -f "$tmpfile"
    return 0  # indicate "unchanged"
  fi
}

run_docs_autofix() {
  local repo_root="${1:-.}"
  log_docs "Starting documentation overclaim remediation..."
  log_docs "Repository: $repo_root"

  local fixed_count=0

  local doc_root
  for doc_root in \
    "$repo_root/docs" \
    "$repo_root/atlassian/forge-app/docs"
  do
    [[ -d "$doc_root" ]] || continue
    log_docs "Checking: $doc_root"

    # Process substitution avoids subshell counter loss
    while IFS= read -r file; do
      [[ -n "$file" ]] || continue
      if fix_file "$file"; then
        : # unchanged
      else
        # changed
        log_docs "Fixed: $file"
        fixed_count=$((fixed_count+1))
      fi
    done < <(find "$doc_root" -type f \( -name "*.md" -o -name "*.markdown" \) -not -name "BANNED_CLAIMS.txt" 2>/dev/null | LC_ALL=C sort)
  done

  if [[ -f "$repo_root/README.md" ]]; then
    if fix_file "$repo_root/README.md"; then
      :
    else
      log_docs "Fixed: $repo_root/README.md"
      fixed_count=$((fixed_count+1))
    fi
  fi

  log_docs "Documentation remediation complete: $fixed_count files fixed"
  return 0
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  run_docs_autofix "$@"
fi
