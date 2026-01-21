#!/usr/bin/env node

/**
 * POST-TSC PHASE 4 COPY
 * 
 * After `npx tsc`, this script copies Phase 4 standalone test files from 
 * dist/src/ to dist/ root so they're at the exact paths expected by verify_phase4.mjs
 */

import fs from 'fs';
import path from 'path';

const srcPath1 = path.join(process.cwd(), 'dist/src/test_phase4_standalone.js');
const srcPath2 = path.join(process.cwd(), 'dist/src/test_disclosure_standalone.js');

const destPath1 = path.join(process.cwd(), 'dist/test_phase4_standalone.js');
const destPath2 = path.join(process.cwd(), 'dist/test_disclosure_standalone.js');

try {
  if (fs.existsSync(srcPath1)) {
    fs.copyFileSync(srcPath1, destPath1);
    console.log(`✅ Copied dist/src/test_phase4_standalone.js → dist/test_phase4_standalone.js`);
  }
  
  if (fs.existsSync(srcPath2)) {
    fs.copyFileSync(srcPath2, destPath2);
    console.log(`✅ Copied dist/src/test_disclosure_standalone.js → dist/test_disclosure_standalone.js`);
  }
  
  console.log('✅ Phase 4 standalone files ready at dist/ root');
} catch (err) {
  console.error('❌ Failed to copy Phase 4 files:', err.message);
  process.exit(1);
}
