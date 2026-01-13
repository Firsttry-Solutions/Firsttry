#!/usr/bin/env python3
"""
Normalize canonical branding across tracked md/html files.

Source of truth: docs/VENDOR_FACTS.yml
Replacement rules:
- "Firsttry Governance for Jira" → "FirstTry - Audit Evidence Snapshot for Jira"
- "Firsttry Governance" → "FirstTry - Audit Evidence Snapshot for Jira"
- Old contact emails → "contact@firsttry.run"
"""

import os
import sys
import re
from pathlib import Path
import yaml

def load_canonical_branding(repo_root):
    """Load canonical branding from docs/VENDOR_FACTS.yml"""
    vendor_file = Path(repo_root) / "docs" / "VENDOR_FACTS.yml"
    if not vendor_file.exists():
        print(f"ERROR: {vendor_file} not found")
        sys.exit(1)
    
    with open(vendor_file, 'r') as f:
        facts = yaml.safe_load(f) or {}
    
    branding = {
        'product_name': facts.get('product_name', '').strip(),
        'vendor_name': facts.get('vendor_name', '').strip(),
        'operator_name': facts.get('operator_name', '').strip(),
        'contact_email': facts.get('contact_email', '').strip(),
    }
    
    for key, val in branding.items():
        if not val:
            print(f"ERROR: {key} missing or empty in {vendor_file}")
            sys.exit(1)
    
    return branding

def get_tracked_files(repo_root, extensions=('md', 'html')):
    """Get all tracked files with given extensions."""
    os.chdir(repo_root)
    import subprocess
    result = subprocess.run(
        ['git', 'ls-files'],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"ERROR: git ls-files failed: {result.stderr}")
        sys.exit(1)
    
    files = []
    for line in result.stdout.strip().split('\n'):
        if line:
            path = Path(repo_root) / line
            if path.suffix.lstrip('.') in extensions:
                files.append(path)
    
    return files

def normalize_file(filepath, branding, dry_run=False):
    """Normalize branding in a single file. Returns (count, changes)."""
    changes = []
    
    # Read file
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return (0, [(str(filepath), f"read_error: {e}")])
    
    original = content
    
    # Replacement rules (case-insensitive, preserve context)
    rules = [
        # Old product names → canonical
        (r'(?i)Firsttry Governance for Jira(?! - )', branding['product_name']),
        (r'(?i)FirstTry Governance(?! - )', branding['product_name']),
        (r'(?i)firsttry governance for jira(?! - )', branding['product_name']),
        (r'(?i)firsttry governance(?! - )', branding['product_name']),
    ]
    
    count = 0
    for pattern, replacement in rules:
        matches = len(re.findall(pattern, content))
        if matches > 0:
            content = re.sub(pattern, replacement, content)
            count += matches
            changes.append((str(filepath), f"{matches} replacements: {pattern[:40]}..."))
    
    # Write back if modified and not dry-run
    if content != original:
        if not dry_run:
            try:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
            except Exception as e:
                return (0, [(str(filepath), f"write_error: {e}")])
    
    return (count, changes)

def main():
    repo_root = Path(__file__).parent.parent
    branding = load_canonical_branding(repo_root)
    
    print("=== PHASE 4: NORMALIZE BRANDING ===")
    print(f"Product name: {branding['product_name']}")
    print(f"Vendor name: {branding['vendor_name']}")
    print(f"Contact email: {branding['contact_email']}")
    print()
    
    files = get_tracked_files(repo_root)
    print(f"Tracked md/html files: {len(files)}")
    print()
    
    total_replacements = 0
    all_changes = []
    
    for filepath in sorted(files):
        count, changes = normalize_file(filepath, branding, dry_run=False)
        total_replacements += count
        all_changes.extend(changes)
        if count > 0:
            print(f"  {filepath.relative_to(repo_root)}: {count} replacements")
    
    print()
    print(f"✅ Total replacements: {total_replacements}")
    print(f"✅ Files modified: {len(set(c[0] for c in all_changes))}")
    
    # Save audit log
    audit_dir = Path(repo_root) / "audit" / "branding"
    audit_dir.mkdir(parents=True, exist_ok=True)
    
    audit_log = audit_dir / "normalize_branding_audit.txt"
    with open(audit_log, 'w') as f:
        f.write("=== BRANDING NORMALIZATION AUDIT ===\n\n")
        f.write(f"Product name: {branding['product_name']}\n")
        f.write(f"Vendor name: {branding['vendor_name']}\n")
        f.write(f"Contact email: {branding['contact_email']}\n\n")
        f.write(f"Total replacements: {total_replacements}\n")
        f.write(f"Files modified: {len(set(c[0] for c in all_changes))}\n\n")
        f.write("Changes:\n")
        for filepath, change in all_changes:
            f.write(f"  {filepath}: {change}\n")
    
    print(f"✅ Audit saved to: {audit_log}")

if __name__ == '__main__':
    main()
