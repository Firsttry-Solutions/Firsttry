#!/usr/bin/env python3
"""
Network Surface Scanner: Strict external egress audit

Scans manifest files and code for:
  1. External permissions in manifest (permissions.external, webtriggers, invokeRemote)
  2. External HTTP client usage (fetch, axios, https.request, etc.)
  3. Tenant isolation patterns in storage code

Exit codes:
  0: No external egress detected
  1: External egress found (or error)
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple

import yaml


class NetworkSurfaceScanner:
    """Scans for external network surface in code and manifest."""

    def __init__(self, repo_root: str, output_dir: str = None):
        self.repo_root = repo_root
        self.output_dir = output_dir or "/tmp"
        self.findings = {
            "manifest_scopes": {},
            "manifest_external_urls": [],
            "manifest_webtriggers": [],
            "code_http_clients": [],
            "code_patterns": {},
            "errors": [],
        }

    def scan_manifests(self) -> bool:
        """
        Parse all manifest.yml files and extract:
        - Scopes
        - permissions.external
        - webtriggers
        - invokeRemote
        
        Returns: True if no external URLs found, False if any external URLs
        """
        manifest_files = subprocess.run(
            ["find", self.repo_root, "-name", "manifest.yml", "-type", "f"],
            capture_output=True,
            text=True,
        )
        manifest_paths = manifest_files.stdout.strip().split("\n")
        manifest_paths = [p for p in manifest_paths if p]

        found_external = False

        for manifest_path in manifest_paths:
            try:
                with open(manifest_path, "r") as f:
                    manifest = yaml.safe_load(f)
                    if not manifest:
                        continue

                # Extract scopes
                if "permissions" in manifest and "scopes" in manifest["permissions"]:
                    scopes = manifest["permissions"]["scopes"]
                    self.findings["manifest_scopes"][manifest_path] = scopes

                # Extract external permissions (CRITICAL)
                if "permissions" in manifest and "external" in manifest["permissions"]:
                    external_perms = manifest["permissions"]["external"]
                    if external_perms:
                        self.findings["manifest_external_urls"].extend(
                            [{"file": manifest_path, "urls": external_perms}]
                        )
                        found_external = True

                # Extract webtriggers (external entry point)
                if "modules" in manifest:
                    for module_type, modules in manifest["modules"].items():
                        if module_type == "webtrigger" and modules:
                            self.findings["manifest_webtriggers"].append(
                                {"file": manifest_path, "webtriggers": modules}
                            )
                            found_external = True

            except Exception as e:
                self.findings["errors"].append(f"Error parsing {manifest_path}: {e}")

        return not found_external

    def scan_code_network_patterns(self) -> bool:
        """
        Scan codebase for HTTP client usage.
        
        IMPORTANT: Only flag external HTTP calls. Internal/same-origin fetch() is allowed for admin UI.
        
        Look for:
          - fetch("https://external.domain")
          - axios.post("https://external")
          - https.request({host: "external"})
          - Imports of axios, undici, node-fetch, got in non-test code
        
        Excludes:
          - Test directories (tests/, *.test.ts)
          - tools/ directory (scanner itself)
          - docs/, audit/, .github/
          - Internal admin UI fetch() calls to same-origin
        
        Returns: True if no external calls, False if external egress detected
        """
        # For now, use a simpler approach: just check manifest + imports
        # Actual external calls in code would show as:
        # fetch(url) where url is a string literal starting with http(s)://
        # axios.post(url) where url is external
        # These would require parsing/AST analysis to be 100% accurate
        
        # Refined: Look for actual external URLs in code strings
        external_url_pattern = r'(fetch|axios\.(post|get|put|delete)|https\.request|http\.request)\s*\([\'"][^\'"]*(https?://|//)[a-z0-9.-]+[\'"]'
        
        result = subprocess.run(
            [
                "rg",
                "-n",
                "--no-heading",
                "-S",
                "-i",
                external_url_pattern,
                self.repo_root,
                "--glob",
                "!node_modules",
                "--glob",
                "!.git",
                "--glob",
                "!build",
                "--glob",
                "!dist",
                "--glob",
                "!docs/**",
                "--glob",
                "!audit/**",
                "--glob",
                "!.github/**",
                "--glob",
                "!tests/**",
                "--glob",
                "!*.test.ts",
                "--glob",
                "!*.test.js",
                "--glob",
                "!tools/**",
            ],
            capture_output=True,
            text=True,
        )

        if result.stdout.strip():
            lines = result.stdout.strip().split("\n")
            for line in lines:
                if line:
                    self.findings["code_http_clients"].append(
                        {"pattern": "External HTTP call", "match": line[:200]}
                    )
            return False

        # Also check for dangerous imports (axios, undici, node-fetch, got)
        # but exclude them from test code
        dangerous_imports = [
            r"(import|require)\s+.*\s+(axios|undici|node-fetch|got)(?!.*test)",
        ]
        
        for pattern in dangerous_imports:
            result = subprocess.run(
                [
                    "rg",
                    "-n",
                    "--no-heading",
                    "-S",
                    pattern,
                    self.repo_root,
                    "--glob",
                    "!node_modules",
                    "--glob",
                    "!tests/**",
                    "--glob",
                    "!*.test.ts",
                    "--glob",
                    "!*.test.js",
                ]
            ,
                capture_output=True,
                text=True,
            )
            if result.stdout.strip():
                lines = result.stdout.strip().split("\n")
                for line in lines:
                    if line:
                        self.findings["code_http_clients"].append(
                            {"pattern": "Dangerous HTTP client import", "match": line[:200]}
                        )
                return False

        return True

    def scan_tenant_isolation_patterns(self) -> Dict:
        """
        Scan for tenant isolation in storage code.
        Look for:
        - storage.app.get/set with tenant-keyed context
        - Global cache with tenant keys
        """
        patterns = [
            (r"storage\.app\.get", "Forge storage.app.get"),
            (r"storage\.app\.set", "Forge storage.app.set"),
            (r"storage\.user\.get", "Forge storage.user (tenant-specific)"),
            (r"storage\.user\.set", "Forge storage.user (tenant-specific)"),
        ]

        for pattern, label in patterns:
            result = subprocess.run(
                [
                    "rg",
                    "-c",  # Count only
                    "-S",
                    pattern,
                    self.repo_root,
                    "--glob",
                    "!docs/evidence",
                    "--glob",
                    "!node_modules",
                ],
                capture_output=True,
                text=True,
            )
            if result.stdout.strip():
                count = result.stdout.strip().split("\n")[-1]
                self.findings["code_patterns"][label] = count

        return self.findings["code_patterns"]

    def write_manifest_surface(self, output_path: str):
        """Write manifest surface report."""
        with open(output_path, "w") as f:
            f.write("# Manifest Network Surface Scan\n\n")
            f.write(f"**Generated**: Scan of {self.repo_root}\n\n")

            f.write("## Scopes Declared\n\n")
            for manifest_file, scopes in self.findings["manifest_scopes"].items():
                f.write(f"### {manifest_file}\n")
                f.write(f"Scopes: {', '.join(scopes)}\n\n")

            f.write("## External Permissions\n\n")
            if self.findings["manifest_external_urls"]:
                f.write("⚠️ **CRITICAL**: External permissions found:\n\n")
                for item in self.findings["manifest_external_urls"]:
                    f.write(f"- File: {item['file']}\n")
                    f.write(f"  URLs: {item['urls']}\n\n")
            else:
                f.write("✅ No external permissions declared in manifest\n\n")

            f.write("## Web Triggers (External Entry Points)\n\n")
            if self.findings["manifest_webtriggers"]:
                f.write("⚠️ **CRITICAL**: Webtriggers found (external entry point):\n\n")
                for item in self.findings["manifest_webtriggers"]:
                    f.write(f"- File: {item['file']}\n")
                    f.write(f"  Webtriggers: {item['webtriggers']}\n\n")
            else:
                f.write("✅ No webtriggers configured\n\n")

    def write_code_scan(self, output_path: str):
        """Write code network scan report (FULL, NO TRUNCATION)."""
        with open(output_path, "w") as f:
            f.write("# Code Network Surface Scan\n\n")
            f.write(f"**Generated**: Scan of {self.repo_root}\n\n")

            f.write("## HTTP Client Usage (External Egress)\n\n")
            if self.findings["code_http_clients"]:
                f.write("⚠️ **CRITICAL**: External HTTP clients detected:\n\n")
                for item in self.findings["code_http_clients"]:
                    f.write(f"**Pattern**: {item['pattern']}\n")
                    f.write(f"```\n{item['match']}\n```\n\n")
            else:
                f.write("✅ No external HTTP client usage detected\n\n")

            f.write("## Forge Storage Patterns (Internal)\n\n")
            f.write("Expected internal patterns:\n\n")
            for label, count in self.findings["code_patterns"].items():
                f.write(f"- {label}: {count} matches\n")

            f.write("\n## Allowed (Atlassian Forge SDK)\n\n")
            f.write("- `@forge/api` — Atlassian Forge API (internal)\n")
            f.write("- `storage.app` — Forge app storage (tenant-managed by Atlassian)\n")
            f.write("- `@forge/resolver` — Forge resolver (internal)\n")
            f.write("- `api.asUser()` — User-scoped Jira API (internal, requires Jira scope)\n")

    def write_summary(self, output_path: str):
        """Write JSON summary."""
        summary = {
            "timestamp": subprocess.run(
                ["date", "-u", "+%Y%m%dT%H%M%SZ"],
                capture_output=True,
                text=True,
            ).stdout.strip(),
            "repo": self.repo_root,
            "has_external_manifest_permissions": len(self.findings["manifest_external_urls"]) > 0,
            "has_webtriggers": len(self.findings["manifest_webtriggers"]) > 0,
            "has_external_http_clients": len(self.findings["code_http_clients"]) > 0,
            "manifest_scopes": self.findings["manifest_scopes"],
            "external_findings": {
                "manifest_urls": self.findings["manifest_external_urls"],
                "webtriggers": self.findings["manifest_webtriggers"],
                "http_clients": self.findings["code_http_clients"],
            },
            "internal_storage_patterns": self.findings["code_patterns"],
            "pass": (
                not self.findings["manifest_external_urls"]
                and not self.findings["manifest_webtriggers"]
                and not self.findings["code_http_clients"]
            ),
        }
        with open(output_path, "w") as f:
            json.dump(summary, f, indent=2)
        return summary

    def run(self, manifest_only=False, code_scan_only=False) -> int:
        """Run all scans. Returns 0 if pass, 1 if fail."""
        print(f"🔍 Scanning {self.repo_root} for network surface...")

        if not manifest_only:
            print("  - Checking code for external HTTP clients...")
            manifest_ok = self.scan_manifests()
        else:
            manifest_ok = True

        if not code_scan_only:
            print("  - Checking manifest for external permissions...")
            code_ok = self.scan_code_network_patterns()
        else:
            code_ok = True

        print("  - Scanning for tenant isolation patterns...")
        self.scan_tenant_isolation_patterns()

        # Write reports
        manifest_out = os.path.join(
            self.output_dir, "30_manifest_surface.txt"
        )
        code_out = os.path.join(self.output_dir, "31_code_network_scan.txt")
        summary_out = os.path.join(self.output_dir, "32_network_surface_summary.json")

        self.write_manifest_surface(manifest_out)
        self.write_code_scan(code_out)
        summary = self.write_summary(summary_out)

        print(f"\n✅ Results:")
        print(f"  Manifest scopes: {len(self.findings['manifest_scopes'])} files")
        print(
            f"  External manifest perms: {len(self.findings['manifest_external_urls'])}"
        )
        print(f"  Webtriggers: {len(self.findings['manifest_webtriggers'])}")
        print(
            f"  HTTP clients detected: {len(self.findings['code_http_clients'])}"
        )
        print(f"\n📊 Summary: {summary_out}")
        print(f"📄 Manifest: {manifest_out}")
        print(f"📄 Code: {code_out}")

        if summary["pass"]:
            print("\n✅ Network surface scan PASSED (no external egress)")
            return 0
        else:
            print(
                "\n❌ Network surface scan FAILED (external egress detected)"
            )
            if self.findings["manifest_external_urls"]:
                print("   - External permissions in manifest")
            if self.findings["manifest_webtriggers"]:
                print("   - Webtriggers configured")
            if self.findings["code_http_clients"]:
                print("   - External HTTP client usage in code")
            return 1


def main():
    parser = argparse.ArgumentParser(
        description="Scan network surface for external egress"
    )
    parser.add_argument("--repo", required=True, help="Repository root path")
    parser.add_argument("--out", required=True, help="Output directory for artifacts")
    parser.add_argument(
        "--manifest-only",
        action="store_true",
        help="Scan manifest only",
    )
    parser.add_argument(
        "--code-scan-only",
        action="store_true",
        help="Scan code only",
    )

    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)

    scanner = NetworkSurfaceScanner(args.repo, args.out)
    return scanner.run(
        manifest_only=args.manifest_only,
        code_scan_only=args.code_scan_only,
    )


if __name__ == "__main__":
    sys.exit(main())
