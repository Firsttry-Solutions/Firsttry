#!/usr/bin/env python3
"""
canonical_json.py

Formats JSON in canonical form for deterministic hashing.

Features:
- Sorted keys (stable ordering)
- 2-space indentation
- Newline at EOF
- Reads from stdin, writes to stdout

Usage:
    cat input.json | python canonical_json.py > output.json
    
    # Or in shell pipeline:
    echo '{"b": 2, "a": 1}' | python canonical_json.py
    # Output: {"a": 1, "b": 2}

Exit codes:
    0 - Success
    1 - Invalid JSON or other error
"""

import json
import sys


def canonicalize_json(input_text: str) -> str:
    """
    Parse JSON and format in canonical form.
    
    Args:
        input_text: JSON text
        
    Returns:
        Canonical JSON string (sorted keys, 2-space indent, newline at EOF)
    """
    data = json.loads(input_text)
    canonical = json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False)
    return canonical + '\n'


def main():
    try:
        # Read stdin
        input_text = sys.stdin.read()
        
        # Canonicalize
        output = canonicalize_json(input_text)
        
        # Write stdout
        sys.stdout.write(output)
        
        return 0
        
    except json.JSONDecodeError as e:
        sys.stderr.write(f"ERROR: Invalid JSON: {e}\n")
        return 1
        
    except Exception as e:
        sys.stderr.write(f"ERROR: {e}\n")
        return 1


if __name__ == '__main__':
    sys.exit(main())
