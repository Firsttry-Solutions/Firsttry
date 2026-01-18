#!/usr/bin/env node
/**
 * tools/csp_forbid_check.js
 * 
 * CSP Regression Prevention: Fails build if forbidden inline styles reappear
 * 
 * Forbidden patterns (fail build if found in SOURCE):
 * - style=" (inline style attributes)
 * - style={{ (React inline styles)
 * - .style.  (DOM style mutations)
 * - createElement('style') (style tag injection)
 * - insertRule( (stylesheet rule injection)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const GADGET_SRC = path.join(__dirname, '../src/gadget-ui/src');

// Forbidden patterns that violate CSP
const FORBIDDEN_PATTERNS = [
  { regex: /style\s*=\s*["']/g, name: 'inline style attribute (style="...")' },
  { regex: /style\s*=\s*\{\{/g, name: 'React inline style (style={{...}})' },
  { regex: /\.style\./g, name: 'DOM style mutation (.style.*)' },
  { regex: /createElement\s*\(\s*["']style["']\s*\)/g, name: 'style tag creation' },
  { regex: /insertRule\s*\(/g, name: 'insertRule() call' },
];

console.log('========================================================================');
console.log('CSP Violation Prevention Check');
console.log('========================================================================');
console.log('');

let totalViolations = 0;

// Recursively check all TypeScript/JavaScript files
function checkFiles(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);

    // Skip node_modules, dist, and other generated folders
    if (file === 'node_modules' || file === 'dist' || file === 'build' || file.startsWith('.')) {
      return;
    }

    if (stat.isDirectory()) {
      checkFiles(filepath);
    } else if (file.match(/\.(ts|tsx|js|jsx|html)$/)) {
      const content = fs.readFileSync(filepath, 'utf8');
      const relativePath = path.relative(GADGET_SRC, filepath);

      FORBIDDEN_PATTERNS.forEach(({ regex, name }) => {
        let match;
        const regexWithGlobal = new RegExp(regex.source, 'g');
        let lineNum = 1;
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
          if (line.match(regex)) {
            const col = line.search(regex);
            console.log(`❌ ${relativePath}:${idx + 1}:${col + 1}`);
            console.log(`   Violation: ${name}`);
            console.log(`   Line: ${line.trim().substring(0, 80)}`);
            console.log('');
            totalViolations++;
          }
        });
      });
    }
  });
}

console.log(`Scanning: ${path.relative(process.cwd(), GADGET_SRC)}`);
console.log('');

checkFiles(GADGET_SRC);

console.log('========================================================================');
if (totalViolations === 0) {
  console.log(`✅ PASS: No CSP violations detected (${totalViolations} found)`);
  console.log('========================================================================');
  process.exit(0);
} else {
  console.log(`❌ FAIL: Found ${totalViolations} CSP violation(s)`);
  console.log('========================================================================');
  console.log('');
  console.log('CSP Violation Summary:');
  console.log('- All inline styles must be moved to static CSS files');
  console.log('- Use class names with .classList.add/.remove for dynamic styling');
  console.log('- See audit/csp_fix/01_audit_summary.md for migration guide');
  console.log('');
  process.exit(1);
}
