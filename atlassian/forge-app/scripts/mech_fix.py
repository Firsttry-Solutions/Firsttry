#!/usr/bin/env python3
from pathlib import Path
import re
import sys
from datetime import datetime

root=Path('/workspaces/Firsttry/atlassian/forge-app')
IN=Path('/tmp/typecheck_after_shim_removal.txt')
if not IN.exists():
    print('Missing input', IN)
    sys.exit(1)
TS=datetime.utcnow().strftime('%Y%m%d_%H%M%S')
OUT=Path(f'/tmp/typecheck_mech_fix_{TS}')
OUT.mkdir(parents=True, exist_ok=True)

text=IN.read_text(errors='replace')
# anchors
pat_lines=re.compile(r'(error TS|Cannot find module|TS2362|TS2307|TS2552|TS2686|TS6133|TS2578|\.(ts|tsx)\()')
anchors=[line for line in text.splitlines() if pat_lines.search(line)]
with (OUT/'00_anchors.txt').open('w') as f:
    f.write('\n'.join(anchors[:260]))

# files
file_pat=re.compile(r'(src/[^:(]+\.(?:ts|tsx))')
files=sorted(set(file_pat.findall('\n'.join(anchors)) ))
# file_pat.findall returns tuples if groups; normalize
files2=[]
for m in file_pat.finditer('\n'.join(anchors)):
    files2.append(m.group(1))
files_sorted=sorted(set(files2))
with (OUT/'01_files.txt').open('w') as f:
    f.write('\n'.join(files_sorted))

# mechanical import fixes
updated=[]
for rel in files_sorted:
    p=root/rel
    if not p.exists():
        continue
    if p.suffix not in ('.ts','.tsx'):
        continue
    txt=p.read_text(encoding='utf-8', errors='replace')
    orig=txt
    def ensure_import(txt, imp_line):
        if imp_line in txt:
            return txt
        lines=txt.splitlines(True)
        last_imp=-1
        for i,l in enumerate(lines[:80]):
            if l.startswith('import '):
                last_imp=i
        if last_imp>=0:
            lines.insert(last_imp+1, imp_line+'\n')
        else:
            lines.insert(0, imp_line+'\n')
        return ''.join(lines)
    if p.suffix=='.tsx' and re.search(r"from\s+['\"]react['\"]", txt) is None:
        txt=ensure_import(txt, 'import React from "react";')
    uses_view = ('view(' in txt) or ('<' in txt and p.suffix=='.tsx' and 'src/admin' in str(p))
    if uses_view and re.search(r"import\s+\{[^}]*\bview\b[^}]*\}\s+from\s+['\"]@forge/ui['\"]", txt) is None:
        txt=ensure_import(txt, 'import { view } from "@forge/ui";')
    if txt!=orig:
        p.write_text(txt, encoding='utf-8')
        updated.append(rel)
with (OUT/'02_import_fixes.txt').open('w') as f:
    f.write('\n'.join(['UPDATED '+u for u in updated]))

# TS2362 contexts: find first 3 files
ts2362_pat=re.compile(r'^(src/[^:(]+\.(?:ts|tsx))\((\d+),(\d+)\): error TS2362', re.M)
hits=[]
for m in ts2362_pat.finditer(text):
    hits.append((m.group(1), int(m.group(2))))
seen=set(); sel=[]
for f,ln in hits:
    if f not in seen:
        seen.add(f); sel.append((f,ln))
    if len(sel)==3: break
with (OUT/'03_ts2362.txt').open('w') as f:
    f.write('TS2362_CONTEXT_FILES:\n')
    for fpath,ln in sel:
        p=root/fpath
        if not p.exists():
            f.write(f'MISSING {fpath}\n')
            continue
        lines=p.read_text(errors='replace').splitlines()
        a=max(1, ln-30); b=min(len(lines), ln+30)
        f.write(f'\n--- {fpath}:{ln} (context {a}-{b}) ---\n')
        for i in range(a,b+1):
            f.write(f"{i:>4} {lines[i-1]}\n")

# Missing module verification
with (OUT/'04_missing_modules.txt').open('w') as f:
    ts2307_pat=re.compile(r"^(src/[^:(]+\.(?:ts|tsx))\((\d+),(\d+)\): error TS2307: Cannot find module '([^']+)'", re.M)
    cnt=0
    for m in ts2307_pat.finditer(text):
        file=m.group(1); mod=m.group(4)
        cnt+=1
        if cnt>50: break
        if mod.startswith('.'):
            base=(root/file).parent
            cand=(base/mod)
            exists=False
            for ext in ['.ts','.tsx','.js','.cjs','.mjs']:
                if (cand.with_suffix(ext)).exists(): exists=True; break
            if (cand/'index.ts').exists() or (cand/'index.tsx').exists(): exists=True
            f.write(f"{file} -> {mod} ; resolved={cand} ; exists={exists}\n")
        else:
            f.write(f"{file} -> {mod} ; non-relative (do not auto-fix)\n")

# Re-run tsc
import subprocess
out_file=OUT/'typecheck_after_mech.txt'
with out_file.open('w') as fh:
    proc=subprocess.run(['npm','run','type-check'], cwd=str(root), stdout=fh, stderr=subprocess.STDOUT)

# collect remaining anchors
with (OUT/'06_remaining_anchors.txt').open('w') as f:
    t=out_file.read_text(errors='replace')
    pat2=re.compile(r'(error TS|Cannot find module|TS2362|TS2307|TS2552|TS2686|TS6133|TS2578)')
    lines=[ln for ln in t.splitlines() if pat2.search(ln)]
    f.write('\n'.join(lines[:220]))

print('OUT='+str(OUT))
print('DONE')
