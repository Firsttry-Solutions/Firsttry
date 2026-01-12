#!/usr/bin/env python3
import sys, pathlib, re, unicodedata

def validate_workflows():
    errors = []
    
    # Only scan active workflows (not disabled)
    wf_dir = pathlib.Path(".github/workflows")
    
    if not wf_dir.exists():
        print("OK: No workflows to validate")
        return 0
        
    for f in sorted(wf_dir.glob("*.yml")) + sorted(wf_dir.glob("*.yaml")):
        # Skip backup files
        if f.name.endswith('.bak'):
            continue
            
        content = f.read_text(encoding='utf-8', errors='replace')
        
        # Check for BOM
        if content.startswith('\ufeff'):
            errors.append(f"{f}: BOM detected")
        
        # Check for Unicode Cf (format/bidi) characters
        cf_chars = [(i, ch) for i, ch in enumerate(content) if unicodedata.category(ch) == 'Cf']
        if cf_chars:
            line_no = content[:cf_chars[0][0]].count('\n') + 1
            errors.append(f"{f}:{line_no}: Unicode Cf character detected")
        
        # Check for multiple top-level keys
        lines = content.split('\n')
        name_count = sum(1 for line in lines if re.match(r'^name:\s', line))
        on_count = sum(1 for line in lines if re.match(r'^on:\s*$', line))
        jobs_count = sum(1 for line in lines if re.match(r'^jobs:\s*$', line))
        
        if name_count > 1:
            errors.append(f"{f}: Found {name_count} top-level 'name:' (expected 1)")
        if on_count > 1:
            errors.append(f"{f}: Found {on_count} top-level 'on:' (expected 1)")
        if jobs_count > 1:
            errors.append(f"{f}: Found {jobs_count} top-level 'jobs:' (expected 1)")
    
    if errors:
        print("ERRORS FOUND IN ACTIVE WORKFLOWS:")
        for err in errors:
            print(f"  {err}")
        return 1
    else:
        print("OK: All active workflows are valid (no BOM, Cf chars, or duplicates)")
        return 0

if __name__ == "__main__":
    sys.exit(validate_workflows())
