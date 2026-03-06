#!/usr/bin/env python3
"""
Canonical JSON processor for deterministic Jira governance evidence.

Reads JSON from stdin and outputs canonical JSON with:
- Objects: sorted keys (recursively)
- Arrays: PRESERVE original order (no artificial sorting)
- Deterministic whitespace and formatting

This ensures deterministic hashing while preserving array semantics from Jira API responses.
"""

import json
import sys


def canonicalize_json_object(obj):
    """
    Recursively canonicalize a JSON object for deterministic output.

    - Dictionaries: sort keys
    - Arrays: preserve order (API order is semantically meaningful)
    - Primitives: unchanged
    """
    if isinstance(obj, dict):
        return {key: canonicalize_json_object(value)
                for key, value in sorted(obj.items())}
    elif isinstance(obj, list):
        # PRESERVE array order - Jira API ordering is meaningful
        return [canonicalize_json_object(item) for item in obj]
    else:
        # Primitives (str, int, float, bool, null) - unchanged
        return obj


def main():
    """Read JSON from stdin, canonicalize, and output to stdout."""
    try:
        # Read entire stdin
        input_text = sys.stdin.read().strip()

        if not input_text:
            print("[]", end="")
            return

        # Parse JSON
        data = json.loads(input_text)

        # Canonicalize
        canonical_data = canonicalize_json_object(data)

        # Output with deterministic formatting
        # separators remove extra whitespace, ensure_ascii=False for unicode stability
        output = json.dumps(
            canonical_data,
            separators=(',', ':'),
            ensure_ascii=False,
            sort_keys=False  # We already sorted in canonicalize_json_object
        )

        print(output, end="")

    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()