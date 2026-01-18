# PHASE 1: CSP Violation Audit Results

**Date:** 2026-01-18  
**Status:** ✅ Audit Complete - Major violations found

---

## Summary of Findings

### 🔴 CRITICAL: Inline Styles Found (CSP Violation)

**Count:** 90+ violations across files

**Files with inline styles:**
1. `src/gadget-ui/src/main.ts` - 60+ inline `style="..."` attributes in HTML template strings
2. `src/gadget-ui/src/enterprise/renderTrustSection.ts` - 4 inline `style="..."` in HTML
3. `src/gadget-ui/src/enterprise/renderStatusBanner.ts` - HTML construction
4. Other enterprise components using inline styles

**Example Violations:**
```typescript
// Line 202-204: main.ts
<div class="error-panel" style="background: #fff7d6; border: 1px solid #f5cd47; border-radius: 8px; padding: 16px; color: #7f5f01;">
  <div style="font-weight: 600; font-size: 14px;">CRITICAL: invoke() Not Available</div>
  <div style="margin-top: 8px; font-size: 12px;">...

// Line 530-531: main.ts
let metricsTableHtml = '<table class="config-visibility-table" style="width: 100%; border-collapse: collapse; border: 1px solid #dfe1e6;">';
metricsTableHtml += '<thead><tr style="background: #f5f6f7; border-bottom: 1px solid #dfe1e6;"><th style="...
```

### 🔴 CRITICAL: Runtime .style.* Mutations (CSP Violation)

**Count:** 50+ mutations

**Files affected:**
1. `src/gadget-ui/src/main.ts` - 40+ `.style.*` assignments
2. `src/gadget-ui/src/enterprise/renderTrustSection.ts` - 20+ `.style.*` assignments
3. `src/gadget-ui/src/enterprise/renderStatusBanner.ts` - 2 `.style.*` assignments
4. `src/gadget-ui/src/enterprise/applyExportPolicy.ts` - 6 `.style.*` assignments
5. `src/gadget-ui/src/enterprise/status.ts` - 1 `.style.*` assignment

**Example Violations:**
```typescript
// renderTrustSection.ts lines 12-26
section.style.background = '#ffffff';
section.style.border = '1px solid #dfe1e6';
section.style.borderRadius = '8px';
section.style.padding = '16px';
section.style.marginBottom = '16px';
section.style.boxShadow = '0 1px 1px rgba(9, 30, 66, 0.13)';

title.style.fontSize = '16px';
title.style.fontWeight = '600';
title.style.color = '#172b4d';
// ... and 20+ more
```

### ✅ GOOD: No CSS-in-JS Libraries

**Status:** No emotion, styled-components, MUI, Chakra, or AntD detected ✅

### ✅ GOOD: Static CSS Assets Built

**Status:** Build output has no injected `<style>` tags ✅

---

## Root Cause Analysis

### Why CSP Violations Occur

1. **Inline `style="..."` in HTML strings:** Template strings in TypeScript contain literal `style` attributes
   - Violates CSP `style-src 'self'` (only allows external stylesheets)
   - Cannot be fixed with `unsafe-inline` (security risk)

2. **Runtime `.style.*` mutations:** JavaScript directly assigns to element.style properties
   - Examples: `el.style.color = "#ae2a19"`, `container.style.display = "none"`
   - Violates CSP (dynamically applied inline styles)
   - Cannot be fixed with `unsafe-inline`

3. **No external stylesheet alternatives:** Styles are embedded in JavaScript logic
   - Not separated into `.css` files
   - Build tool (Vite) doesn't extract these as external assets

---

## Fix Strategy (PHASE 2)

### Approach: Static CSS + CSS Classes

1. **Create static CSS files** for all styling:
   - `src/gadget-ui/src/styles/main.css` - Main panel styles
   - `src/gadget-ui/src/styles/enterprise.css` - Enterprise section styles
   - `src/gadget-ui/src/styles/components.css` - Reusable components

2. **Move inline styles to CSS classes:**
   - Replace `style="color: red"` with `class="text-error"`
   - Replace `.style.display = "none"` with `classList.add("hidden")` / `classList.remove("hidden")`
   - Replace `.style.color = "#ae2a19"` with `classList.add("error-state")`

3. **Reference CSS in HTML:**
   - Add `<link rel="stylesheet" href="./styles/main.css">` to `index.html`
   - Ensure Vite build outputs external `.css` assets

4. **Use CSS classes for state management:**
   - `.hidden { display: none; }`
   - `.text-error { color: #ae2a19; }`
   - `.text-success { color: #216e4e; }`
   - `.disabled { opacity: 0.5; cursor: not-allowed; }`

---

## Affected Files (Must Fix)

| Priority | File | Violations | Fix Type |
|----------|------|-----------|----------|
| 🔴 CRITICAL | `src/gadget-ui/src/main.ts` | 60+ inline, 40+ .style.* | Extract to CSS |
| 🔴 CRITICAL | `src/gadget-ui/src/enterprise/renderTrustSection.ts` | 4 inline, 20+ .style.* | Extract to CSS |
| 🟡 HIGH | `src/gadget-ui/src/enterprise/renderStatusBanner.ts` | 2 .style.* | Use classes |
| 🟡 HIGH | `src/gadget-ui/src/enterprise/applyExportPolicy.ts` | 6 .style.* | Use classes |
| 🟡 HIGH | `src/gadget-ui/src/enterprise/status.ts` | 1 .style.* | Use classes |

---

## Audit Artifacts

```
✅ audit/csp_fix/10_inline_style_string_hits.txt - Inline style="..." violations
✅ audit/csp_fix/10_inline_style_object_hits.txt - Inline style={{...}} violations
✅ audit/csp_fix/11_dom_style_mutations.txt - .style.* mutations (50+ lines)
✅ audit/csp_fix/11_setAttribute_style.txt - setAttribute('style', ...) calls
✅ audit/csp_fix/12_style_injection.txt - <style> tag injection attempts
✅ audit/csp_fix/13_css_in_js_deps.txt - CSS-in-JS library check
✅ audit/csp_fix/14_css_link_tags.txt - External CSS references
✅ audit/csp_fix/15_dist_style_tags.txt - Build output check
```

---

## Next Steps

→ **PHASE 2:** Implement static CSS + class-based styling  
→ **PHASE 3:** Add regression checks (lint + tests)  
→ **PHASE 4:** Verify locally and run E2E tests  
→ **PHASE 5:** Commit changes
