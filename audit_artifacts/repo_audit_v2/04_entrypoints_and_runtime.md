# 04 — Entrypoints and Runtime

**Date**: 2024-12-18  
**Method**: Source code inspection + CLI discovery  
**Evidence**: `raw/rg_main.txt`, `raw/cli_main_head.txt`, `raw/cli_help.txt`

---

## Canonical Entrypoint

### Primary: CLI via Python Module

**Path**: `src/firsttry/__main__.py`  
**Type**: Command-line interface  
**Status**: ✅ Verified and traceable

```python
# src/firsttry/__main__.py
from __future__ import annotations

from .cli import main

if __name__ == "__main__":
    raise SystemExit(main())
```

**Execution**:
```bash
python -m firsttry [args]
# or (after pip install -e .)
firsttry [args]
```

**Evidence**: [raw/rg_main.txt](raw/rg_main.txt)

---

## CLI Implementation

### Framework: Click (Python CLI)

**Primary Handler**: `src/firsttry/cli.py` (lines 1-100 inspected)

**Imports**:
```python
import argparse
import click

# Framework dependencies
from firsttry.check_registry import CHECK_REGISTRY
from firsttry.planner.dag import Plan, Task
from firsttry.run_swarm import run_plan
from firsttry.ci_parity import parity_runner as ci_runner
from firsttry.config_loader import apply_overrides_to_plan, load_config
```

**Architecture**:
- **Primary Router**: `cli.py` (main entry → Click app)
- **Subcommands**: Multiple CLI variants (see variants below)
- **Config Loading**: Via `config_loader.py`
- **Plan Execution**: Via `planner/` module

### CLI Variants Discovered

| File | Purpose | Status |
|------|---------|--------|
| `src/firsttry/cli.py` | **CANONICAL** | Main entry; Click-based |
| `src/firsttry/cli_main.py` | Legacy/compat | Router alternative |
| `src/firsttry/cli_enhanced.py` | Enhanced features | Likely feature branch |
| `src/firsttry/cli_dag.py` | DAG-specific | Subcommand handler |
| `src/firsttry/cli_pipelines.py` | Pipeline runner | Specialized |
| `src/firsttry/cli_v2.py` | Version 2 rewrite | In-progress? |
| `src/firsttry/cli_run_profile.py` | Profile-based runs | Configuration variant |
| `src/firsttry/cli_runner_light.py` | Lightweight runner | Resource-constrained |
| `src/firsttry/cli_stable.py` | Stable API | Compat layer? |

**Assessment**: Multiple implementations suggest iterative CLI redesign. Primary is `cli.py`.

---

## Required Environment

### Python Version
- **Minimum**: 3.10 (from pyproject.toml)
- **Tested**: 3.11, 3.12 (classifiers)
- **Current**: 3.12.12 (audit environment)
- **Status**: ✅ Compatible

### Package Dependencies

**Core** (from pyproject.toml):
```
PyYAML
ruff>=0.1.0
black>=22.0.0
mypy>=1.0.0
pytest>=7.0.0
tomli (Python < 3.11)
```

**Optional** (feature-gated):
- `boto3` — S3 caching backend
- `click` — CLI framework (confirmed present)
- `pydantic` — Model validation (likely)

### Installation Status

**Current Audit Environment**:
- ❌ Package NOT installed
- ❌ Dependencies NOT installed
- ✅ Source code accessible for inspection

**To Enable Runtime**:
```bash
pip install -e .                    # Install package + core deps
pip install boto3                   # (Optional) S3 support
python -m firsttry --help           # Verify installation
```

---

## Expected CLI Output (Specification)

### Help Flag
```bash
python -m firsttry --help
```
**Expected**: Click-generated help with subcommands, options, usage

**Status**: ⚠️ NOT VERIFIED (requires installation)

### Version Check
```bash
firsttry --version
```
**Expected**: `1.0.0` (from pyproject.toml)

**Status**: ⚠️ NOT VERIFIED

### Subcommands (Inferred)

From source code patterns, expected subcommands:
- `run` — Execute checks locally
- `ci-parity` — Run CI parity validation
- `doctor` — Diagnostic checks
- `gate` — Quality gate status
- `cache` — Cache management
- `license` — License info
- `gates` — Run specific gates
- `config` — Configuration inspection

**Status**: ⚠️ NOT VERIFIED (requires help output parsing)

---

## Startup Sequence

### Inferred Order (from code inspection)

1. **Module Load** (`src/firsttry/__main__.py`)
2. **CLI Initialization** (`src/firsttry/cli.py`)
   - Load framework (click)
   - Register subcommands
   - Parse arguments
3. **Config Discovery** (`src/firsttry/config_loader.py`)
   - Load `.firsttry.yml` or defaults
   - Apply CLI overrides
4. **Plan Building** (`src/firsttry/planner/`)
   - Detect project type
   - Build execution DAG
5. **Execution** (`src/firsttry/run_swarm.py` or `runner/`)
   - Run checks in order
   - Report results

### Auto-Parity Bootstrap (Observed)

Code snippet from `cli.py`:
```python
def _auto_parity_enabled() -> bool:
    """Check if auto-parity is enabled (opt-out for end-users/CI)."""
    return os.getenv("FIRSTTRY_DISABLE_AUTO_PARITY") not in ("1", "true", "yes")

def _ensure_parity(root: Path) -> None:
    """Auto-bootstrap parity environment and install hooks on first run."""
    if not _auto_parity_enabled():
        return
    if not _in_git_repo(root) or not _has_parity_lock(root):
        return
    # ... bootstrap logic
```

**Behavior**:
- Auto-setup of `.venv-parity/` on first run
- Hook installation (if configured)
- Opt-out via `FIRSTTRY_DISABLE_AUTO_PARITY=1`

**Assessment**: ⚠️ Non-obvious behavior; user education needed

---

## Alt Entrypoints

### FastAPI Web Application

**Location**: `app/main.py`  
**Type**: HTTP server (optional; separate concern)  
**Status**: ⚠️ Not primary; likely for dashboard/IDE integration

```
app/
├── __init__.py
├── main.py          # FastAPI app
├── licensing.py     # License middleware
├── schemas.py       # Request/response models
└── webhooks.py      # Webhook handlers
```

**Assessment**: Separate from CLI; used for IDE extensions / web dashboard.

### Dashboard UI

**Location**: `dashboard/src/`  
**Type**: React/TypeScript UI  
**Status**: Optional; consumes FastAPI above

---

## Testing Entrypoints

### Test Runner
```bash
pytest tests/
```
**Test Framework**: pytest  
**Status**: ⚠️ NOT EXECUTABLE (pytest not installed)

### Smoke Test Markers (Inferred)
- `@pytest.mark.smoke` — Fast subset
- `@pytest.mark.integration` — Full pipeline
- `@pytest.mark.enterprise` — Tier-specific
- `@pytest.mark.slow` — Performance tests

**Status**: Unknown (would require collection)

---

## Configuration Discovery

### `.firsttry.yml` (Project Config)

**Location**: Root directory  
**Format**: YAML  
**Status**: ✅ File exists; content not inspected

**Expected Schema** (inferred):
```yaml
version: "1"
checks:
  - pytest
  - mypy
  - ruff
gates:
  - python_pytest
  - python_mypy
  - python_lint
profile: "standard"  # or "strict", "pro"
```

**Status**: ⚠️ Schema not documented in audit

### Config Override Strategy

From code inspection:
```python
# CLI can override config
python -m firsttry --profile=strict
python -m firsttry --checks=pytest,mypy
```

**Evidence**: `src/firsttry/config_loader.py` (not fully scanned)

---

## Known Issues / Gaps

| ID | Issue | Severity | Evidence | Fix |
|----|-------|----------|----------|-----|
| G-E1 | CLI help not captured (requires install) | MED | Can't run help without deps | Run: `pip install -e .` first |
| G-E2 | Auto-parity bootstrap not obvious | MED | Code inspection only | Document in CONTRIBUTING.md |
| G-E3 | Multiple CLI variants; primary unclear | MED | 8 cli_*.py files | Consolidate or document intent |
| G-E4 | `.firsttry.yml` schema not documented | HIGH | File exists; format unknown | Create schema documentation |
| G-E5 | FastAPI app separate from CLI; unclear when used | MED | `app/` exists; no integration doc | Document app/ entry criteria |

---

## Verification Commands

**To fully verify entrypoints**:
```bash
# 1. Install package
pip install -e .

# 2. Test primary entrypoint
python -m firsttry --help

# 3. Test version
firsttry --version

# 4. Test doctor (diagnostic)
firsttry doctor

# 5. Test run (minimal; requires project setup)
firsttry run --help
```

**Expected**: All commands exit with status 0 and produce help output.

---

## Summary

| Aspect | Status | Details |
|--------|--------|---------|
| **Primary Entrypoint** | ✅ FOUND | `src/firsttry/__main__.py` → `cli.py` |
| **Framework** | ✅ IDENTIFIED | Click (Python CLI) |
| **Package Status** | ⚠️ REQUIRES INSTALL | `pip install -e .` |
| **Auto-Bootstrap** | ⚠️ NOT OBVIOUS | `.venv-parity` setup on first run |
| **Subcommands** | ⚠️ UNVERIFIED | Inferred but not captured |
| **Help Output** | ❌ NOT CAPTURED | Requires installation |
| **Alt Entrypoints** | ✅ FOUND | FastAPI app (secondary) |

**Overall**: 🟡 **PARTIALLY VERIFIED**
- Canonical entrypoint proven traceable
- Requires installation for full verification
- CLI architecture clear but documentation incomplete

