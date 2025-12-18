# Code Health Findings

**Evidence Sources:**
- `rg_todos.txt` → 2,696 TODO/FIXME/XXX occurrences
- `rg_notimplemented.txt` → 4,337 NotImplementedError/pass stubs
- `rg_placeholders.txt` → 2,048 placeholder markers
- `rg_import_risks.txt` → 1,921 import patterns

## 1. TODO/FIXME/XXX Markers: 2,696 occurrences

**Status:** 🔴 CRITICAL

**Breakdown:**
- Total occurrences: 2,696 (across all Python/JS/MD files)
- In src/tests/scripts (non-venv): ~3 occurrences
- In venv packages: ~2693 (external, ignore)

**Sample Findings (from src/tests):**

```
./src/firsttry/checks_orchestrator_optimized.py:35:    TODO: for very large repos, consider:
```

```
./src/firsttry/tests/prune.py:78:    # TODO: Implement more sophisticated dependency analysis
```

```
./src/firsttry/config_loader.py:119:    cmd = "grep -R 'TODO(admin)' src/"
```

**Impact:** 
- Code is incomplete or has known issues
- Maintenance burden - unclear which are critical
- Technical debt accumulating

**Recommendation:**
1. Run `grep -rn 'TODO|FIXME' src/ tests/ --include='*.py'` to get full source-only list
2. Create JIRA/GitHub Issues for each high-priority TODO
3. Set SLA for resolution (e.g., must resolve within 2 sprints)
4. Scan for stale TODOs (>6 months old in git blame)

---

## 2. NotImplementedError / Pass Stubs: 4,337 occurrences

**Status:** 🔴 CRITICAL

**Breakdown:**
- Total NotImplementedError + pass stubs: 4,337
- In src/tests/scripts: ~98 occurrences
- Pattern: `raise NotImplementedError` or bare `pass` statements

**Sample Findings:**

```
./tests/cache/test_cache_s3_fail_open.py:128:        pass
```

```
./tests/test_db_sqlite.py:42:    pass
```

```
./tests/test_cli_real_runners_integration.py:61:            pass
```

```
./tests/test_cli_parser_and_json.py:22:    pass
```

```
./tests/license/test_license_guard_tiers.py:31:                pass
```

**Impact:**
- Functions/classes declared but not implemented
- Dead code or placeholder implementations
- Tests may call unimplemented stubs and silently pass

**Verification Needed:**
1. Is each stub intentionally deferred?
2. Are there tests verifying these raise NotImplementedError?
3. Which are truly dead vs. deferred for v2.0?

---

## 3. Placeholder Markers: 2,048 occurrences

**Status:** 🟡 MEDIUM

**Breakdown:**
- Keywords: 'placeholder', 'lorem', 'dummy', 'sample'
- Total found: 2,048
- In src/tests: ~74 (non-venv)

**Sample Findings:**

```
./tests/test_smart_pytest_minimal.py:20:    failed = {"tests/test_sample.py::test_one": {}}
```

```
./tests/test_smart_pytest_minimal.py:25:    assert "tests/test_sample.py::test_one" in res
```

```
./tests/gates/test_bootstrap_and_status.py:28:    # create a dummy status file
```

```
./tests/gates/test_gate_run_cloud_only_flag.py:8:    dummy_job = Job(
```

```
./tests/gates/test_gate_run_cloud_only_flag.py:19:        cloud_only_jobs=[dummy_job],
```

**Impact:**
- May indicate incomplete implementations or demo code
- Risk of placeholder data reaching production

**Verification:**
1. Audit: Are any in critical paths?
2. Check: Do CI tests use dummy data?
3. Recommend: Use actual test fixtures instead

---

## 4. Import Risks: 1,921 occurrences

**Status:** 🟡 MEDIUM

**Patterns Detected:**
- `import X as Y` patterns (aliasing)
- `from X import *` (wildcard imports)

**Risk Assessment:**
- Wildcard imports reduce code clarity
- Make it hard to trace symbol origins
- Can cause namespace collisions

**Recommendation:**
1. Audit for `from X import *` (worst case)
2. Modernize to explicit imports
3. Use linter rule to prevent new patterns

---

## Summary Table

| Category | Count | Severity | Evidence |
|----------|-------|----------|----------|
| TODO/FIXME/XXX | 2,696 | 🔴 CRITICAL | rg_todos.txt |
| NotImplementedError/pass | 4,337 | 🔴 CRITICAL | rg_notimplemented.txt |
| Placeholders | 2,048 | 🟡 MEDIUM | rg_placeholders.txt |
| Import risks | 1,921 | 🟡 MEDIUM | rg_import_risks.txt |

## Next Actions

**BLOCKER (immediate):**
1. Inventory all TODOs in source (exclude venv)
2. Identify which NotImplementedError are intentional vs. dead code
3. Check: Are tests relying on stubs?

**HIGH (this sprint):**
1. Create GitHub Issues for top 20 TODOs
2. Mark stubs with expiration dates
3. Add linter rule to reject new NotImplementedError without JIRA

**MEDIUM (next quarter):**
1. Gradually resolve backlog of TODOs
2. Modernize import patterns (use ruff auto-fix)
3. Replace placeholder markers with real test fixtures
