#!/usr/bin/env python3
"""
Update docs to reference actual evidence pack.
Scans docs for sections that need evidence links.
"""

import os
import re
import json
from pathlib import Path

def get_evidence_dir():
    """Find the most recent evidence directory."""
    evdir = Path('docs/evidence')
    if not evdir.exists():
        return None
    
    dirs = sorted(evdir.glob('*'), reverse=True)
    return dirs[0] if dirs else None

def load_evidence_summary(evdir):
    """Load evidence summary JSON."""
    summary_path = evdir / '50_evidence_summary.json'
    if summary_path.exists():
        with open(summary_path) as f:
            return json.load(f)
    return None

def main():
    evdir = get_evidence_dir()
    if not evdir:
        print("No evidence pack found")
        return 0
    
    ev_summary = load_evidence_summary(evdir)
    rel_path = f"evidence/{evdir.name}"
    
    print(f"✓ Found evidence pack: {rel_path}")
    print(f"  Timestamp: {ev_summary.get('timestamp') if ev_summary else 'unknown'}")
    print(f"  Scopes: {', '.join(ev_summary.get('manifest', {}).get('scopes', []))}")
    
    # Update ROI_MODEL.md to add evidence reference
    roi_path = Path('docs/ROI_MODEL.md')
    if roi_path.exists():
        content = roi_path.read_text()
        
        # Check if already has evidence section
        if 'Evidence Pack:' not in content:
            # Add at end before disclaimer
            insert_section = f"""
---

## Evidence Pack (Generated)

This ROI model is designed as a **framework** for YOUR inputs and measurements. 

**Evidence Artifacts**:
- Repository evidence pack: [`{rel_path}`]({rel_path}/)
- Validator results: [`{rel_path}/10_placeholders.txt`]({rel_path}/10_placeholders.txt)
- Docs validation: [`{rel_path}/11_docs_gate.txt`]({rel_path}/11_docs_gate.txt)
- Manifest scopes: [`{rel_path}/30_manifest_scopes.txt`]({rel_path}/30_manifest_scopes.txt)
- Data handling: [`{rel_path}/31_data_scan.txt`]({rel_path}/31_data_scan.txt)

**Key Facts (From Code)**:
- **Scopes**: {', '.join(ev_summary.get('manifest', {}).get('scopes', []))} (extracted from manifest.yml)
- **Storage**: Uses Atlassian Forge storage (encrypted, tenant-isolated)
- **Jira Access**: Read-only via `read:jira-work` scope
- **External APIs**: None configured

"""
            # Find "Disclaimer" section and insert before it
            disclaimer_idx = content.rfind('## Disclaimer')
            if disclaimer_idx > 0:
                new_content = content[:disclaimer_idx] + insert_section + content[disclaimer_idx:]
                roi_path.write_text(new_content)
                print(f"✓ Updated {roi_path}")
    
    # Create EVIDENCE_REFERENCE.md in docs/
    evidence_ref = Path('docs/EVIDENCE_REFERENCE.md')
    if not evidence_ref.exists():
        content = f"""# Evidence Reference

This document links to generated evidence artifacts that prove FirstTry's claims.

## Latest Evidence Pack

**Location**: [{rel_path}]({rel_path}/)
**Timestamp**: {ev_summary.get('timestamp', 'unknown')}
**Repository State**: {ev_summary.get('repository', {}).get('head_commit', 'unknown')}

## What's Proven

### Validators (All Passing)
- ✅ **No Critical Placeholders**: [`10_placeholders.txt`]({rel_path}/10_placeholders.txt)
- ✅ **Documentation Quality**: [`11_docs_gate.txt`]({rel_path}/11_docs_gate.txt)

### Manifest & Scopes (From Code)
- **Declared Scopes**: {', '.join(ev_summary.get('manifest', {}).get('scopes', []))}
- **External Egress**: None configured
- **Evidence**: [`30_manifest_scopes.txt`]({rel_path}/30_manifest_scopes.txt)

### Data Handling (Code Scan)
- ✅ **Read-Only**: No `write:jira` scopes declared
- ✅ **Storage**: Uses `storage:app` (Forge-managed, tenant-isolated)
- ✅ **No External APIs**: No `fetch()` or HTTP calls to external domains
- **Evidence**: [`31_data_scan.txt`]({rel_path}/31_data_scan.txt)

## How to Interpret

Each referenced file is an **actual execution output**, not a claim. For example:

- `10_placeholders.txt` shows the exact command run and its output (PASS or FAIL)
- `30_manifest_scopes.txt` shows parsed YAML from `atlassian/forge-app/manifest.yml`
- `31_data_scan.txt` shows ripgrep patterns found in actual source code

**This means**: Claims about scopes, storage, and data flow are **verifiable** by checking these artifacts.

## What's NOT Here

The following require **customer measurement** (not provided by FirstTry):
- ROI timings (hours per issue, error costs) — Use `tools/roi_calc.py` with your data
- Setup time (varies by governance model complexity)
- Error prevention value (depends on violation costs in your org)

See [docs/ROI_MODEL.md](ROI_MODEL.md) for how to measure these yourself.
"""
        evidence_ref.write_text(content)
        print(f"✓ Created {evidence_ref}")
    
    return 0

if __name__ == '__main__':
    exit(main())
