import pathlib, re, sys, unicodedata

WF_DIR = pathlib.Path(".github/workflows")
FILES = sorted(list(WF_DIR.glob("*.yml")) + list(WF_DIR.glob("*.yaml")))

# Unicode format chars (Cf) + BOM + bidi controls are a known GitHub warning.
def strip_cf(s: str) -> str:
    out = []
    for ch in s:
        cat = unicodedata.category(ch)
        # remove format chars + BOM
        if cat == "Cf" or ch == "\ufeff":
            continue
        out.append(ch)
    return "".join(out)

def count_top_level_keys(txt: str, key: str) -> int:
    # GitHub may treat "invisible" chars as column 0; normalize first, then match start-of-line.
    norm = strip_cf(txt)
    # Also strip leading zero-width spaces on each line (still Cf, but belt+suspenders)
    norm = re.sub(r'(?m)^[\u200b\u200c\u200d\u2060]+', '', norm)
    return len(re.findall(rf"(?m)^{re.escape(key)}:\s", norm))

def find_all_key_lines(txt: str, key: str):
    norm = strip_cf(txt)
    norm = re.sub(r'(?m)^[\u200b\u200c\u200d\u2060]+', '', norm)
    lines = norm.splitlines()
    hits = []
    for i, line in enumerate(lines, start=1):
        if re.match(rf"^{re.escape(key)}:\s", line):
            hits.append(i)
    return hits

def has_any_cf(txt: str) -> bool:
    for ch in txt:
        if ch == "\ufeff" or unicodedata.category(ch) == "Cf":
            return True
    return False

problems = []
print(f"Scanning {len(FILES)} workflow files...\n")
for p in FILES:
    raw = p.read_text(encoding="utf-8", errors="replace")
    name_c = count_top_level_keys(raw, "name")
    on_c   = count_top_level_keys(raw, "on")
    jobs_c = count_top_level_keys(raw, "jobs")
    cf = has_any_cf(raw)
    status = "OK"
    if name_c != 1 or on_c != 1 or jobs_c != 1 or cf:
        status = "BROKEN"
        problems.append(p)
    print(f"{status:6s} {p.name:40s} name={name_c} on={on_c} jobs={jobs_c} cf={cf}")

if problems:
    print("\nBROKEN FILES (needs repair):")
    for p in problems:
        raw = p.read_text(encoding="utf-8", errors="replace")
        print(f"- {p}  name_lines={find_all_key_lines(raw,'name')} on_lines={find_all_key_lines(raw,'on')} jobs_lines={find_all_key_lines(raw,'jobs')}")
    sys.exit(2)

print("\nAll workflow files look structurally valid (after unicode normalization).")
