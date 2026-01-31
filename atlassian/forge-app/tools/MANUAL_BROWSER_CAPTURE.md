# Manual Browser Event Capture Instructions

## Objective
Capture the three deterministic event buffers from the browser console after reproducing test scenario.

---

## Step 1: Open Dashboard in Browser

1. Navigate to your Jira instance (staging or production)
2. Open a dashboard that contains the **"FirstTry – Governance Status"** Forge gadget
3. Observe the gadget loads and renders without errors

---

## Step 2: Open Browser DevTools Console

**Chrome/Edge**:
- Press `F12`
- Click "Console" tab

**Firefox**:
- Press `F12`
- Click "Console" tab

**Safari**:
- Go to Develop menu → Show Web Inspector
- Click "Console" tab

---

## Step 3: Export CSP Events (if any occurred)

In the DevTools Console, paste and run:

```javascript
copy(JSON.stringify(window.__FT_CSP_VIOLATIONS || [], null, 2))
```

This will copy the array to your clipboard. Paste into a file:

```
csp_violations.json
```

**Format Expected**:
```json
[
  {
    "marker": "UI_CSP_VIOLATION_EVENT",
    "violatedDirective": "style-src",
    "blockedURI": "inline",
    "sourceFile": "app.30a2bfb...js",
    "lineNumber": 123,
    "ts": "2026-01-31T..."
  }
]
```

---

## Step 4: Export UI Errors (if any occurred)

In the DevTools Console, paste and run:

```javascript
copy(JSON.stringify(window.__FT_UI_ERRORS || [], null, 2))
```

Paste into a file:

```
ui_errors.json
```

**Format Expected**:
```json
[
  {
    "marker": "UI_ERROR_EVENT",
    "type": "error",
    "message": "SyntaxError: Unexpected token",
    "filename": "app.30a2bfb...js",
    "lineno": 456,
    "stack": "...",
    "ts": "2026-01-31T..."
  }
]
```

---

## Step 5: Export Correlation ID

In the DevTools Console, paste and run:

```javascript
copy(JSON.stringify({ correlationId: window.__FT_CORRELATION_ID || null }, null, 2))
```

Paste into a file:

```
correlation.json
```

**Format Expected**:
```json
{
  "correlationId": "correlation_1738329000123_abc123def456"
}
```

---

## Step 6: Verify All Buffers Initialized

If any of the buffers are `undefined`, it indicates a bootstrap failure:

| Buffer | If Missing | Action |
|--------|-----------|--------|
| `window.__FT_CSP_VIOLATIONS` | Not initialized | Check browser console for `[UI_ERROR_CAPTURE_READY]` marker |
| `window.__FT_UI_ERRORS` | Not initialized | Check browser console for `[UI_ERROR_CAPTURE_READY]` marker |
| `window.__FT_CORRELATION_ID` | Missing or null | Check browser console for `[UI_CORRELATION_ID]` marker |

---

## Step 7: Fail-Closed Policy

✅ **ALWAYS verify** before making any claims:

1. If `__FT_UI_ERRORS` is undefined:
   - **STOP**: Bootstrap wiring failed
   - Check console for `[UI_ERROR_CAPTURE_BOOT] ok`

2. If `correlationId` is null:
   - **STOP**: Step 3 correlation setup failed
   - Check console for `[UI_CORRELATION_ID]` marker

3. If CSP events have `sourceFile="unknown"`:
   - Document as "unable to determine source"
   - Do NOT claim "not our code" without evidence

4. If CSP events have `sourceFile` containing our app bundle hash:
   - **BUG FOUND**: Document location and fix required

---

## Step 8: Submit Evidence Files

Place the three JSON files in:

```
$RUN_DIR/browser/
  ├── csp_violations.json
  ├── ui_errors.json
  └── correlation.json
```

These files will be part of the complete evidence pack for Marketplace review.

---

## Troubleshooting

### No CSP events captured
- CSP violations may not occur on all dashboards
- Try different dashboards with more complex UI
- Check if CSP policy is even enforced in your environment

### No UI errors captured
- This is normal if the gadget is working correctly
- Only errors that occur will be captured

### CorrelationId is null
- Indicates bootstrap failure
- Check browser console logs for initialization errors
- Try a hard-refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)

### Can't find __FT_* buffers
- Try hard-refresh: `Ctrl+Shift+R`
- Check console filter level is set to show all messages
- Look for markers: `[UI_ERROR_CAPTURE_BOOT]`, `[UI_CORRELATION_ID]`, `[UI_CSP_VIOLATION_EVENT]`

---

## DevTools Console Filter Settings

Ensure console settings are correct:

1. **Level**: All (show all message types)
2. **Preserve Log**: ✓ Enabled (keep logs across navigation)
3. **Group Similar**: (unchecked preferred, but not critical)

---

## Success Criteria

All three commands execute successfully and return:
- ✅ `__FT_CSP_VIOLATIONS`: array (may be empty)
- ✅ `__FT_UI_ERRORS`: array (may be empty)  
- ✅ `__FT_CORRELATION_ID`: string matching pattern `correlation_*_*`

If all three are populated and exportable, the evidence pack is **READY** for Marketplace review.
