# STG Badge Reality

## What is the STG Badge?

The "STG" badge that may appear in the Atlassian Forge UI is an **environment label added by Atlassian**, not part of the application code. It indicates that the app is installed from the **Forge Staging environment** (not the production environment).

## Why Can Code Not Remove It?

1. **Atlassian Rendering**: The STG badge is rendered by Atlassian's UI framework, not by our application code
2. **Environment-Level**: It's applied at the Forge installation level, before our app code even runs
3. **Chrome, Not Content**: The badge appears in the Atlassian "chrome" (header/frame), not in our dashboard content

## When Does It Disappear?

The STG badge disappears automatically when:
- The app is installed from the **Forge Production** environment instead of staging
- This is a deployment/installation configuration, not a code change

## Our Enforcement

What **we do enforce** in code:
1. ✅ No "STG" strings in our own UI code, manifest titles, or module names
2. ✅ No "STG" markers in production bundle artifacts
3. ✅ No "STG" or "Staging" in end-user-facing text or documentation

## Verification Gates

Build gates verify:
- `verify_no_stg_in_prod_artifacts.sh`: Scans manifest.yml and dist/ for "STG" strings
- Fails the build if found, protecting production integrity

## Summary

**Badge Reality**: Atlassian environment label (outside code control)  
**Badge Visibility**: Controlled by installation environment (not deployment code)  
**Code Responsibility**: Enforce no internal STG markers in our artifacts (✅ enforced)
