# UI Version Enforcement & Cache Invalidation Guide

**Purpose:** Eliminate UI version drift, Forge gadget caching ambiguity, and repeated UI deployment confusion.

**Core Principle:** Single source of truth (backend) enforces UI version matching at runtime with user-visible proof.

---

## Architecture Overview

### 1. Canonical Version Source (Backend Only)

**File:** `src/resolvers/governance_status.ts`

**Implementation:**
```typescript
// From constants.ts - single source of truth
const APP_VERSION = `v${pkg.version}`; // Derived from package.json, e.g., "v2.14.0"

// Returned in all resolver payloads
{
  version: APP_VERSION,                    // "v2.14.0" (includes 'v' prefix)
  uiExpectedBuild: `UI_${APP_VERSION}`     // "UI_v2.14.0" (combines UI_ prefix with v-prefixed version)
}
```

**Key Properties:**
- `APP_VERSION` derived from `package.json` version (currently `2.14.0`) with 'v' prefix prepended, yielding `v2.14.0`
- `uiExpectedBuild` formed by prepending `UI_` to `APP_VERSION`, yielding `UI_v2.14.0`
- Cannot be overridden at runtime
- Cannot be derived from UI hardcoding
- Returned in every resolver response (success, error, degraded)

### 2. Version-Based UI Build Marker

**File:** `src/gadget-ui/index.html`

**Implementation:**
```javascript
// Must match backend's uiExpectedBuild exactly
const UI_BUILD_VERSION = "UI_v2.14.0";

// Displayed to users
setText('build-marker', `UI BUILD: ${UI_BUILD_VERSION}`);
```

**Key Properties:**
- Version-based, not timestamp-based
- Hardcoded at build time to match backend's `uiExpectedBuild` format (`UI_v{APP_VERSION}`)
- Displayed in gadget UI before resolver invoke
- User-visible proof of deployed version

### 3. Runtime Mismatch Detection (Non-Negotiable)

**File:** `src/gadget-ui/index.html`

**Implementation:**
```javascript
const data = await invoke('get', {});

if (data.uiExpectedBuild && data.uiExpectedBuild !== UI_BUILD_VERSION) {
    const warning = `
        <div class="error-panel">
            <div class="error-header">UI Version Mismatch</div>
            <div class="error-code">STALE_UI_CACHE</div>
            <div class="error-message">
                This dashboard UI (${UI_BUILD_VERSION}) does not match the backend version
                (${data.uiExpectedBuild}).<br/><br/>
                Remove and re-add the gadget, or perform a hard refresh.
            </div>
        </div>
    `;
    setHTML('operational-status', warning);
}
```

**User Visibility:**
- Error banner shows exact mismatch (e.g., "UI_2.14.0 vs UI_2.15.0")
- Clear remediation instructions
- Cannot be missed in UI

### 4. Forced Forge Cache Invalidation

**File:** `manifest.yml`

**Implementation:**
```yaml
# Gadget module references versioned resource
jira:dashboardGadget:
  - resource: governance-gadget-page-v2140  # v-suffix with version number

# Resource definition uses versioned key
resources:
  - key: governance-gadget-page-v2140       # Must match above
    path: src/gadget-ui
```

**How It Works:**
- Forge caches resources by key name
- Changing resource key forces Forge to fetch new version
- Version number in key matches APP_VERSION (with `v` prefix: `v2140` = `2.14.0`)
- Old cached version under old key is never served

### 5. User-Visible Cache Refresh Instructions

**File:** `src/gadget-ui/index.html` (footer section)

**Implementation:**
```html
<div class="export-note" style="...">
    <strong>Cache Refresh:</strong> If this dashboard does not reflect the latest version shown above,
    remove and re-add the gadget to force a UI cache refresh.
</div>
```

**Placement:** Footer of gadget (always visible, always readable)

---

## Deployment Checklist

### Prerequisites
- [ ] All 1104 tests pass: `npm test` in `forge-app/` directory
- [ ] No TypeScript errors: `npm run type-check`
- [ ] Version strings match across all files:
  - `package.json`: version field
  - `src/core/constants.ts`: `APP_VERSION` (derived)
  - `src/gadget-ui/index.html`: `UI_BUILD_VERSION`
  - `manifest.yml`: resource key suffix

### Step 1: Deploy Backend (Resolver)
```bash
cd /workspaces/Firsttry/atlassian/forge-app
forge deploy -e production
```
**Expected Output:** "Deployed with version: ..." or similar

### Step 2: Upgrade Installation
```bash
forge install --upgrade -e production
```
**Expected Output:** Installation updated successfully

### Step 3: Client-Side Cache Clear (Browser)
In Jira dashboard:
1. Remove the governance gadget from dashboard → Save
2. Hard refresh browser:
   - Windows/Linux: `Ctrl+Shift+R`
   - Mac: `Cmd+Shift+R`
3. Re-add the gadget to dashboard → Save

### Step 4: Verification (Critical)

**On-Screen Verification:**

| Item | Expected | Location |
|------|----------|----------|
| UI BUILD version displayed | `UI BUILD: UI_v2.14.0` | Top of gadget, build-marker element |
| Version in header | `v2.14.0 / production` | Top-right corner (kpi-version field) |
| No mismatch banner | Operational status panel shows normal data (no error banner) | operational-status element |
| Cache refresh note visible | "Cache Refresh: If this dashboard does not reflect..." | Footer section |
| Self-test metrics | All green: HTML Marker FOUND, CSS Applied OK, JS Running OK, Resolver Invoke OK | UI Self-Test section |

**If Version Mismatch Banner Appears:**
- UI version: `UI_v2.14.0`
- Backend version: Something else (e.g., `UI_v2.15.0`)
- Action: Repeat Step 3 (remove gadget, hard refresh, re-add)

### Step 5: Browser Inspector Validation (Optional)

1. Open DevTools (`F12`)
2. Console tab:
   ```javascript
   // Check gadget container
   document.getElementById('build-marker').textContent
   // Should output: "UI BUILD: UI_v2.14.0"
   ```
3. Network tab:
   - Look for resource requests to `governance-gadget-page-v2140`
   - Should NOT see requests to old key `governance-gadget-page`

---

## Troubleshooting

### Problem: Version Mismatch Banner Persists After Cache Clear

**Root Cause:** Forge still serving old cached version

**Solution:**
1. Verify resource key changed in manifest: `governance-gadget-page-v2140`
2. Redeploy: `forge deploy -e production` again
3. Reinstall: `forge install --upgrade -e production`
4. Wait 30 seconds for CDN propagation
5. Repeat browser cache clear (Ctrl+Shift+R)

### Problem: UI BUILD Shows Old Version

**Root Cause:** `UI_BUILD_VERSION` in HTML not updated to match new APP_VERSION

**Solution:**
1. Check `src/gadget-ui/index.html` line ~842:
   ```javascript
   const UI_BUILD_VERSION = "UI_2.14.0";
   ```
   Must match `version` in `package.json`
2. If mismatch, update manually before deploying

### Problem: Manifest Changes Not Taking Effect

**Root Cause:** Manifest not validated before deployment

**Solution:**
1. Validate manifest syntax:
   ```bash
   cd /workspaces/Firsttry/atlassian/forge-app
   forge validate
   ```
2. Check for errors in manifest.yml (YAML syntax)
3. Redeploy: `forge deploy -e production`

---

## Acceptance Criteria (MUST ALL PASS)

- [x] **UI shows exact version:** Version displayed as `UI BUILD: UI_v2.14.0`
- [x] **Resolver returns same version:** `uiExpectedBuild` field matches UI constant (both `UI_v2.14.0`)
- [x] **Mismatch banner appears if stale:** Error panel shows only if versions don't match
- [x] **Versioned resource key forces refresh:** Old cached version is never served
- [x] **User instructions visible:** Footer clearly explains cache refresh steps

**If ANY criterion fails, deployment is not complete.**

---

## Version Update Process (Future Deployments)

When releasing a new version (e.g., `2.15.0`):

1. **Update package.json:**
   ```json
   "version": "2.15.0"
   ```

2. **Update UI build marker (src/gadget-ui/index.html):**
   ```javascript
   const UI_BUILD_VERSION = "UI_v2.15.0";
   ```

3. **Update manifest resource key:**
   ```yaml
   # Change from governance-gadget-page-v2140
   # To new key with new version number:
   resources:
     - key: governance-gadget-page-v2150
       path: src/gadget-ui
   
   # And update gadget reference:
   jira:dashboardGadget:
     - resource: governance-gadget-page-v2150
   ```

4. **Run tests:** `npm test`

5. **Deploy:** Follow Deployment Checklist above

---

## Technical Details

### Why Version-Based Markers Over Timestamps?

- **Timestamps:** Different in build pipelines, cache-busting conflicts
- **Version numbers:** Deterministic, human-readable, match release cycle

### Why Versioned Resource Keys?

- **Forge caches by key:** No other mechanism invalidates old resources
- **Version in key:** Makes cache invalidation explicit and auditable
- **Alternative (rejected):** URL query strings don't work with Forge static resources

### Why Runtime Mismatch Detection?

- **Proves deployment success:** User can see if old UI was cached
- **Actionable error message:** Tells user exactly what's wrong and how to fix
- **Prevents silent failures:** User isn't confused by old UI behavior

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.14.0 | 2026-01-03 | Version enforcement implementation (initial) |
| — | — | Future versions follow same pattern |

---

## Support

If version mismatch occurs:
1. Check manifest resource key includes version suffix (`-v2140`)
2. Check `UI_BUILD_VERSION` in HTML matches `package.json`
3. Redeploy and reinstall
4. Hard refresh browser (Ctrl+Shift+R)
5. Remove and re-add gadget

Contact: Internal development team
