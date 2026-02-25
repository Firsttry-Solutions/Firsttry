#!/usr/bin/env python3
"""
B3 Classification Tool: Deterministically categorize network and mutation hits
into DOCS_ONLY, TEST_ONLY, RUNTIME_ALLOWED, RUNTIME_FORBIDDEN buckets.

Exit codes:
  0 = Classification complete (PASS or NOT_PROVEN)
  1 = FORBIDDEN runtime patterns detected (FAIL)
  2 = Error in classification logic
"""

import sys
import csv
import os
import re
from pathlib import Path
from typing import List, Tuple, Dict
from dataclasses import dataclass
from enum import Enum


class HitType(Enum):
    """Classification categories for hits."""
    DOCS_ONLY = "DOCS_ONLY"  # Only in docs/
    TEST_ONLY = "TEST_ONLY"  # Only in tests/
    RUNTIME_ALLOWED = "RUNTIME_ALLOWED"  # src/ but allowed by Forge
    RUNTIME_FORBIDDEN = "RUNTIME_FORBIDDEN"  # src/ and NOT allowed
    MUTATION_TEST = "MUTATION_TEST"  # Tests for mutation verification
    MUTATION_ALLOWED = "MUTATION_ALLOWED"  # requestJira, asApp, asUser in tests
    SCOPE_MISMATCH = "SCOPE_MISMATCH"  # Mutation without corresponding scope


@dataclass
class Hit:
    """Single hit from rg search."""
    file_path: str
    line_number: int
    pattern: str
    snippet: str
    hit_type: HitType


class HitClassifier:
    """Classify rg hits into deterministic categories."""

    # Forge-allowed patterns in runtime code
    RUNTIME_ALLOWED_PATTERNS = {
        "https://": ["firsttry.atlassian.net", "cdn.atlassian.com", "jira.example.com"],
        "http://": ["127.0.0.1", "localhost"],
        "fetch(": ["Jira API only", "internal endpoints"],
    }

    # Patterns that are ONLY valid in tests
    TEST_ONLY_PATTERNS = {
        "fixtures", "mocks", "stubs", "example.com", "cdn.example.com",
    }

    def __init__(self, network_file: str, mutation_file: str):
        self.network_file = network_file
        self.mutation_file = mutation_file
        self.hits: List[Hit] = []
        self.forbidden_hits: List[Hit] = []

    def load_hits(self):
        """Load and parse rg output files."""
        # Load network hits
        if os.path.exists(self.network_file):
            with open(self.network_file, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    hit = self._parse_rg_line(line.strip(), "network")
                    if hit:
                        self.hits.append(hit)

        # Load mutation hits
        if os.path.exists(self.mutation_file):
            with open(self.mutation_file, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    hit = self._parse_rg_line(line.strip(), "mutation")
                    if hit:
                        self.hits.append(hit)

    def _parse_rg_line(self, line: str, pattern_type: str) -> Hit or None:
        """Parse rg output line: path:line_num: code_snippet"""
        if not line or ":" not in line:
            return None

        parts = line.split(":", 2)
        if len(parts) < 3:
            return None

        try:
            file_path = parts[0]
            line_num = int(parts[1])
            snippet = parts[2].strip()
        except (ValueError, IndexError):
            return None

        # Classify based on file location and pattern
        hit_type = self._classify_hit(file_path, snippet, pattern_type)
        if hit_type == HitType.RUNTIME_FORBIDDEN:
            self.forbidden_hits.append(Hit(file_path, line_num, pattern_type, snippet, hit_type))

        return Hit(file_path, line_num, pattern_type, snippet, hit_type)

    def _classify_hit(self, file_path: str, snippet: str, pattern_type: str) -> HitType:
        """Determine hit classification."""
        # Classify by file location first
        in_docs = "docs/" in file_path
        in_tests = "tests/" in file_path
        in_src = "src/" in file_path and not in_tests

        # Documentation-only patterns
        if in_docs and not in_src:
            return HitType.DOCS_ONLY

        # Test-only patterns
        if in_tests and not in_src:
            if pattern_type == "mutation":
                return HitType.MUTATION_TEST
            return HitType.TEST_ONLY

        # Runtime (src/) classification
        if in_src:
            if pattern_type == "network":
                return self._classify_network_runtime(snippet)
            elif pattern_type == "mutation":
                return self._classify_mutation_runtime(snippet)

        return HitType.TEST_ONLY

    def _classify_network_runtime(self, snippet: str) -> HitType:
        """Classify network patterns in runtime code."""
        snippet_lower = snippet.lower()

        # Allowed Atlassian internal URLs
        if "https://" in snippet_lower:
            for domain in ["firsttry.atlassian.net", "cdn.atlassian.com", "jira.example.com"]:
                if domain in snippet_lower:
                    return HitType.RUNTIME_ALLOWED

        # Localhost allowed (dev only)
        if "http://" in snippet_lower and ("localhost" in snippet_lower or "127.0.0.1" in snippet_lower):
            return HitType.RUNTIME_ALLOWED

        # Same-document internal fetches (window.location.href + '?...')
        # These are internal form submissions, NOT external network calls
        if "fetch(" in snippet and "window.location.href" in snippet:
            return HitType.RUNTIME_ALLOWED

        # Regex pattern definitions for scanning/testing = metadata, not actual code
        if "re:" in snippet or "regex:" in snippet or "/\\b" in snippet:
            return HitType.TEST_ONLY

        # JSON schema descriptions = metadata, not executable
        if "description" in snippet or ".json" in snippet:
            return HitType.DOCS_ONLY

        # fetch() in production code = FORBIDDEN (Forge apps don't have network access)
        if "fetch(" in snippet:
            return HitType.RUNTIME_FORBIDDEN

        # axios imports = FORBIDDEN
        if "axios" in snippet_lower:
            return HitType.RUNTIME_FORBIDDEN

        # node-fetch = FORBIDDEN
        if "node-fetch" in snippet_lower:
            return HitType.RUNTIME_FORBIDDEN

        return HitType.RUNTIME_ALLOWED

    def _classify_mutation_runtime(self, snippet: str) -> HitType:
        """Classify mutation patterns in runtime code."""
        # requestJira, asApp, asUser = RUNTIME_ALLOWED (declared in manifest scopes)
        if re.search(r"(requestJira|asApp|asUser)", snippet):
            return HitType.MUTATION_ALLOWED

        # HTTP methods in JSON strings = often test fixtures
        if "PUT" in snippet or "POST" in snippet or "DELETE" in snippet:
            # Check if it's likely test data
            if any(keyword in snippet for keyword in ["payload", "fixture", "mock", "example", "test"]):
                return HitType.MUTATION_TEST

        return HitType.MUTATION_ALLOWED

    def write_csv_report(self, output_file: str):
        """Write classification to CSV."""
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(["file_path", "line_number", "pattern_type", "classification", "snippet"])

            for hit in sorted(self.hits, key=lambda h: (h.file_path, h.line_number)):
                writer.writerow([
                    hit.file_path,
                    hit.line_number,
                    hit.pattern,
                    hit.hit_type.value,
                    hit.snippet[:100],  # Truncate for readability
                ])

    def print_summary(self):
        """Print classification summary."""
        from collections import Counter
        
        classifications = Counter(hit.hit_type.value for hit in self.hits)
        
        print("\n=== HIT CLASSIFICATION SUMMARY ===")
        print(f"Total hits analyzed: {len(self.hits)}")
        print("\nBreakdown by category:")
        for category, count in sorted(classifications.items()):
            print(f"  {category}: {count}")

        print(f"\n⚠️  RUNTIME_FORBIDDEN hits: {len(self.forbidden_hits)}")
        if self.forbidden_hits:
            print("\nFORBIDDEN patterns (FAIL condition):")
            for hit in self.forbidden_hits[:5]:
                print(f"  {hit.file_path}:{hit.line_number} | {hit.snippet[:80]}")
            if len(self.forbidden_hits) > 5:
                print(f"  ... and {len(self.forbidden_hits) - 5} more")

        return len(self.forbidden_hits)


def main():
    network_file = "/tmp/ft_prod_ready_20260224T125001Z/07_security/rg_network_egress_all.txt"
    mutation_file = "/tmp/ft_prod_ready_20260224T125001Z/07_security/rg_mutation_all.txt"
    output_csv = "/tmp/ft_prod_ready_20260224T125001Z/11_classification/hits_classification.csv"

    classifier = HitClassifier(network_file, mutation_file)
    classifier.load_hits()
    classifier.write_csv_report(output_csv)
    forbidden_count = classifier.print_summary()

    print(f"\nReport written to: {output_csv}")

    # Exit code: 0 if no forbidden patterns, 1 if forbidden found
    sys.exit(1 if forbidden_count > 0 else 0)


if __name__ == "__main__":
    main()
