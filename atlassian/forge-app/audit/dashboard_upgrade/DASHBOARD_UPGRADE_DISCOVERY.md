# Dashboard Upgrade — Discovery Phase Complete

## Project Scope
Upgrade FirstTry governance dashboard to premium enterprise UX with:
- Unified status model (backend-owned) with reason_code enums
- KPI tile layout (2x4) above the fold
- reason_code-driven banner (yellow/red only)
- Phase progress tracker (replaces phase table as primary)
- Export consistency (single source of truth + manual copy always)
- Accessibility-safe status rendering (not color-only)

## PHASE 0 — PRE-FLIGHT ✅ COMPLETE

### Environment
- **Node**: v20.19.6
- **npm**: 10.8.2
- **Forge CLI**: 12.12.0 (available)
- **App Version**: 2.14.0
- **Repo State**: Clean (only untracked audit artifacts)

### Evidence Files
- `OUT/00_repo_state.txt` — Commit hash 424d55a0
- `OUT/00_node_versions.txt` — Node v20, npm 10
- `OUT/00_package_json.txt` — Captured dependencies
- `OUT/00_forge_version.txt` — Forge CLI 12.12.0

---

## PHASE 1 — UI DETECTION ✅ COMPLETE

### Architecture Detected
- **UI Type**: Custom UI (NOT UI Kit v2)
- **Proof**: manifest.yml has `resources:` section with key `govGadget2140` → `src/gadget-ui/dist`
- **Gadget Module**: `jira:dashboardGadget` with resolver function

### Critical Paths Identified (DETERMINISTIC)

| Item | Path | Confidence |
|------|------|-----------|
| **Resolver** | `src/resolvers/governance_status.ts` (666 lines) | HIGHEST (named in manifest as `status-resolver-fn`, governance status comment at line 646) |
| **UI Entry** | `src/gadget-ui/index.html` | HIGHEST (score 29; contains heading "FirstTry Governance Status") |
| **UI Main Logic** | `src/gadget-ui/src/main.ts` (250+ lines) | HIGH (React/TypeScript, invokes resolver, renders status) |

### UI Stack Discovery
- **Resource**: Bundled static UI via Vite (src/gadget-ui/dist)
- **Frontend**: Custom JavaScript (NOT @forge/react or @forge/ui; those are only in comments as production-only)
- **Build System**: npm `build:gadget` script invokes Vite (cd src/gadget-ui && npm install && npm run build)

### Evidence Files
- `OUT/01_manifest_path.txt` — manifest.yml confirmed
- `OUT/01_manifest_contents.txt` — Full manifest (79 lines)
- `OUT/01_rg_governance_heading.txt` — 14 matches (UI entry + audit references)
- `OUT/01_rg_resolver_candidates.txt` — 30 mentions, clearly narrowing to governance_status.ts
- `OUT/01_resolver_selection.txt` — 24 candidates scored; `src/resolvers/governance_status.ts` is PRIMARY
- `OUT/01_ui_entry_final.txt` — `src/gadget-ui/index.html` scores 29/29 (clear winner)
- `OUT/01_paths_final.txt` — Final deterministic selection

---

## Next Steps (PHASES 2-8)

### PHASE 2: Unified Status Model (Backend Contract)
**Location**: Create `src/core/unified_status_model.ts`

**Scope**:
- Define TypeScript enums: `StatusColor`, `ReasonCode`, `SubsystemKey`
- Define interfaces: `SubsystemStatus`, `UnifiedGovernanceStatus`
- Implement `computeOverallBadge(subsystems)` deterministically
- Implement `validateNoContradictions(unifiedStatus)` guard
- **Tests**: Create `tests/unit/unified_status_model.test.ts` (Vitest)

**Key Enums** (ReasonCode):
```
OK, INITIALIZING_NO_DATA, SCHEDULER_NOT_FIRING, SCHEDULER_DELAYED,
WAITING_ON_PHASE_DEPENDENCY, PERMISSION_DENIED, RATE_LIMITED,
STORAGE_ERROR, JIRA_API_ERROR, EXPORT_BLOCKED, EXPORT_PENDING, UNKNOWN_ERROR
```

**Key Subsystems**:
```
overall, ui_surface, scheduler, snapshot_ingestion, phase4_evidence,
phase5_trust_report, export, storage, permissions, tenant_identity
```

### PHASE 3: Resolver Update
**File**: `src/resolvers/governance_status.ts`

**Scope**:
- Import unified model types
- Build `unifiedStatus` payload using existing signals (tenant, permissions, storage, phase-4/5 status, export readiness)
- Add at top-level: `{ ...existingFields, unifiedStatus }`
- Ensure NO contradictions (validate contract)
- Update tests/fixtures that consume response

### PHASE 4: UI Components (Custom UI Stack)
**Base Dir**: `src/gadget-ui/src/`

**Create**:
1. `statusBadge.ts` — Render helpers:
   - `getStatusIcon(color)` → icon element
   - `getStatusLabel(color)` → "Healthy" / "Degraded" / "Failing" / "Initializing"
   - `getAriaLabel({label,message,reasonCode})` → accessible description

2. `KpiTiles.ts` — Component:
   - 8 tiles (2x4 grid) at TOP of page
   - Each: status pill + icon + label + value + aria-label
   - Data source: `unifiedStatus` fields

3. `StatusBanner.ts` — Component:
   - Render ONLY when overall.badge.color is yellow or red
   - Display: message, impact, recommendedAction, reasonCode, timestamps
   - role="status", aria-live="polite"
   - Colored (yellow/red) but also has icon + text (NOT color-only)

4. `ProgressTracker.ts` — Component:
   - Uses `unifiedStatus.phases[]`
   - Each phase: icon + label + short message + lastRunAt
   - Replaces old phase table as PRIMARY view

**Accessibility Rule** (R6):
> Every colored status must ALSO have:
> - Icon (✓)
> - Text label (✓)
> - Accessible description (aria-label or role="status") (✓)
> NOT color-only rendering

### PHASE 5: Export Consistency
**File**: Update `src/gadget-ui/src/main.ts` export area

**Scope**:
- Replace any "Export unavailable" text with `unifiedStatus.export.message`
- Rules:
  - `isReady == true` → enable downloads
  - `isReady == false` → disable downloads, show why
  - Manual copy area ALWAYS present and functional

### PHASE 6: Build & Lint
**Commands**:
- `npm run build` (builds gadget if script exists)
- `forge lint` (if forge CLI available)
- `npm test` (Vitest)

---

## Risk Assessment

### Low Risk
- ✅ Custom UI (no UI Kit version conflicts)
- ✅ Forge CLI available for linting
- ✅ Test infrastructure exists (Vitest + vitest.config.ts)
- ✅ Build system exists (npm build:gadget script)

### Medium Risk
- ⚠️ Resolver is 666 lines; scope must be backward-compatible
- ⚠️ UI gadget has multiple integrations (main.ts, index.html); changes must not break existing rendering

### Mitigations
- All changes backward-compatible (add unifiedStatus, don't remove fields)
- Tests at each phase (HARD RULE R5)
- Deterministic path discovery (no assumptions)
- Evidence capture at each phase

---

## Success Criteria (Hard Rules)

- [ ] R0: All commands executed, outputs captured to `OUT/*.txt`
- [ ] R1: No placeholders; all paths discovered deterministically (✅ Done: RESOLVER_PATH and UI_ENTRY_PATH set)
- [ ] R2: No ambiguities; deterministic selection with stop condition (✅ Done: Clear scores)
- [ ] R3: UI type detected (✅ Done: Custom UI confirmed)
- [ ] R4: No new libraries (use existing Vite + TypeScript + Vitest stack)
- [ ] R5: `npm test PASS` + `build PASS` + `forge lint PASS` at each phase
- [ ] R6: No color-only statuses; all have icon+text+aria

---

## Timeline

- **PHASE 0**: ✅ Complete (1h)
- **PHASE 1**: ✅ Complete (30m)
- **PHASE 2**: 1h (model + tests)
- **PHASE 3**: 1h (resolver update + tests)
- **PHASE 4**: 2h (UI components + tests)
- **PHASE 5**: 1h (progress tracker)
- **PHASE 6**: 1h (export gating)
- **PHASE 7**: 30m (build + lint)
- **PHASE 8**: 30m (report + commit)

**Estimated Total**: 8 hours

---

## Proceeding to PHASE 2

Awaiting approval to proceed with:
1. Create unified status model (TypeScript types + helpers)
2. Unit tests (Vitest)
3. Resolver integration
4. UI components (accessibility-safe rendering)

All evidence will be captured in `OUT/` directory per Hard Rule R0.
