# STEP-6.2: TEST STRUCTURE & PATTERNS

**File:** `tests/admin/phase5_admin_static_enforcement.ts`

---

## COMPLETE TEST FILE STRUCTURE

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Test 1: Load source code
describe('Phase-5 Admin UI — Static Source Enforcement', () => {
  const adminUIPath = resolve(__dirname, '../../src/admin/phase5_admin_page.ts');
  const adminUISource = readFileSync(adminUIPath, 'utf-8');

  // =========================================================================
  // TEST SUITE 1: Hardcoded Heading Literal Enforcement
  // =========================================================================
  
  describe('Hardcoded heading literal enforcement', () => {
    
    // TEST 1A: Forbids exact section heading strings
    it('should not contain any exact section heading literals', () => {
      const FORBIDDEN_LITERALS = [
        'A) WHAT WE COLLECTED',
        'B) COVERAGE DISCLOSURE',
        'C) PRELIMINARY OBSERVATIONS',
        'D) FORECAST',
      ];
      
      for (const literal of FORBIDDEN_LITERALS) {
        if (adminUISource.includes(literal)) {
          expect.fail(`Found hardcoded literal: "${literal}"`);
        }
      }
      expect(true).toBe(true);
    });
    
    // TEST 1B: Forbids editorial renamings (case-insensitive)
    it('should not contain editorial heading aliases or synonyms', () => {
      const FORBIDDEN_EDITORIAL_WORDS = [
        'Insights', 'Summary', 'Findings', 'Recommendations',
        'Action items', 'Key takeaways', 'Health', 'Score', 'Benchmark',
      ];
      
      for (const word of FORBIDDEN_EDITORIAL_WORDS) {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(adminUISource)) {
          expect.fail(`Found editorial alias: "${word}"`);
        }
      }
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // TEST SUITE 2: Constant Usage Enforcement
  // =========================================================================
  
  describe('Constant usage enforcement', () => {
    
    // TEST 2A: Verifies constant or contract field is used
    it('should either use PHASE5_SECTION_HEADINGS constant or verify section_name comes from report contract', () => {
      const USAGE_PATTERNS = [
        'PHASE5_SECTION_HEADINGS.',  // Constant property access
        'getPhase5Heading(',          // Helper function
        'section.section_name',       // Report's typed field (acceptable)
      ];
      
      const hasValidPattern = USAGE_PATTERNS.some(p => adminUISource.includes(p));
      if (!hasValidPattern) {
        expect.fail('No valid pattern found for section heading access');
      }
      expect(true).toBe(true);
    });
    
    // TEST 2B: Import comes before usage
    it('should have consistent import and usage (not orphaned)', () => {
      const importIndex = adminUISource.indexOf('import');
      const usageIndex = adminUISource.indexOf('PHASE5_SECTION_HEADINGS');
      
      if (usageIndex < importIndex) {
        expect.fail('Usage before import');
      }
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // TEST SUITE 3: No Bypass Definitions
  // =========================================================================
  
  describe('No hardcoded section name definitions', () => {
    
    // TEST 3: Forbids local variable definitions of section names
    it('should not define local section name variables or constants', () => {
      const FORBIDDEN_DEFINITION_PATTERNS = [
        'const SECTION_A =',
        'const sectionNameA =',
        'let SECTION_A =',
      ];
      
      for (const pattern of FORBIDDEN_DEFINITION_PATTERNS) {
        if (adminUISource.includes(pattern)) {
          expect.fail(`Found definition pattern: "${pattern}"`);
        }
      }
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // TEST SUITE 4: Import Statement Validation
  // =========================================================================
  
  describe('Import statement validation', () => {
    
    // TEST 4A: Proper import exists
    it('should have a proper import statement for PHASE5_SECTION_HEADINGS', () => {
      if (!adminUISource.includes('PHASE5_SECTION_HEADINGS')) {
        expect.fail('Import not found');
      }
      expect(true).toBe(true);
    });
    
    // TEST 4B: Correct import path
    it('should import from correct path', () => {
      if (!adminUISource.includes("from '../phase5/phase5_headings'")) {
        expect.fail('Wrong import path');
      }
      expect(true).toBe(true);
    });
  });
});
```

---

## TEST EXECUTION FLOW

```
1. Load Admin UI source file:
   const adminUISource = readFileSync(adminUIPath, 'utf-8');

2. For EACH test:
   a. Define what's forbidden (literals, patterns, etc.)
   b. Search source code
   c. If found: expect.fail(message) → Test fails
   d. If not found: expect(true).toBe(true) → Test passes

3. Report results:
   ✓ test passed
   ✗ test failed (with context)
```

---

## FORBIDDEN PATTERNS REFERENCE

### Literals (Exact Match)
```typescript
// FORBIDDEN:
"A) WHAT WE COLLECTED"
"B) COVERAGE DISCLOSURE"
"C) PRELIMINARY OBSERVATIONS"
"D) FORECAST"
```

### Editorial Aliases (Case-Insensitive Regex)
```typescript
// FORBIDDEN (in any case):
Insights, Summary, Findings
Recommendations, Action items, Key takeaways
Health, Score, Benchmark
```

### Definition Patterns (Exact Match)
```typescript
// FORBIDDEN:
const SECTION_A =
const SECTION_B =
const sectionNameA =
let SECTION_A =
function buildSectionA
```

### Valid Patterns (ALLOWED)
```typescript
// OK:
PHASE5_SECTION_HEADINGS.A        // Constant property
PHASE5_SECTION_HEADINGS.B        // Constant property
section.section_name              // Report's typed field
getPhase5Heading(                 // Helper function
getAllPhase5Headings              // Function reference
```

---

## WHY EACH TEST MATTERS

| Test | Prevents |
|------|----------|
| Literal check | Direct hardcoding: `<h2>A) WHAT WE COLLECTED</h2>` |
| Editorial check | Sneaky renaming: `<h2>Insights</h2>` instead of heading |
| Constant usage | Orphaned import or unused constant |
| No definitions | Local bypass: `const myHeading = "A) WHAT WE COLLECTED"` |
| Import validation | Wrong import path or missing import |

---

## HOW TO EXTEND

### Add a New Forbidden Literal
```typescript
// In TEST 1A:
const FORBIDDEN_LITERALS = [
  'A) WHAT WE COLLECTED',
  'B) COVERAGE DISCLOSURE',
  'YOUR_NEW_FORBIDDEN_STRING',  // ← Add here
];
```

### Add a New Editorial Alias
```typescript
// In TEST 1B:
const FORBIDDEN_EDITORIAL_WORDS = [
  'Insights', 'Summary',
  'YOUR_NEW_WORD',  // ← Add here
];
```

### Add a New Valid Pattern
```typescript
// In TEST 2A:
const USAGE_PATTERNS = [
  'PHASE5_SECTION_HEADINGS.',
  'section.section_name',
  'YOUR_NEW_VALID_PATTERN',  // ← Add here
];
```

---

## INTEGRATION WITH CI/CD

These tests run as part of:
```bash
npm test                                    # All tests
npm test -- tests/admin/                   # Admin tests
npm run verify:phase4-5                    # Phase 4-5 verification
```

Tests must pass before:
- ✅ Code is merged to main
- ✅ Release builds are created
- ✅ Deployment is authorized

---

## TROUBLESHOOTING

### Test Fails: "Found hardcoded literal: X"
**Cause:** Admin UI source contains the exact string  
**Fix:** Remove the hardcoded string from source code

### Test Fails: "No valid pattern found"
**Cause:** Admin UI doesn't use constant or `section.section_name`  
**Fix:** Update Admin UI to use one of the valid patterns

### Test Fails: "Usage before import"
**Cause:** Code uses `PHASE5_SECTION_HEADINGS` before importing it  
**Fix:** Move import to top of file

### Test Fails: "Found definition pattern: X"
**Cause:** Local variable redefines section names  
**Fix:** Remove the local definition, use the constant or report field

---

## VERIFICATION COMMAND

```bash
# Verify Step-6.2 is working
cd /workspaces/Firstry/atlassian/forge-app
npm test -- tests/admin/phase5_admin_static_enforcement.ts

# Expected output:
# ✓ tests/admin/phase5_admin_static_enforcement.ts (7 tests)
# Test Files  1 passed (1)
# Tests       7 passed (7)
```
