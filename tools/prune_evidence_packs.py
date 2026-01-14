#!/usr/bin/env python3
"""
Evidence Pack Pruning Tool

Manages retention of evidence packs in docs/evidence/.
Keeps last N packs, archives older ones.

Usage:
  python3 tools/prune_evidence_packs.py [--keep 5] [--dry-run] [--archive] [--delete]
"""

import argparse
import os
import shutil
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Tuple


class EvidencePackPruner:
    """Manages evidence pack lifecycle."""

    def __init__(self, evidence_dir: str = "docs/evidence", keep_count: int = 5):
        self.evidence_dir = Path(evidence_dir)
        self.archive_dir = self.evidence_dir / "archived"
        self.keep_count = keep_count

    def list_packs(self) -> List[Tuple[str, datetime]]:
        """
        List all evidence packs, sorted by timestamp (newest first).
        Returns: [(pack_name, timestamp), ...]
        """
        packs = []

        if not self.evidence_dir.exists():
            return packs

        for item in self.evidence_dir.iterdir():
            if not item.is_dir() or item.name == "archived":
                continue

            # Parse timestamp from dirname: YYYYMMDDTHHMMSSZ_hash
            parts = item.name.split("_")
            if len(parts) < 2:
                continue

            ts_str = parts[0]  # e.g., "20260113T131842Z"

            try:
                # Parse ISO 8601 format
                ts = datetime.strptime(ts_str, "%Y%m%dT%H%M%SZ")
                packs.append((item.name, ts))
            except ValueError:
                continue

        # Sort by timestamp, newest first
        packs.sort(key=lambda x: x[1], reverse=True)
        return packs

    def get_packs_to_prune(self) -> List[str]:
        """Get list of packs to prune (oldest beyond keep_count)."""
        packs = self.list_packs()
        if len(packs) <= self.keep_count:
            return []

        # Packs to prune are indices >= keep_count
        to_prune = [pack[0] for pack in packs[self.keep_count :]]
        return to_prune

    def archive_pack(self, pack_name: str, dry_run: bool = False) -> bool:
        """Move pack to archived subfolder."""
        src = self.evidence_dir / pack_name
        self.archive_dir.mkdir(parents=True, exist_ok=True)
        dst = self.archive_dir / pack_name

        print(f"  Archive: {pack_name}")

        if not dry_run:
            shutil.move(str(src), str(dst))

        return True

    def delete_pack(self, pack_name: str, dry_run: bool = False, age_days: int = 30) -> bool:
        """Delete archived pack if older than age_days."""
        pack_path = self.archive_dir / pack_name

        if not pack_path.exists():
            return False

        # Check age
        try:
            parts = pack_name.split("_")
            ts_str = parts[0]
            ts = datetime.strptime(ts_str, "%Y%m%dT%H%M%SZ")
            age = datetime.utcnow() - ts
            if age < timedelta(days=age_days):
                print(f"  Retain: {pack_name} (only {age.days} days old, need {age_days})")
                return False
        except ValueError:
            return False

        print(f"  Delete: {pack_name}")

        if not dry_run:
            shutil.rmtree(str(pack_path))

        return True

    def run_prune(self, dry_run: bool = False, archive: bool = True, delete: bool = False):
        """Run pruning operation."""
        print("=".repeat(80))
        print("EVIDENCE PACK PRUNING")
        print("=".repeat(80))

        packs = self.list_packs()
        print(f"\nFound {len(packs)} evidence pack(s)")
        for name, ts in packs:
            print(f"  - {name} ({ts.isoformat()})")

        to_prune = self.get_packs_to_prune()
        if not to_prune:
            print(f"\n✅ All packs within retention limit (keeping last {self.keep_count})")
            return

        print(f"\nPruning {len(to_prune)} pack(s) beyond limit of {self.keep_count}")
        print(f"Dry-run: {dry_run}\n")

        if archive:
            print("ARCHIVING (moving to archived/):")
            for pack_name in to_prune:
                self.archive_pack(pack_name, dry_run)

        if delete:
            print("\nDELETING (from archived/, if > 30 days old):")
            for item in self.archive_dir.iterdir():
                if item.is_dir():
                    self.delete_pack(item.name, dry_run)

        if dry_run:
            print("\n⚠️  DRY-RUN ONLY — no changes made")
        else:
            print("\n✅ Pruning complete")

        # Print summary
        print("\n" + "=".repeat(80))
        print("SUMMARY")
        print("=".repeat(80))

        packs_after = self.list_packs()
        print(f"Packs before: {len(packs)}")
        print(f"Packs after: {len(packs_after)}")
        print(f"Packs archived: {len(to_prune)}")


def main():
    parser = argparse.ArgumentParser(
        description="Prune evidence packs to maintain retention policy"
    )
    parser.add_argument(
        "--keep",
        type=int,
        default=5,
        help="Number of evidence packs to keep (default: 5)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be deleted without making changes",
    )
    parser.add_argument(
        "--archive",
        action="store_true",
        default=True,
        help="Move old packs to archived/ (default: True)",
    )
    parser.add_argument(
        "--delete",
        action="store_true",
        help="Delete archived packs > 30 days old",
    )
    parser.add_argument(
        "--no-archive",
        dest="archive",
        action="store_false",
        help="Skip archiving",
    )

    args = parser.parse_args()

    pruner = EvidencePackPruner(keep_count=args.keep)
    pruner.run_prune(
        dry_run=args.dry_run,
        archive=args.archive,
        delete=args.delete,
    )


if __name__ == "__main__":
    main()
