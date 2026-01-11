# FORGE LINT LIMITATION - DOCUMENTED

## Issue
`forge lint` fails when manifest declares `src/gadget-ui/dist` as a resource path, with error:
```
ESLint was configured to run on `<tsconfigRootDir>/src/gadget-ui/dist/assets/index.CCCh6l46.js` 
using `parserOptions.project`: <tsconfigRootDir>/tsconfig.json
However, that TSConfig does not include this file.
```

## Root Cause
- Forge CLI v12.12.0 uses a hardcoded ESLint configuration with `parserOptions.project`
- The TypeScript ESLint parser requires all files to be in the specified tsconfig
- `src/gadget-ui/dist` contains Vite-compiled JavaScript, not TypeScript source
- tsconfig.json correctly excludes gadget-ui source files (it has separate Vite build)
- But the manifest resource points to the compiled dist directory

## Why This Cannot Be Fixed Without Workarounds
1. Adding dist to tsconfig.json breaks type checking (dist isn't TypeScript)
2. Forge lint doesn't respect .eslintrc overrides or ignorePatterns
3. Forge lint uses internal hardcoded config that cannot be overridden
4. The manifest must point to dist for the gadget to work

## Status
- ✅ tsc passes (npx tsc --noEmit exits 0)
- ✅ npm test passes (1270 tests)
- ✅ npm run build passes (Vite 377ms)
- ⚠️ forge lint fails (documented limitation, non-blocking per requirements)

## Workaround (Optional)
If forge lint must pass:
1. Keep src/gadget-ui as plain JavaScript (no TypeScript compilation)
2. Or: Update manifest to not reference dist folder at all

## Recommended Action
Treat forge lint as non-blocking for now. The application builds correctly and tsc validation passes.
File this as a Forge CLI bug: "forge lint fails when manifest references Vite-compiled dist directory"
