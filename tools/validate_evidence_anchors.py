#!/usr/bin/env python3
"""
Validate that docs only reference existing evidence artifacts.
Blocks commits if evidence is referenced but file doesn't exist.
"""

import os
import re
import sys
from pathlib import Path

def main():
    """Check that all evidence references are valid."""
    errors = []
    
    # Find all doc files
    doc_files = list(Path('docs').glob('**/*.md'))
    
    # Pattern: reference to docs/evidence/<path>
    evidence_ref_pattern = r'docs/evidence/[^\s\)"\'\]>]+'
    
    for doc_file in doc_files:
        try:
            content = doc_file.read_text(encoding='utf-8')
        except:
            continue
        
        # Find all evidence references
        refs = re.findall(evidence_ref_pattern, content)
        
        for ref in refs:
            # Check if file exists
            ref_path = Path(ref)
            if not ref_path.exists():
                errors.append(f"{doc_file}: References non-existent {ref}")
    
    # Report
    if errors:
        print("❌ EVIDENCE ANCHOR VALIDATION FAILED\n")
        for err in errors:
            print(f"  {err}")
        return 1
    else:
        print("✅ All evidence references are valid")
        return 0

if __name__ == '__main__':
    sys.exit(main())
