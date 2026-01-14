#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
import re, sys, pathlib
try:
  import yaml
except Exception as e:
  print("FAIL: PyYAML missing. Install it or vendor a parser.", file=sys.stderr)
  sys.exit(2)

manifest = pathlib.Path("atlassian/forge-app/manifest.yml").read_text(encoding="utf-8")
doc = pathlib.Path("docs/SCOPES.md").read_text(encoding="utf-8")

m = yaml.safe_load(manifest) or {}
# Forge manifest scopes may live under permissions/scopes (varies by template).
scopes = []
perm = m.get("permissions") or {}
# Common patterns: permissions: scopes: [ ... ]
if isinstance(perm, dict) and "scopes" in perm:
  scopes = perm["scopes"] or []
elif "scopes" in m:
  scopes = m["scopes"] or []
if not isinstance(scopes, list):
  print("FAIL: manifest scopes not a list", file=sys.stderr); sys.exit(1)

# Docs parse: must have heading "## Declared Scopes" followed by "- scope" lines until blank or next heading.
lines = doc.splitlines()
try:
  start = lines.index("## Declared Scopes (Manifest) — Proof Anchors")
except ValueError:
  try:
    start = lines.index("## Declared Scopes")
  except ValueError:
    print("FAIL: docs/SCOPES.md missing heading '## Declared Scopes'", file=sys.stderr); sys.exit(1)

doc_scopes=[]
for ln in lines[start+1:]:
  if ln.startswith("## "): break
  if not ln.strip(): continue
  # Look for yaml code blocks with scopes
  if ln.startswith("    - "):
    doc_scopes.append(ln.strip()[2:].strip())

# Also look for markdown list items
for ln in lines[start+1:]:
  if ln.startswith("## "): break
  if not ln.strip(): continue
  if ln.startswith("- `") and ln.endswith("`"):
    scope_name = ln[3:-1]
    if scope_name not in doc_scopes:
      doc_scopes.append(scope_name)

# Normalize
ms = sorted(set(s.strip() for s in scopes if str(s).strip()))
ds = sorted(set(s.strip() for s in doc_scopes if s.strip()))

print(f"MANIFEST_SCOPES_COUNT={len(ms)}")
for s in ms: print("MANIFEST_SCOPE:", s)
print(f"DOC_SCOPES_COUNT={len(ds)}")
for s in ds: print("DOC_SCOPE:", s)

extra_in_manifest = [s for s in ms if s not in ds]
extra_in_docs = [s for s in ds if s not in ms]

if extra_in_manifest or extra_in_docs:
  if extra_in_manifest:
    print("FAIL: scopes present in manifest but missing in docs:", extra_in_manifest, file=sys.stderr)
  if extra_in_docs:
    print("FAIL: scopes present in docs but missing in manifest:", extra_in_docs, file=sys.stderr)
  sys.exit(1)

print("PASS: docs scopes match manifest scopes exactly.")
PY
