#!/bin/bash

# DOCS_GATE: Non-Bypassable Documentation Validator
# Fast check for Marketplace compliance standards

set -o pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export REPO_ROOT
DOCS_DIR="${REPO_ROOT}/docs"
PASSED=0
FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== DOCS_GATE v1.2 ==="
echo ""

#######################################
# GATE 1: Required Docs
#######################################
echo "GATE 1: Required Documentation"
for doc in SCOPES.md README.md SECURITY.md PRIVACY.md SUPPORT_POLICY.md CHANGE_MANAGEMENT.md ROADMAP.md ENTERPRISE_ONE_PAGER.md COMPLIANCE.md DATA_RETENTION.md DATA_INVENTORY.md claims_proof_catalog.md; do
    if test -f "${DOCS_DIR}/${doc}"; then
        echo -e "${GREEN}✅${NC} docs/${doc}"
        ((PASSED++))
    else
        echo -e "${RED}❌${NC} docs/${doc} MISSING"
        ((FAILED++))
    fi
done

#######################################
# GATE 2: Index Quality
#######################################
echo ""
echo "GATE 2: Documentation Index"
if test -f "${DOCS_DIR}/README.md"; then
    LINKS=$(grep -c '\[' "${DOCS_DIR}/README.md" || echo 0)
    if test "$LINKS" -ge 20; then
        echo -e "${GREEN}✅${NC} docs/README.md has $LINKS links"
        ((PASSED++))
    else
        echo -e "${RED}❌${NC} docs/README.md insufficient links ($LINKS)"
        ((FAILED++))
    fi
fi

#######################################
# GATE 2.5: Link Integrity (Internal Links)
#######################################
echo ""
echo "GATE 2.5: Link Integrity"

# Create temp file for link check output
LINK_CHECK_TEMP=$(mktemp)
trap "rm -f $LINK_CHECK_TEMP" EXIT

# Run Python and capture both output and exit code
(python3 << 'LINK_INTEGRITY_PY'
import re
import os
import sys
from pathlib import Path

# Use env var for repo root (CI-safe)
root = Path(os.environ["REPO_ROOT"])
docs = root / "docs"

# Patterns for markdown and HTML links
md_pat = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
html_pat = re.compile(r'href=(["\'])([^"\']+)\1')

broken = []
checked = 0

for p in sorted(docs.rglob("*")):
    if p.suffix.lower() not in [".md", ".html"]:
        continue
    try:
        txt = p.read_text(errors="ignore")
    except:
        continue
    
    # Extract markdown links [text](path)
    for m in md_pat.finditer(txt):
        url = m.group(1).strip()
        checked += 1
        
        # Skip external links
        if url.startswith(("http://", "https://", "mailto:", "tel:")):
            continue
        # Skip pure anchors
        if url.startswith("#") or url == "":
            continue
        
        # Strip fragment
        url_path = url.split("#", 1)[0].strip()
        if not url_path:
            continue
        
        # Resolve target
        if url_path.startswith("/"):
            target = root / url_path.lstrip("/")
        else:
            target = (p.parent / url_path).resolve()
        
        # Check if target is within repo
        try:
            target.relative_to(root)
        except ValueError:
            broken.append((str(p.relative_to(root)), url, "OUTSIDE_REPO"))
            continue
        
        # Check existence (dir or file)
        if not target.exists():
            broken.append((str(p.relative_to(root)), url, str(target.relative_to(root))))
        elif target.is_dir() and url_path.endswith("/"):
            # Directory explicitly linked (with /) is OK
            pass
        elif target.is_dir():
            # Directory must have index file
            if not any((target / idx).exists() for idx in ["index.md", "README.md", "index.html"]):
                broken.append((str(p.relative_to(root)), url, f"{target.relative_to(root)} (DIR_NO_INDEX)"))
    
    # Extract HTML links href="path" or href='path'
    for m in html_pat.finditer(txt):
        url = m.group(2).strip()
        checked += 1
        
        # Skip external links
        if url.startswith(("http://", "https://", "mailto:", "tel:")):
            continue
        # Skip pure anchors
        if url.startswith("#") or url == "":
            continue
        
        # Strip fragment
        url_path = url.split("#", 1)[0].strip()
        if not url_path:
            continue
        
        # Resolve target
        if url_path.startswith("/"):
            target = root / url_path.lstrip("/")
        else:
            target = (p.parent / url_path).resolve()
        
        # Check if target is within repo
        try:
            target.relative_to(root)
        except ValueError:
            broken.append((str(p.relative_to(root)), url, "OUTSIDE_REPO"))
            continue
        
        # Check existence (dir or file)
        if not target.exists():
            broken.append((str(p.relative_to(root)), url, str(target.relative_to(root))))
        elif target.is_dir() and url_path.endswith("/"):
            # Directory explicitly linked (with /) is OK
            pass
        elif target.is_dir():
            # Directory must have index file
            if not any((target / idx).exists() for idx in ["index.md", "README.md", "index.html"]):
                broken.append((str(p.relative_to(root)), url, f"{target.relative_to(root)} (DIR_NO_INDEX)"))

print(f"Checked: {checked} links")
if broken:
    print(f"Broken: {len(broken)}")
    for file, link, target in broken[:50]:
        print(f"  {file}: [{link}] -> {target}")
    sys.exit(1)
else:
    print("All links valid")
    sys.exit(0)
LINK_INTEGRITY_PY
) > "$LINK_CHECK_TEMP" 2>&1
LINK_EXIT=$?

cat "$LINK_CHECK_TEMP"

if test "$LINK_EXIT" -eq 0; then
    echo -e "${GREEN}✅${NC} All internal links valid"
    ((PASSED++))
else
    echo -e "${RED}❌${NC} Broken internal links detected"
    ((FAILED++))
fi

#######################################
# GATE 3: Manifest ↔ SCOPES Drift Detection (Multi-Manifest + Overclaim Check)
#######################################
echo ""
echo "GATE 3: Scope Drift (Manifest ↔ SCOPES.md)"

SCOPES_FILE="${DOCS_DIR}/SCOPES.md"

if test -f "$SCOPES_FILE"; then
    # Find ALL manifest files in repo
    MANIFEST_FILES=$(find "$REPO_ROOT" -name "manifest.yml" -o -name "manifest.yaml" | sort)
    
    if test -n "$MANIFEST_FILES"; then
        # Union all scopes from all manifests
        MANIFEST_SCOPES_UNION=""
        for mf in $MANIFEST_FILES; do
            SCOPES=$(sed -n '/scopes:/,/^[^ ]/p' "$mf" | grep -- '- ' | sed 's/.*- //' | sed "s/'//g" | sed 's/"//g' | sort -u)
            if test -z "$MANIFEST_SCOPES_UNION"; then
                MANIFEST_SCOPES_UNION="$SCOPES"
            else
                MANIFEST_SCOPES_UNION=$(printf "%s\n%s" "$MANIFEST_SCOPES_UNION" "$SCOPES" | sort -u)
            fi
        done
        
        if test -n "$MANIFEST_SCOPES_UNION"; then
            echo "Manifest scopes: $(echo "$MANIFEST_SCOPES_UNION" | tr '\n' ' ')"
            
            # Check each manifest scope is in SCOPES.md
            SCOPE_DRIFT=0
            for scope in $MANIFEST_SCOPES_UNION; do
                if ! grep -q "$scope" "$SCOPES_FILE"; then
                    echo -e "${RED}❌${NC} Manifest scope '$scope' not documented in SCOPES.md"
                    ((SCOPE_DRIFT++))
                    ((FAILED++))
                fi
            done
            
            # Check for overclaims: scopes in "Declared Scopes" section but not in manifest (STRICT - must FAIL)
            # Extract only the "Declared Scopes" section (between "## Declared Scopes" and "## What FirstTry NEVER")
            DECLARED_SECTION=$(sed -n '/## Declared Scopes/,/## What FirstTry NEVER/p' "$SCOPES_FILE" | head -n -1)
            
            if test -n "$DECLARED_SECTION"; then
                DOCS_SCOPE_PATTERNS=$(echo "$DECLARED_SECTION" | grep -o '[a-z][a-z]*:[a-z0-9_-]*' | sort -u 2>/dev/null || echo "")
                OVERCLAIM_COUNT=0
                for doc_scope in $DOCS_SCOPE_PATTERNS; do
                    if ! echo "$MANIFEST_SCOPES_UNION" | grep -q "^${doc_scope}$"; then
                        # Skip markdown/YAML syntax patterns (not real scopes)
                        if ! echo "$doc_scope" | grep -qE '^(scopes|permissions|modules|resources|app|metadata|key|handler|function|resolver|interval|trigger)'; then
                            echo -e "${RED}❌${NC} 'Declared Scopes' section mentions '$doc_scope' but not in any manifest (overclaim)"
                            ((OVERCLAIM_COUNT++))
                            ((FAILED++))
                        fi
                    fi
                done
            fi
            
            if test "$SCOPE_DRIFT" -eq 0; then
                echo -e "${GREEN}✅${NC} No scope drift detected (manifest ↔ docs aligned)"
                ((PASSED++))
            fi
        else
            echo -e "${YELLOW}⚠️${NC} No scopes found in any manifest"
        fi
    else
        echo -e "${YELLOW}⚠️${NC} No manifest files found in repo"
    fi
else
    echo -e "${YELLOW}⚠️${NC} Cannot verify scope drift (missing SCOPES.md)"
fi

#######################################
# GATE 4: API Scopes Presence
#######################################
echo ""
echo "GATE 4: API Scopes Presence"
if test -f "${DOCS_DIR}/SCOPES.md"; then
    if grep -q "storage:app\|read:jira-work" "${DOCS_DIR}/SCOPES.md"; then
        echo -e "${GREEN}✅${NC} SCOPES.md documents required scopes"
        ((PASSED++))
    else
        echo -e "${RED}❌${NC} SCOPES.md missing scope definitions"
        ((FAILED++))
    fi
fi

#######################################
# GATE 5: No Placeholders in Critical Docs
#######################################
echo ""
echo "GATE 5: Placeholder Terms"
CRITICAL="SECURITY.md PRIVACY.md SCOPES.md"
for doc in $CRITICAL; do
    if test -f "${DOCS_DIR}/${doc}"; then
        if grep -qi "TBD\|TODO\|coming soon\|lorem ipsum" "${DOCS_DIR}/${doc}"; then
            echo -e "${RED}❌${NC} ${doc} contains placeholder text"
            ((FAILED++))
        else
            echo -e "${GREEN}✅${NC} ${doc} no placeholders"
            ((PASSED++))
        fi
    fi
done

#######################################
# SUMMARY
#######################################
echo ""
echo "======================================="
TOTAL=$((PASSED + FAILED))
echo "Results: ${GREEN}${PASSED}/${TOTAL} passed${NC}"
if test "$FAILED" -eq 0; then
    echo -e "${GREEN}✅ DOCS_GATE PASSED${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}${FAILED} failures${NC}"
    echo -e "${RED}❌ DOCS_GATE FAILED${NC}"
    echo ""
    exit 1
fi
