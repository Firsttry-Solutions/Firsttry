#!/usr/bin/env python3
import sys
from pathlib import Path
import re
import subprocess
from datetime import datetime

root = Path('/workspaces/Firsttry/atlassian/forge-app')
if len(sys.argv) < 2:
    print('Usage: anchor_fix.py OUTDIR')
    sys.exit(1)
OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)

# 0) snapshot git status
with (OUT/'00_status.txt').open('w') as f:
    f.write(subprocess.run(['git','-C',str(root.parent),'status','--porcelain=v1'], stdout=subprocess.PIPE).stdout.decode())
    f.write('\n')
    f.write(subprocess.run(['git','-C',str(root.parent),'diff','--name-only'], stdout=subprocess.PIPE).stdout.decode())

# 1) audit .d.ts
with (OUT/'01_dts_audit.txt').open('w') as f:
    for p in root.glob('src/**/*.d.ts'):
        try:
            f.write(str(p.relative_to(root))+'\n')
        except Exception:
            f.write(str(p)+'\n')

shim = root/'src/types/forge-shims.d.ts'
if shim.exists():
    s = shim.read_text(errors='replace')
    forbidden = re.search(r'declare global|interface Window|\bdocument\b|\bwindow\b|namespace JSX|HTMLElement|React\.', s)
    if forbidden:
        with (OUT/'01_dts_audit.txt').open('a') as f:
            f.write(f'ERROR: forbidden content in {shim}\n')
            for m in re.finditer(r'.{0,60}(declare global|interface Window|\bdocument\b|\bwindow\b|namespace JSX|HTMLElement|React\.).{0,60}', s):
                f.write(m.group(0)+'\n')
        print('Forbidden shim content found; aborting', file=sys.stderr)
        sys.exit(2)
    if not re.search(r'^\s*declare module ', s, re.M):
        with (OUT/'01_dts_audit.txt').open('a') as f:
            f.write('ERROR: shim does not contain module declarations\n')
            f.write(s[:200])
        print('Shim invalid; aborting', file=sys.stderr)
        sys.exit(3)

# 2) run typecheck
print('Running type-check...')
with (OUT/'typecheck_before.txt').open('wb') as fh:
    proc = subprocess.run(['npm','run','type-check'], cwd=str(root), stdout=fh, stderr=subprocess.STDOUT)

# 3) extract anchors
text = (OUT/'typecheck_before.txt').read_text(errors='replace')
anchor_lines = [ln for ln in text.splitlines() if re.search(r'error TS|Cannot find module|TS2578|TS2307|TS2362|TS2552|TS6133', ln)]
(OUT/'03_anchors_before.txt').write_text('\n'.join(anchor_lines[:200]))

# 4A) Remove @ts-expect-error lines for listed TS2578 anchors (up to 20)
pattern_2578 = re.compile(r"^(src/[^:(]+\.(?:ts|tsx))\((\d+),(\d+)\): error TS2578")
hits_2578 = []
for ln in anchor_lines:
    m = pattern_2578.search(ln)
    if m:
        hits_2578.append((m.group(1), int(m.group(2))))
hits_2578 = hits_2578[:20]
removed = []
for file, lineno in hits_2578:
    p = root/file
    if not p.exists():
        continue
    lines = p.read_text(errors='replace').splitlines(True)
    idx = lineno - 1
    if 0 <= idx < len(lines) and '@ts-expect-error' in lines[idx]:
        lines.pop(idx)
        p.write_text(''.join(lines), encoding='utf-8')
        removed.append((file, lineno))
(OUT/'04a_ts2578.txt').write_text('\n'.join([f"REMOVED {f} line {l}" for f,l in removed]))

# 4B) Fix missing relative module imports if target exists (up to 15)
pattern_2307 = re.compile(r"^(src/[^:(]+\.(?:ts|tsx))\((\d+),(\d+)\): error TS2307: Cannot find module '([^']+)'")
hits_2307 = []
for ln in anchor_lines:
    m = pattern_2307.search(ln)
    if m:
        hits_2307.append((m.group(1), m.group(4)))
fixed = []
skipped = []
count=0
for file, mod in hits_2307:
    if not mod.startswith('.'):
        skipped.append((file, mod, 'non-relative'))
        continue
    count += 1
    if count > 15:
        break
    src_path = root/file
    base = src_path.parent
    cand = (base / mod)
    options = [cand.with_suffix('.ts'), cand.with_suffix('.tsx'), cand / 'index.ts', cand / 'index.tsx']
    exists = None
    for o in options:
        if o.exists():
            exists = o
            break
    if exists:
        rel = exists.relative_to(base)
        rel_no_ext = str(rel).replace('\\','/')
        for ext in ['.ts','.tsx']:
            if rel_no_ext.endswith(ext):
                rel_no_ext = rel_no_ext[:-len(ext)]
        if rel_no_ext.endswith('/index'):
            rel_no_ext = rel_no_ext[:-len('/index')]
        new_mod = './' + rel_no_ext if not rel_no_ext.startswith('.') else rel_no_ext
        ptext = src_path.read_text(errors='replace')
        ptext2 = ptext.replace(f"'{mod}'", f"'{new_mod}'").replace(f'\"{mod}\"', f'\"{new_mod}\"')
        if ptext2 != ptext:
            src_path.write_text(ptext2, encoding='utf-8')
            fixed.append((file, mod, new_mod))
    else:
        skipped.append((file, mod, 'target-missing'))

with (OUT/'04b_ts2307.txt').open('w') as f:
    for t in fixed:
        f.write(f"FIXED import: {t[0]} {t[1]} -> {t[2]}\n")
    for t in skipped[:50]:
        f.write(f"SKIP: {t[0]} {t[1]} ({t[2]})\n")

# 5) re-run typecheck
with (OUT/'typecheck_after.txt').open('wb') as fh:
    proc2 = subprocess.run(['npm','run','type-check'], cwd=str(root), stdout=fh, stderr=subprocess.STDOUT)

text2 = (OUT/'typecheck_after.txt').read_text(errors='replace')
anchor_lines2 = [ln for ln in text2.splitlines() if re.search(r'error TS|Cannot find module|TS2578|TS2307|TS2362|TS2552|TS6133', ln)]
(OUT/'06_remaining.txt').write_text('\n'.join(anchor_lines2[:220]))

print('OUT=' + str(OUT))
print('DONE')
