# EXTERNAL PRECHECK - Manual Browser Evidence Collection

**Purpose:** Determine if browser-level factors (CSP, network blocking, extensions, caching) are preventing gadget from loading or functioning.

**Time Required:** 10-15 minutes  
**Difficulty:** Low (copy/paste instructions)  
**Critical for:** G5 (BROWSER_CLEAN) gate completion

---

## Overview

This manual verification is **not** automated because:
- Browser console errors are specific to user's installation (extensions, corporate proxy, etc.)
- Network blocking decisions happen client-side (CSP, CORS, redirects)
- Cache behavior requires comparing two browser modes (normal vs incognito/private)
- Corporate/firewall restrictions may be in place

We'll collect evidence in **three modes** to isolate the issue:
1. **Normal mode** (with extensions, corporate settings)
2. **Incognito/Private mode** (no extensions, clean)
3. **Other browser** (optional, helps rule out browser-specific issues)

If gadget works in incognito but fails in normal → **extension/cache issue**  
If gadget fails in both → **CSP/network/infrastructure issue**

---

## STEP 1: Prepare Browser DevTools

Open your browser and open the gadget page:

**URL:** https://firsttry.atlassian.net/secure/Dashboard.jspa

**Actions:**
1. Hard reload the page: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. Wait 5 seconds for gadget to load
3. Open DevTools: `F12` or `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
4. Go to **Console** tab
5. **Right-click → "Save as"** to preserve console output (so you can copy it later)
6. **DON'T** close DevTools yet

---

## STEP 2: Collect Console Errors (NORMAL MODE)

**Browser Mode:** Normal (with extensions, cookies, proxy settings)

In the **Console** tab, look for error messages. Focus on:
- Lines containing: **CSP**, **blocked**, **refused**, **ERR_**, **forge**, **bridge**, **Content-Security-Policy**
- Any RED text (errors) or YELLOW text (warnings)

### 2a: Copy Console Errors

**Actions:**
1. Select all console output: `Ctrl+A`
2. Copy: `Ctrl+C`
3. Paste into a text editor (Notepad, VS Code, etc.)
4. **Save as:** `browser_console_normal.txt`
5. Focus on lines containing the keywords above, copy those to:
   - **`browser_console_errors_normal.txt`** (errors only)

**Example of what to look for:**
```
Refused to load the script 'https://example.com/bundle.js' because it violates the following Content-Security-Policy directive: "script-src 'self'"

Uncaught TypeError: Failed to fetch from resolver endpoint: bridge error
```

---

## STEP 3: Collect Network Failures (NORMAL MODE)

**Browser Mode:** Normal (same as STEP 2)

In **Network** tab:

**Actions:**
1. Click **Network** tab (next to Console)
2. If there's a **red circle** or **stop button**, click it to clear
3. **Disable cache** (checkbox in Network tab settings)
4. **Hard reload:** `Ctrl+Shift+R` or `Cmd+Shift+R`
5. Wait 10 seconds for gadget to load
6. Look for rows with a **RED X** or **status code 4xx or 5xx**

### 3a: Extract Failed Requests

For each failed request:
- Note the **URL**
- Note the **Status code** (e.g., 403, 404, 500)
- Check if it's related to:
  - Resolver endpoint (contains `/graphql`, `/invoke`, `/resolver`)
  - Asset (contains `.js`, `.css`, `.woff`)
  - API (contains `/api/`, `/jira/`, `/atlas-`)

**Save to:** `browser_network_errors_normal.txt`

**Example format:**
```
URL: https://firsttry.atlassian.net/jira/rest/api/latest/issue
Status: 403 Forbidden
Issue: Likely authentication or permission

URL: https://cdn.example.com/bundle-v1.js
Status: 504 Gateway Timeout
Issue: External CDN unavailable
```

---

## STEP 4: Get Build SHA (NORMAL MODE)

The gadget footer may show a build SHA (used to detect cache mismatches).

**Actions:**
1. Look at the **bottom-right of the gadget** (if visible)
2. Look for text like: `Build: abc123de`, `SHA: ...`, `v2.0.0`, or similar
3. Copy this text exactly

**Save to:** `browser_build_sha_normal.txt`

---

## STEP 5: Repeat in INCOGNITO/PRIVATE Mode

**Browser Mode:** Incognito (Windows/Linux: `Ctrl+Shift+N`) or Private (Mac: `Cmd+Shift+N`)

**Key difference:** No extensions, no cached cookies, clean start

**Actions:**
1. Go to: https://firsttry.atlassian.net
2. **Log in** (if required)
3. Navigate to dashboard gadget
4. Hard reload: `Ctrl+Shift+R` / `Cmd+Shift+R`
5. Open DevTools again: `F12` / `Cmd+Option+I`
6. **Repeat STEPS 2-4** (console errors, network failures, build SHA)

**Save to:**
- `browser_console_errors_incognito.txt`
- `browser_network_errors_incognito.txt`
- `browser_build_sha_incognito.txt`

---

## STEP 6: Compare Across Modes

### 6a: Analysis

After collecting evidence from both normal and incognito:

| Finding | Interpretation | Action |
|---------|-----------------|--------|
| **Errors in normal, NONE in incognito** | Browser extension or cache interference | Disable extensions and re-test |
| **SAME errors in both** | CSP violation or network/infrastructure issue | External blocker confirmed |
| **Different build SHAs** | Stale cache being served | Clear browser cache and re-test |
| **Gadget loads normally but is empty/broken** | Business logic issue (likely BACKBONE) | Proceed to BACKBONE diagnostics |
| **Gadget loads and works** | No external issues detected | All external factors cleared |

### 6b: Save Comparison

Create file: `browser_comparison.txt`

```
=== NORMAL MODE ===
Build SHA: [paste from normal]
Console errors: [count]
Network failures: [count]

=== INCOGNITO MODE ===
Build SHA: [paste from incognito]
Console errors: [count]
Network failures: [count]

=== COMPARISON ===
Build SHA matches: YES / NO
Errors present in both: YES / NO
Gadget loads successfully: YES / NO / PARTIAL

=== CONCLUSION ===
[One of:]
- Browser extension/cache issue (works in incognito but not normal)
- Network/CSP blocking (fails in both modes)
- External infrastructure issue (inconsistent failures)
- No external issues detected (proceed to BACKBONE)
```

---

## STEP 7: Optional - Test in Another Browser

If possible, repeat STEP 2-4 in a different browser (e.g., Chrome vs Firefox) to rule out browser-specific issues.

**Save to:**
- `browser_console_errors_firefox.txt` (or other browser name)
- `browser_network_errors_firefox.txt`
- `browser_build_sha_firefox.txt`

---

## STEP 8: Aggregate Results

Create a final file: **`browser_evidence_summary.txt`** with all findings:

```
================================================================================
BROWSER EVIDENCE COLLECTION - SUMMARY
================================================================================

Timestamp: [today's date and time]
User: [your name or ID]
Browser(s) tested: [Chrome/Firefox/Safari versions]
OS: [Windows 10 / Mac M1 / Linux]
Corporate network: YES / NO
Extensions enabled: YES / NO (if yes, list them)

================================================================================
RESULTS
================================================================================

NORMAL MODE:
  - Console errors: [Y/N, if Y list top 3]
  - Network failures: [Y/N, if Y list top 3]
  - Build SHA: [paste or "not visible"]
  - Gadget renders: [FAILS / PARTIAL / WORKS]

INCOGNITO MODE:
  - Console errors: [Y/N, if Y list top 3]
  - Network failures: [Y/N, if Y list top 3]
  - Build SHA: [paste or "not visible"]
  - Gadget renders: [FAILS / PARTIAL / WORKS]

OTHER BROWSER (if tested):
  - Browser: [name + version]
  - Gadget renders: [FAILS / PARTIAL / WORKS]
  - Same errors as normal mode: YES / NO

================================================================================
ANALYSIS
================================================================================

Error pattern:
  [ ] Errors in normal + errors in incognito → CSP/Network/Infrastructure
  [ ] Errors in normal ONLY → Browser extension / Cache issue
  [ ] Errors in incognito ONLY → Unlikely but possible
  [ ] No errors anywhere → Proceed to BACKBONE diagnostics

Root cause hypothesis:
  [Your best guess based on evidence above]

Recommended action:
  [What should be done next]

================================================================================
EVIDENCE FILES ATTACHED
================================================================================

Paste the following files into your response:

1. browser_console_errors_normal.txt
2. browser_network_errors_normal.txt
3. browser_console_errors_incognito.txt
4. browser_network_errors_incognito.txt
5. browser_comparison.txt
6. browser_evidence_summary.txt
7. (Optional) browser_console_errors_firefox.txt, etc.

================================================================================
```

---

## Template: Copy and Fill

Below is a ready-to-use template. Copy this section, fill it out, and provide as your response:

---

```
================================================================================
BROWSER EVIDENCE - USER SUBMISSION
================================================================================

USER INFO
---------
Timestamp: ___________________________
Name/ID: ___________________________
Browser: Chrome [ ] Firefox [ ] Safari [ ] Edge [ ] Other: _______
Browser Version: ___________________________
OS: Windows [ ] Mac [ ] Linux [ ]
Corporate network/Proxy: YES [ ] NO [ ]
Browser extensions installed: YES [ ] NO [ ]  If yes, list: ___________________

NORMAL MODE RESULTS
-------------------
Gadget page loads: YES [ ] NO [ ] PARTIAL [ ]
Console errors (filtered for CSP/blocked/forge): 
[PASTE CONSOLE TEXT HERE]

Network tab failures (4xx/5xx):
[PASTE NETWORK FAILURES HERE]

Build SHA visible: ___________________________

INCOGNITO MODE RESULTS
----------------------
Gadget page loads: YES [ ] NO [ ] PARTIAL [ ]
Console errors (filtered for CSP/blocked/forge):
[PASTE CONSOLE TEXT HERE]

Network tab failures (4xx/5xx):
[PASTE NETWORK FAILURES HERE]

Build SHA visible: ___________________________

COMPARISON
----------
Build SHAs match: YES [ ] NO [ ]
Console errors appear in: BOTH [ ] NORMAL ONLY [ ] INCOGNITO ONLY [ ] NEITHER [ ]
Network failures appear in: BOTH [ ] NORMAL ONLY [ ] INCOGNITO ONLY [ ] NEITHER [ ]

CONCLUSION
----------
Based on the evidence, the most likely issue is:
[ ] Browser extension/cache (works in incognito, fails in normal)
[ ] CSP or network blocking (fails in both modes)
[ ] Stale cache (different SHAs between modes)
[ ] Gadget logic issue / BACKBONE (no network/CSP errors, but gadget not working)
[ ] No issues detected (proceed to BACKBONE diagnostics)

Additional observations:
[Any other notes about the gadget behavior, error messages, or system state]

SCREENSHOTS (OPTIONAL)
----------------------
[Attach screenshots of console errors or network failures]
```

---

## Common Issues and What They Mean

| Error | Meaning | Next Action |
|-------|---------|-------------|
| `Refused to load the script ... Content-Security-Policy` | Browser blocked asset due to CSP | This is G3/CSP blocker. Contact Atlassian. |
| `Failed to fetch ... 403 Forbidden` | Authentication/permission issue | Check Jira permissions. May be org/role issue. |
| `Failed to fetch ... 504 Gateway Timeout` | Server/CDN unreachable | Infrastructure issue. Wait or contact support. |
| `TypeError: window.location is undefined` | Browser extension interfering with window object | Disable extensions and re-test. |
| `Gadget renders but shows "No data"` | UI working, backend not responding | Likely BACKBONE issue, not external factor. |
| `Gadget doesn't appear on dashboard at all` | Gadget UI failed to load completely | CSP blocking or network issue likely. |

---

## Troubleshooting

**Q: I don't see a Console tab in DevTools**  
A: You may have a different tab open. Look for "Console", "Network", "Elements" tabs. If still stuck, press `Ctrl+Shift+J` (Windows/Linux) or `Cmd+Option+J` (Mac) to open Console directly.

**Q: Console is empty**  
A: That's OK. It means no errors were logged. Note: "Console is empty" as your evidence.

**Q: How do I copy from Network tab?**  
A: Right-click on a failed request → "Copy as cURL" or "Copy response headers". Or just note the URL and status code manually.

**Q: What if the gadget works fine?**  
A: Perfect! Note "No errors, gadget loads and functions normally" in your evidence. This means external factors are not the issue; proceed to BACKBONE diagnostics.

**Q: Corporate proxy may be blocking things. How do I know?**  
A: If errors mention domain names that are NOT firsttry.atlassian.net, it's likely external resource blocking (CDN, API). Check with your IT/security team.

---

## When You're Done

1. Fill out the template above
2. Attach or paste all evidence files
3. Return this summary to the BACKBONE investigation team
4. They will update Gate G5 result and finalize EXTERNAL_PRECHECK_RESULT.md

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-18
