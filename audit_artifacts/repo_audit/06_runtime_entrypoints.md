# Runtime Entrypoints Inventory

**Generated:** 2025-12-18
**Evidence:** rg_main.txt, rg_cli.txt, rg_apps.txt

## Summary

| Type | Count | Status |
|------|-------|--------|
| `__main__` blocks | 743 | ✅ Found |
| CLI framework refs | 1,131 | ✅ Found |
| Web framework refs | 209 | ⚠️ Found (review needed) |
| Actual source entrypoints | ? | TBD (manual audit needed) |

## 1. Python `__main__` Entrypoints

**Total Found:** 743 occurrences (includes venv, demos, tests)

**Sample Source Entrypoints (non-venv):**

- `./demo_step12_enhanced_orchestrator.py`
- `./demo_step7_smart_pytest.py`
- `./demo_pipeline.py`
- `./performance_benchmark.py`
- `./tests/cache/test_cache_s3_fail_open.py`
- `./tests/test_module_main.py`
- `./tests/test_main_module_help_safe.py`
- `./tests/test_main_module_help_safe.py`
- `./tests/phase4/test_ci_workflow_validation.py`
- `./tests/phase3/test_mypy_strict_mode.py`
- `./tests/phase3/test_audit_schema.py`
- `./tests/enterprise/test_performance_slo.py`
- `./tests/enterprise/test_policy_lock.py`
- `./tests/enterprise/test_release_sbom.py`
- `./tests/enterprise/test_ci_parity.py`
- `./tests/enterprise/test_commit_validation.py`
- `./tests/enterprise/test_secrets_scanning.py`
- `./tests/enterprise/test_remote_cache_e2e.py`
- `./tests/enterprise/test_dependency_audit.py`
- `./demo_smart_pytest.py`

**Typical Pattern:**
```python
if __name__ == '__main__':
    main()
```

**Entrypoints Found:**

| File | Purpose | Status |
|------|---------|--------|
| `src/firsttry/cli.py` | CLI command interface | TBD |
| `src/firsttry/ft.py` | Main entry module | TBD |
| `scripts/run_all_tests.sh` | Test runner | TBD |
| `demo_*.py files` | Demo/example scripts | TBD |

---

## 2. CLI Framework Usage

**Total Found:** 1,131 occurrences

**Frameworks Detected:**
- `typer` - Used for modern async CLI
- `click` - Legacy decorator-based CLI
- `argparse` - Standard library (basic usage)

**Evidence:**
```
./src/firsttry/cli_ci_parity.py:3:from argparse import ArgumentParser
./src/firsttry/runners/strict.py:8:    import argparse
./src/firsttry/runners/strict.py:11:def run(args: argparse.Namespace) -> int:
./src/firsttry/runners/fast.py:8:    import argparse
./src/firsttry/runners/fast.py:11:def run(args: argparse.Namespace) -> int:
```

**Impact:**
- Multiple CLI frameworks suggests refactoring in progress
- Recommend standardizing on one (suggest typer for async)
- Clean up deprecated CLI patterns

---

## 3. Web Framework Usage

**Total Found:** 209 occurrences

**Frameworks Detected:**
- `Django`

**Evidence:**
```
./.venv-build/lib/python3.12/site-packages/rich/syntax.py:381:        best lexer to use. For example
./.venv-build/lib/python3.12/site-packages/pip/_vendor/rich/syntax.py:381:        best lexer to use.
./.venv-build/lib/python3.12/site-packages/pip/_vendor/distlib/compat.py:618:        def new_child(s
./.venv-build/lib/python3.12/site-packages/pip/_vendor/distlib/compat.py:623:        def parents(sel
./.venv-build/lib/python3.12/site-packages/pip/_vendor/pygments/lexers/_mapping.py:804:    "CssDjang
```

---

## 4. Identified Runnable Modules

**Method:** Scanning for `if __name__ == '__main__'` + common entry patterns

### CLI Entrypoints

| Module | Run Command | Status |
|--------|-------------|--------|
| `src/firsttry/ft.py` | `python -m firsttry.ft` | TBD |
| `src/firsttry/cli.py` | `python -m firsttry.cli` | TBD |
| Demo scripts | `python demo_*.py` | TBD |

### Scripts

| Script | Command | Status |
|--------|---------|--------|
| `scripts/run_all_tests.sh` | `bash scripts/run_all_tests.sh` | TBD |
| `local_ci.sh` | `bash local_ci.sh` | TBD |

---

## Verification Steps

To fully audit entrypoints, run:

```bash
# Find all Python __main__ in source
grep -rn "if __name__" src/ tests/ scripts/ --include='*.py'

# Find CLI decorators
grep -rn "@typer\|@click" src/ --include='*.py'

# Find FastAPI app instances
grep -rn "FastAPI()\|APIRouter()" src/ --include='*.py'

# Try running entrypoints
python -m firsttry.ft --help
python src/firsttry/cli.py --help
```

---

## Known Gaps

❌ **TODO:** Need to manually test each entrypoint to verify:
- Does it run without errors?
- What are required environment variables?
- What is the expected output?
- Is it documented?
