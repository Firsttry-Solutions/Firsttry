#!/bin/bash

# DOCS_GATE: Non-Bypassable Documentation Validator
# Fast check for Marketplace compliance standards

set -o pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_DIR="${REPO_ROOT}/docs"
PASSED=0
FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "=== DOCS_GATE v1.1 ==="
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
LINK_CHECK_LOG=$(python3 << 'LINK_INTEGRITY_PY'
import re
from pathlib import Path
import sys

root = Path("/workspaces/Firsttry")
docs = root / "docs"
pat = re.compile(r"\[[^\]]+\]\(([^)]+)\)")

broken = []
checked = 0

for p in sorted(docs.rglob("*")):
    if p.suffix.lower() not in [".md", ".html"]:
        continue
    try:
        txt = p.read_text(errors="ignore")
    except:
        continue
    
    for m in pat.finditer(txt):
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
        
        # Check existence
        if not target.exists():
            broken.append((str(p.relative_to(root)), url, str(target)))

print(f"Checked: {checked} links")
if broken:
    print(f"Broken: {len(broken)}")
    for file, link, target in broken[:20]:
        print(f"  {file}: [{link}] -> {target}")
    sys.exit(1)
else:
    print("All links valid")
    sys.exit(0)
LINK_INTEGRITY_PY
)

echo "$LINK_CHECK_LOG"
if echo "$LINK_CHECK_LOG" | grep -q "All links valid"; then
    echo -e "${GREEN}✅${NC} All internal links valid"
    ((PASSED++))
else
    echo -e "${RED}❌${NC} Broken internal links detected"
    ((FAILED++))
fi

#######################################
# GATE 3: Manifest ↔ SCOPES Drift Detection
#######################################
echo ""
echo "GATE 3: Scope Drift (Manifest ↔ SCOPES.md)"

MANIFEST_FILE="${REPO_ROOT}/atlassian/forge-app/manifest.yml"
SCOPES_FILE="${DOCS_DIR}/SCOPES.md"

if test -f "$MANIFEST_FILE" && test -f "$SCOPES_FILE"; then
    # Extract scopes from manifest (under permissions.scopes)
    MANIFEST_SCOPES=$(sed -n '/scopes:/,/^[^ ]/p' "$MANIFEST_FILE" | grep -- '- ' | sed 's/.*- //' | sed "s/'//g" | sed 's/"//g' | sort -u)
    
    if test -n "$MANIFEST_SCOPES"; then
        echo "Manifest scopes: $(echo "$MANIFEST_SCOPES" | tr '\n' ' ')"
        
        # Check each manifest scope is in SCOPES.md
        SCOPE_DRIFT=0
        for scope in $MANIFEST_SCOPES; do
            if ! grep -q "$scope" "$SCOPES_FILE"; then
                echo -e "${RED}❌${NC} Manifest scope '$scope' not documented in SCOPES.md"
                ((SCOPE_DRIFT++))
                ((FAILED++))
            fi
        done
        
        if test "$SCOPE_DRIFT" -eq 0; then
            echo -e "${GREEN}✅${NC} No scope drift detected"
            ((PASSED++))
        fi
    else
        echo -e "${YELLOW}⚠️${NC} No scopes found in manifest"
    fi
else
    echo -e "${YELLOW}⚠️${NC} Cannot verify scope drift (missing manifest or SCOPES.md)"
fi

#######################################
# GATE 4: API Scopes Documentation (legacy)
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
# GATE 4: No Placeholders in Critical Docs
#######################################
echo ""
echo "GATE 4: Placeholder Terms"
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
