# CSP Violation Reproduction Steps

**Issue:** "Applying inline style violates Content Security Policy directive style-src"

## Steps to Reproduce

1. Open Jira at https://firsttry.atlassian.net/jira
2. Navigate to a dashboard with the "Governance Status" gadget
3. Open Developer Console (F12 or Right-click → Inspect)
4. Switch to **Console** tab
5. Look for messages containing:
   - "Applying inline style violates Content Security Policy"
   - "style-src"

## Expected CSP Error

```
Refused to apply inline style because it violates the following Content Security Policy directive: "style-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com" — while the 'unsafe-inline' keyword is not specified, either the 'unsafe-inline' keyword, a hash ('sha256-...'), or a nonce ('nonce-...') is required to enable inline execution.
```

## Root Cause Categories

This audit will identify:
1. ✅ Inline `style="..."` attributes in HTML/JSX
2. ✅ React `style={{...}}` inline styles
3. ✅ Runtime `.style.*` DOM mutations
4. ✅ `<style>` tag creation/injection
5. ✅ CSS-in-JS libraries (emotion, styled-components, MUI, Chakra, AntD)

## Gadget Location

- **Gadget UI source:** `src/gadget-ui/src/`
- **Gadget UI build output:** `src/gadget-ui/dist/`
- **Entry point:** `src/gadget-ui/src/main.ts`

---

**Audit Date:** 2026-01-18  
**Status:** Reproduction documented
