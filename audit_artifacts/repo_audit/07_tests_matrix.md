# Tests Matrix

**Generated:** 2025-12-18
**Evidence:** tests_list.txt (603 test files)

## Summary

| Metric | Value | Status |
|--------|-------|--------|
| Test Files Found | 603 | ✅ |
| Test Execution | BLOCKED | ❌ Missing dependencies |
| Coverage Report | TBD | ⚠️ Blocked |
| CI/CD Status | UNKNOWN | ⚠️ See workflows |

## Test Execution Status

**Current Issue:** ❌ **BLOCKER** - Missing dependencies

```
ModuleNotFoundError: No module named 'blake3'
ModuleNotFoundError: No module named 'botocore'
```

**Root Cause:** 
- `blake3` → required by `src/firsttry/twin/hashers.py:7`
- `botocore` → required for S3 integration tests
- Both are in `[project.optional-dependencies.test]` in pyproject.toml
- But NOT installed in `.venv_tmp`

**Dependency Chain:**
```
src/firsttry/runners/npm_test.py
  └─> src/firsttry/twin/hashers.py
      └─> import blake3 ❌ MISSING

tests/cache/test_cache_s3_fail_open.py
  └─> from botocore.exceptions import ClientError ❌ MISSING

tests/cli/test_ft_entrypoints_tiers.py
  └─> (transitive through firsttry.ft)
      └─> blake3 ❌ MISSING
```

---

## Test File Breakdown

**By Folder:**

### `tests/.venv-build/` (217 files)

- `./.venv-build/lib/python3.11/site-packages/mypy/test/meta/test_diff_helper.py`
- `./.venv-build/lib/python3.11/site-packages/mypy/test/meta/test_parse_data.py`
- `./.venv-build/lib/python3.11/site-packages/mypy/test/meta/test_update_data.py`
- `./.venv-build/lib/python3.11/site-packages/mypy/test/test_config_parser.py`
- `./.venv-build/lib/python3.11/site-packages/mypy/test/test_find_sources.py`
- ... and 212 more

### `tests/.venv_tmp/` (134 files)

- `./.venv_tmp/lib/python3.12/site-packages/bandit/core/test_properties.py`
- `./.venv_tmp/lib/python3.12/site-packages/bandit/core/test_set.py`
- `./.venv_tmp/lib/python3.12/site-packages/boolean/test_boolean.py`
- `./.venv_tmp/lib/python3.12/site-packages/mypy/test/meta/test_diff_helper.py`
- `./.venv_tmp/lib/python3.12/site-packages/mypy/test/meta/test_parse_data.py`
- ... and 129 more

### `tests/speed_test.py/` (1 files)

- `./speed_test.py`

### `tests/src/` (1 files)

- `./src/firsttry/runners/npm_test.py`

### `tests/tests/` (236 files)

- `./tests/cache/test_cache_s3.py`
- `./tests/cache/test_cache_s3_fail_open.py`
- `./tests/ci/test_parity_lock_matches_pyproject.py`
- `./tests/ci_parity/test_cache_utils_core.py`
- `./tests/ci_parity/test_detector_and_and.py`
- ... and 231 more

### `tests/tools/` (14 files)

- `./tools/firsttry/tests/test_changed.py`
- `./tools/firsttry/tests/test_cli.py`
- `./tools/firsttry/tests/test_cli_license.py`
- `./tools/firsttry/tests/test_cli_license_ok.py`
- `./tools/firsttry/tests/test_hooks.py`
- ... and 9 more

---

## Test Categories & Coverage

| Category | Files | Purpose | Status |
|----------|-------|---------|--------|
| `.venv-build` | 217 | UNKNOWN | TBD |
| `.venv_tmp` | 134 | UNKNOWN | TBD |
| `speed_test.py` | 1 | UNKNOWN | TBD |
| `src` | 1 | UNKNOWN | TBD |
| `tests` | 236 | UNKNOWN | TBD |
| `tools` | 14 | UNKNOWN | TBD |

---

## To Unblock Tests

**Step 1:** Install test dependencies

```bash
pip install blake3>=0.4
pip install boto3>=1.34 botocore>=1.34
# OR use test extra:
pip install '.[test]'
```

**Step 2:** Run test suite

```bash
.venv_tmp/bin/python -m pytest -v 2>&1 | tee pytest_full.txt
```

**Step 3:** Generate coverage report

```bash
.venv_tmp/bin/python -m pytest --cov=src --cov-report=html
```

---

## Missing Test Categories

**Status:** Need to verify with actual run

❌ **TODO:** After tests run, verify coverage for:

- [ ] Unit tests for all public APIs
- [ ] Integration tests for CLI commands
- [ ] E2E tests for common workflows
- [ ] Performance regression tests
- [ ] Security tests (input validation, auth)
- [ ] Backup/recovery scenarios
- [ ] S3 integration edge cases

---

## Known Issues

1. **Missing blake3 dependency** → Blocks module imports
2. **Missing botocore dependency** → Blocks S3 tests
3. **Virtual env isolation** → .venv_tmp missing test extras

## Next Steps

1. Install test dependencies (see above)
2. Re-run: `.venv_tmp/bin/python -m pytest --collect-only` to get full test count
3. Execute full test suite and capture results
4. Generate coverage report
5. Identify failing tests and broken imports
