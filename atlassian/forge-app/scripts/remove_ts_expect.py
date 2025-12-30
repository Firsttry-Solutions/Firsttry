#!/usr/bin/env python3
from pathlib import Path
import re
import sys
from collections import defaultdict

if len(sys.argv)<2:
    print('Usage: remove_ts_expect.py OUTDIR')
    sys.exit(1)
OUTDIR=Path(sys.argv[1])
root=Path('/workspaces/Firsttry/atlassian/forge-app')
text=(OUTDIR/'typecheck_after.txt').read_text(errors='replace').splitlines()
pat=re.compile(r"^(src/[^:(]+\.(?:ts|tsx))\((\d+),(\d+)\): error TS2578")
hits=[]
for ln in text:
    m=pat.search(ln)
    if m:
        hits.append((m.group(1), int(m.group(2))))
hits=hits[:200]
byfile=defaultdict(list)
for f,l in hits:
    byfile[f].append(l)
removed=[]
for f, lines in byfile.items():
    p=root/f
    if not p.exists():
        continue
    lines_sorted=sorted(set(lines), reverse=True)
    txt=p.read_text(errors='replace').splitlines(True)
    changed=False
    for ln in lines_sorted:
        idx=ln-1
        if 0<=idx<len(txt) and '@ts-expect-error' in txt[idx]:
            txt.pop(idx)
            changed=True
            removed.append((f,ln))
    if changed:
        p.write_text(''.join(txt), encoding='utf-8')

print('REMOVED_COUNT', len(removed))
for r in removed[:200]:
    print('REMOVED', r[0], r[1])
