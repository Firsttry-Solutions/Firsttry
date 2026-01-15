#!/usr/bin/env node

/**
 * Deterministic YAML manifest parser for getBuildInfo audit.
 * No external dependencies. Strict line-based parsing with validation.
 */

import fs from 'fs';
import path from 'path';

const usage = `
Usage: node tools/_yaml_manifest_audit.mjs <manifest-path> [check]

Check types:
  - manifest-path: print manifest file path
  - find-buildinfo: find 'getBuildInfo' key in functions section
  - find-handler-path: find handler file path for getBuildInfo
`;

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help') {
  console.error(usage);
  process.exit(1);
}

const manifestPath = args[0];
const check = args[1] || 'manifest-path';

// Validate manifest exists
if (!fs.existsSync(manifestPath)) {
  console.error(`FAIL: Manifest file does not exist: ${manifestPath}`);
  process.exit(1);
}

const content = fs.readFileSync(manifestPath, 'utf8');
const lines = content.split('\n');

/**
 * Find function handler section and parse for getBuildInfo
 */
function findBuildInfoInManifest() {
  let getBuildInfoKey = null;
  let handlerPath = null;
  let getBuildInfoLine = null;
  let handlerLine = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Look for getBuildInfo key anywhere (format: "key: get-build-info-fn")
    if (trimmed.includes('get-build-info-fn') && trimmed.includes('key:')) {
      getBuildInfoKey = 'get-build-info-fn';
      getBuildInfoLine = i + 1;
    }

    // Once we find the get-build-info-fn key section, look for handler on same or next lines
    if (getBuildInfoKey && !handlerPath) {
      // Check current line for handler
      if (trimmed.includes('handler:')) {
        const match = trimmed.match(/handler:\s*(.+?)(?:\s*$|#)/);
        if (match) {
          handlerPath = match[1].trim().replace(/['"`]/g, '');
          handlerLine = i + 1;
          break;
        }
      }
      // Look ahead a few lines (bounded window)
      if (i - (getBuildInfoLine - 1) > 5) {
        // If we've gone 5 lines beyond get-build-info-fn without finding handler, reset
        if (handlerPath === null) {
          getBuildInfoKey = null;
          getBuildInfoLine = null;
        }
      }
    }
  }

  return {
    found: getBuildInfoKey !== null && handlerPath !== null,
    key: getBuildInfoKey,
    handler: handlerPath,
    keyLine: getBuildInfoLine,
    handlerLine: handlerLine,
    raw: { getBuildInfoKey, handlerPath }
  };
}

// Execute requested check
try {
  if (check === 'manifest-path') {
    console.log(path.resolve(manifestPath));
  } else if (check === 'find-buildinfo') {
    const result = findBuildInfoInManifest();
    if (!result.found) {
      console.error('FAIL: getBuildInfo not found in manifest functions section');
      process.exit(1);
    }
    console.log(`Found: ${result.key}`);
  } else if (check === 'find-handler-path') {
    const result = findBuildInfoInManifest();
    if (!result.found) {
      console.error('FAIL: getBuildInfo handler not found in manifest');
      process.exit(1);
    }
    if (!result.handler) {
      console.error('FAIL: handler path empty for getBuildInfo');
      process.exit(1);
    }
    console.log(result.handler);
  } else {
    console.error(`Unknown check: ${check}`);
    process.exit(1);
  }
} catch (e) {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
}
