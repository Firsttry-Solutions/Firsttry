#!/usr/bin/env python3
import pathlib, re, sys, unicodedata

WF_DIR = pathlib.Path(".github/workflows")
FILES = sorted(list(WF_DIR.glob("*.yml")) + list(WF_DIR.glob("*.yaml")))

# Remove BOM + Unicode Cf (format/bidi) + non-ASCII before scanning
def sanitize_text(s: str) -> str:
    s = s.lstrip("\ufeff")
    # Remove Cf (format/bidi)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Cf")
    # Remove non-ASCII (except newlines)
    s = "".join(ch if ord(ch) < 128 or ch in "\n\r" else "" for ch in s)
    return s

def count_top_level(txt: str, key: str) -> int:
    # Top-level only: column 0
    pat = rf"(?m)^{re.escape(key)}:\s*"
    return len(re.findall(pat, txt))

def find_second_name_index(txt: str):
    # Return char index of second top-level "name:" occurrence, or None
    m = list(re.finditer(r"(?m)^name:\s", txt))
    if len(m) < 2:
        return None
    return m[1].start()

def write_file(path: pathlib.Path, content: str):
    path.write_text(content, encoding="utf-8", newline="\n")

def is_ascii_no_tabs(path: pathlib.Path):
    b = path.read_bytes()
    non_ascii = [x for x in b if x not in (10,13) and x >= 128]
    tabs = b.count(b"\t")
    return (len(non_ascii) == 0, tabs == 0, len(non_ascii), tabs)

def main():
    print(f"Scanning {len(FILES)} workflow files...")
    broken = []
    for f in FILES:
        raw = f.read_text(encoding="utf-8", errors="replace")
        txt = sanitize_text(raw)

        name_c = count_top_level(txt, "name")
        on_c   = count_top_level(txt, "on")
        jobs_c = count_top_level(txt, "jobs")

        ascii_ok, tabs_ok, non_ascii_ct, tab_ct = is_ascii_no_tabs(f)

        # Record issues
        issues = []
        if (name_c, on_c, jobs_c) != (1,1,1):
            issues.append(f"top_level_counts(name={name_c}, on={on_c}, jobs={jobs_c})")
        if not ascii_ok:
            issues.append(f"non_ascii_bytes={non_ascii_ct}")
        if not tabs_ok:
            issues.append(f"tabs={tab_ct}")

        if issues:
            broken.append((f, issues, txt))

    print("")
    if not broken:
        print("OK: No broken workflows detected.")
        return 0

    print(f"BROKEN: {len(broken)} files:")
    for f, issues, _ in broken:
        print(f" - {f}: " + ", ".join(issues))

    # AUTO-REPAIR PHASE 1: Clean non-ASCII from all files
    for f, _, _ in broken:
        raw = f.read_text(encoding="utf-8", errors="replace")
        txt = sanitize_text(raw)
        write_file(f, txt)
        print(f" [SANITIZED] {f}")

    # AUTO-REPAIR PHASE 2: split concatenated workflows (2+ top-level name:) into primary + secondary
    repaired = 0
    post_files = sorted(list(WF_DIR.glob("*.yml")) + list(WF_DIR.glob("*.yaml")))
    for f in post_files:
        raw = f.read_text(encoding="utf-8", errors="replace")
        txt = sanitize_text(raw)
        name_count = count_top_level(txt, "name")
        
        if name_count >= 2:
            idx = find_second_name_index(txt)
            if idx is None:
                continue
            primary = txt[:idx].rstrip() + "\n"
            secondary = txt[idx:].lstrip()

            stem = f.stem
            ext = f.suffix
            sec_path = f.with_name(f"{stem}-secondary{ext}")

            # Basic safety: both parts must contain required keys at least once
            def has_required(part: str) -> bool:
                return (
                    re.search(r"(?m)^name:\s", part) and
                    re.search(r"(?m)^on:\s*$", part) and
                    re.search(r"(?m)^jobs:\s*$", part)
                )

            if not has_required(primary) or not has_required(secondary):
                continue

            write_file(f, primary)
            write_file(sec_path, secondary)
            repaired += 1
            print(f" [SPLIT] {f} -> {f.name} + {sec_path.name}")

    if repaired:
        print(f"\nAUTO-REPAIR: split {repaired} concatenated workflow files into -secondary.*")

    # Re-scan after repair attempt
    print("\nRe-scan after auto-repair...")
    post_broken = []
    post_files = sorted(list(WF_DIR.glob("*.yml")) + list(WF_DIR.glob("*.yaml")))
    for f2 in post_files:
        raw2 = f2.read_text(encoding="utf-8", errors="replace")
        txt2 = sanitize_text(raw2)
        name_c = count_top_level(txt2, "name")
        on_c   = count_top_level(txt2, "on")
        jobs_c = count_top_level(txt2, "jobs")
        ascii_ok, tabs_ok, _, _ = is_ascii_no_tabs(f2)
        
        if (name_c, on_c, jobs_c) != (1,1,1) or not ascii_ok or not tabs_ok:
            post_broken.append((f2, name_c, on_c, jobs_c))
    
    if post_broken:
        print("FAIL: still broken workflows exist:")
        for f2, a,b,c in post_broken:
            print(f" - {f2}: name={a}, on={b}, jobs={c}")
        return 2

    print("PASS: all workflows now have exactly 1x name/on/jobs and are ASCII-only (post-repair).")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
