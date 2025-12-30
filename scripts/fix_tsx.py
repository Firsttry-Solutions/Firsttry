#!/usr/bin/env python3
from pathlib import Path
import sys

if len(sys.argv) < 2:
    print('Usage: fix_tsx.py <file>')
    sys.exit(2)

p = Path(sys.argv[1])
if not p.exists():
    print('MISSING', p)
    sys.exit(0)

txt = p.read_text(encoding='utf-8', errors='replace')
orig = txt
changed = False

# Add React default import if missing
if 'import React' not in txt and 'from "react"' not in txt and "from 'react'" not in txt:
    txt = 'import React from "react";\n' + txt
    changed = True

# If file uses JSX factory `view` ensure it is imported from @forge/ui (if not already)
if ('view(' in txt or '<View' in txt or '<view' in txt) and ('from "@forge/ui"' not in txt and "from '@forge/ui'" not in txt):
    txt = 'import { view } from "@forge/ui";\n' + txt
    changed = True

# Write back if changed
if changed and txt != orig:
    p.write_text(txt, encoding='utf-8')
    print('Updated imports in', p)
else:
    print('No import changes needed for', p)
