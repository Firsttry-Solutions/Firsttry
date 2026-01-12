#!/usr/bin/env python3
import sys, pathlib, re, unicodedata

WF_DIR = pathlib.Path(".github/workflows")

def is_ascii_only_bytes(data: bytes) -> bool:
    # allow LF=10 and CR=13
    return all((b < 128) or (b in (10, 13)) for b in data)

def validate_one(path: pathlib.Path, errors: list) -> None:
    data = path.read_bytes()

    # ASCII-only check
    if not is_ascii_only_bytes(data):
        errors.append(f"{path}: non-ASCII byte detected (must be ASCII-only)")

    # Tab check
    if b"\t" in data:
        errors.append(f"{path}: TAB character detected (must use spaces only)")

    text = data.decode("utf-8", errors="replace")

    # BOM check
    if text.startswith("\ufeff"):
        errors.append(f"{path}: BOM detected")

    # Unicode Cf (format/bidi) check
    for i, ch in enumerate(text):
        if unicodedata.category(ch) == "Cf":
            line_no = text[:i].count("\n") + 1
            errors.append(f"{path}:{line_no}: Unicode Cf (format/bidi) character detected")
            break

    # Top-level duplicate checks (column 0 only)
    lines = text.splitlines()
    name_count = sum(1 for line in lines if re.match(r"^name:\s", line))
    on_count   = sum(1 for line in lines if re.match(r"^on:\s*$", line))
    jobs_count = sum(1 for line in lines if re.match(r"^jobs:\s*$", line))

    if name_count != 1:
        errors.append(f"{path}: name_count={name_count} (expected exactly 1)")
    if on_count != 1:
        errors.append(f"{path}: on_count={on_count} (expected exactly 1)")
    if jobs_count != 1:
        errors.append(f"{path}: jobs_count={jobs_count} (expected exactly 1)")

    # Secret usage forbidden
    if re.search(r"secrets\.", text, re.IGNORECASE):
        errors.append(f"{path}: forbidden secrets.* reference found")

    # Deploy/release/publish/marketplace forbidden in non-release workflows
    forbidden = re.search(r"\b(deploy|publish|marketplace)\b", text, re.IGNORECASE)
    if forbidden and path.name != "release-manual.yml":
        errors.append(f"{path}: forbidden deploy/publish/marketplace keyword found")

def main() -> int:
    if not WF_DIR.exists():
        print("OK: .github/workflows does not exist yet")
        return 0

    errors = []
    files = sorted(list(WF_DIR.glob("*.yml")) + list(WF_DIR.glob("*.yaml")))
    if not files:
        print("OK: No workflows found in .github/workflows")
        return 0

    for f in files:
        if f.name.endswith(".bak"):
            continue
        validate_one(f, errors)

    if errors:
        print("ERRORS FOUND IN ACTIVE WORKFLOWS:")
        for e in errors:
            print(f"  - {e}")
        return 1

    print("OK: Active workflows are ASCII-only, tab-free, no BOM/Cf, and have exactly 1x name/on/jobs; no secrets; no deploy/publish (except release-manual).")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
