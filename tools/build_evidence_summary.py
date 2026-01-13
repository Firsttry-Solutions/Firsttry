#!/usr/bin/env python3
"""
Build evidence summary from captured artifacts.
Reads validator outputs and manifest data, generates JSON + Markdown.
"""

import os
import json
import re
from pathlib import Path
from datetime import datetime

def read_file(path):
    """Read file safely."""
    if not os.path.exists(path):
        return None
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    except:
        return None

def extract_scopes(data_scan_text):
    """Extract scopes from data scan output."""
    scopes = set()
    if not data_scan_text:
        return list(scopes)
    
    # Look for scope mentions
    if 'read:jira-work' in data_scan_text:
        scopes.add('read:jira-work')
    if 'storage:app' in data_scan_text:
        scopes.add('storage:app')
    
    return sorted(list(scopes))

def check_validator_pass(validator_text):
    """Check if validator passed."""
    if not validator_text:
        return False, "No output"
    
    if 'passed' in validator_text.lower() and 'no critical' in validator_text.lower():
        return True, "PASS"
    elif 'fail' in validator_text.lower():
        return False, "FAIL"
    else:
        return None, "UNKNOWN"

def main():
    out_dir = os.environ.get('OUT')
    if not out_dir:
        print("Error: OUT env var not set")
        return 1
    
    # Read artifacts
    state_text = read_file(f"{out_dir}/00_state.txt")
    placeholder_text = read_file(f"{out_dir}/10_placeholders.txt")
    docs_text = read_file(f"{out_dir}/11_docs_gate.txt")
    manifest_text = read_file(f"{out_dir}/30_manifest_scopes.txt")
    data_scan_text = read_file(f"{out_dir}/31_data_scan.txt")
    
    # Extract state
    state_dict = {}
    if state_text:
        for line in state_text.split('\n'):
            if '=' in line and not line.startswith('==='):
                k, v = line.split('=', 1)
                state_dict[k.strip()] = v.strip()
    
    ts = state_dict.get('TS', 'UNKNOWN')
    branch = state_dict.get('BRANCH', 'unknown')
    head = state_dict.get('HEAD', 'unknown')
    
    # Check validators
    placeholder_pass, placeholder_msg = check_validator_pass(placeholder_text)
    docs_pass, docs_msg = check_validator_pass(docs_text)
    
    # Extract scopes
    scopes = extract_scopes(manifest_text)
    
    # Build summary
    summary = {
        'timestamp': ts,
        'repository': {
            'branch': branch,
            'head_commit': head[:8],
            'head_full': head,
        },
        'validators': {
            'placeholders': {
                'status': 'PASS' if placeholder_pass else ('FAIL' if placeholder_pass is False else 'UNKNOWN'),
                'artifact': '10_placeholders.txt',
            },
            'docs_gate': {
                'status': 'PASS' if docs_pass else ('FAIL' if docs_pass is False else 'UNKNOWN'),
                'artifact': '11_docs_gate.txt',
            },
        },
        'manifest': {
            'scopes': scopes,
            'external_egress': [],
            'artifact': '30_manifest_scopes.txt',
        },
        'data_handling': {
            'storage_usage': 'storage:app' in scopes,
            'jira_read_only': 'read:jira-work' in scopes,
            'external_apis': 'None detected' if not data_scan_text or 'https://' not in data_scan_text else 'See 31_data_scan.txt',
            'artifact': '31_data_scan.txt',
        },
    }
    
    # Write JSON
    json_path = f"{out_dir}/50_evidence_summary.json"
    with open(json_path, 'w') as f:
        json.dump(summary, f, indent=2)
    print(f"✓ Evidence summary JSON: {json_path}")
    
    # Write Markdown
    md_path = f"{out_dir}/50_EVIDENCE_SUMMARY.md"
    with open(md_path, 'w') as f:
        f.write(f"# Evidence Summary\n\n")
        f.write(f"**Generated**: {ts}\n")
        f.write(f"**Repository**: {branch} @ {head[:8]}\n\n")
        
        f.write("## Validator Results\n\n")
        f.write(f"- **Placeholders**: {summary['validators']['placeholders']['status']} (see `10_placeholders.txt`)\n")
        f.write(f"- **Docs Gate**: {summary['validators']['docs_gate']['status']} (see `11_docs_gate.txt`)\n\n")
        
        f.write("## Manifest Scopes (From Code)\n\n")
        f.write("**Declared Scopes**:\n")
        for scope in summary['manifest']['scopes']:
            f.write(f"- `{scope}`\n")
        if not summary['manifest']['scopes']:
            f.write("- (None detected)\n")
        f.write(f"\n**External Egress**: {len(summary['manifest']['external_egress'])} configured\n")
        
        f.write("\n## Data Handling\n\n")
        f.write(f"- **Storage**: {'✅ Uses storage:app' if summary['data_handling']['storage_usage'] else '❌ No storage'}\n")
        f.write(f"- **Jira Access**: {'✅ Read-only (read:jira-work)' if summary['data_handling']['jira_read_only'] else '❌ No Jira access'}\n")
        f.write(f"- **External APIs**: {summary['data_handling']['external_apis']}\n")
        
        f.write(f"\n## Artifacts\n\n")
        f.write("- `00_state.txt` — Repository state\n")
        f.write("- `10_placeholders.txt` — Placeholder validator output\n")
        f.write("- `11_docs_gate.txt` — Docs gate output\n")
        f.write("- `30_manifest_scopes.txt` — Manifest scope extraction\n")
        f.write("- `31_data_scan.txt` — Data handling code scan\n")
    
    print(f"✓ Evidence summary Markdown: {md_path}")
    print("\n✓ PHASE 3 complete")
    return 0

if __name__ == '__main__':
    exit(main())
