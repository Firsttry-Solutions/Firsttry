#!/usr/bin/env node
/**
 * GATE 1: No Jira Mutation Scan
 * 
 * Scans milestone1 code for actual `requestJira` calls with mutation methods.
 * 
 * Rules:
 * - FAIL if: requestJira({ method: 'POST'|'PUT'|'PATCH'|'DELETE' })
 * - PASS if: No such mutation patterns found
 * - PASS if: Only in documentation strings, comments
 * 
 * Exit: 0 on PASS, 1 on FAIL
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getMilestone1Root() {
  return path.dirname(path.dirname(__filename));
}

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Pattern 1: requestJira({ method: 'POST' / 'PUT' / 'PATCH' / 'DELETE' })
    // This looks for actual calls, not string literals in docs
    const patterns = [
      /requestJira\s*\(\s*\{\s*method\s*:\s*["']POST["']/i,
      /requestJira\s*\(\s*\{\s*method\s*:\s*["']PUT["']/i,
      /requestJira\s*\(\s*\{\s*method\s*:\s*["']PATCH["']/i,
      /requestJira\s*\(\s*\{\s*method\s*:\s*["']DELETE["']/i,
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        // Found a mutation pattern
        const lineNum = content.substring(0, content.indexOf(matches[0])).split('\n').length;
        return {
          found: true,
          match: matches[0],
          line: lineNum,
        };
      }
    }

    return { found: false };
  } catch (error) {
    return { error: error.message };
  }
}

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    // Skip node_modules, test outputs
    if (
      file === 'node_modules' ||
      file === 'dist' ||
      file === '__tests__' ||
      file === '.git'
    ) {
      continue;
    }

    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (
      file.endsWith('.ts') ||
      file.endsWith('.js') ||
      file.endsWith('.tsx') ||
      file.endsWith('.jsx')
    ) {
      callback(filePath);
    }
  }
}

async function runMutationScan() {
  console.log('[NoJiraMutationScan] Starting...');

  const root = getMilestone1Root();
  console.log('[NoJiraMutationScan] Root: ' + root);

  const mutations = [];

  walkDir(root, (filePath) => {
    const result = scanFile(filePath);
    if (result.found) {
      mutations.push({
        file: filePath,
        match: result.match,
        line: result.line,
      });
    }
  });

  if (mutations.length === 0) {
    console.log(
      '[NoJiraMutationScan] ✓ PASS: No Jira mutation calls found'
    );
    process.exit(0);
  } else {
    console.error('[NoJiraMutationScan] FAIL: Found mutation calls:');
    for (const mutation of mutations) {
      console.error(
        `  ${mutation.file}:${mutation.line}: ${mutation.match}`
      );
    }
    process.exit(1);
  }
}

runMutationScan();
