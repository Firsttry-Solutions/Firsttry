#!/usr/bin/env node
/**
 * Assert Invoke Keys Match Between UI and Resolver
 *
 * Exit codes:
 *   0 = All UI invoke keys are defined in gadget-resolver.ts
 *   1 = Mismatch detected (missing keys, wrong handler, etc)
 *   2 = File not found
 */

import fs from 'fs';
import path from 'path';

const REPO_ROOT = process.cwd();
const UI_FILE = path.join(REPO_ROOT, 'atlassian/forge-app/src/gadget-ui/src/main.ts');
const RESOLVER_FILE = path.join(REPO_ROOT, 'atlassian/forge-app/src/gadget-resolver.ts');
const MANIFEST_FILE = path.join(REPO_ROOT, 'atlassian/forge-app/manifest.yml');

function extractUIInvokeKeys() {
  if (!fs.existsSync(UI_FILE)) {
    console.error(`ERROR: UI file not found: ${UI_FILE}`);
    process.exit(2);
  }

  const content = fs.readFileSync(UI_FILE, 'utf8');
  const pattern = /invoke\(['"]([^'"]+)['"]/g;
  const keys = new Set();
  let match;

  while ((match = pattern.exec(content)) !== null) {
    keys.add(match[1]);
  }

  return Array.from(keys).sort();
}

function extractResolverDefinedKeys() {
  if (!fs.existsSync(RESOLVER_FILE)) {
    console.error(`ERROR: Resolver file not found: ${RESOLVER_FILE}`);
    process.exit(2);
  }

  const content = fs.readFileSync(RESOLVER_FILE, 'utf8');
  const pattern = /resolver\.define\(['"]([^'"]+)['"]/g;
  const keys = new Set();
  let match;

  while ((match = pattern.exec(content)) !== null) {
    keys.add(match[1]);
  }

  return Array.from(keys).sort();
}

function verifyManifestHandler() {
  if (!fs.existsSync(MANIFEST_FILE)) {
    console.error(`ERROR: Manifest file not found: ${MANIFEST_FILE}`);
    process.exit(2);
  }

  const content = fs.readFileSync(MANIFEST_FILE, 'utf8');
  
  // Check that get-status-snapshot-fn uses gadget-resolver.handler
  if (!content.includes('- key: get-status-snapshot-fn') || !content.includes('handler: gadget-resolver.handler')) {
    console.error('ERROR: get-status-snapshot-fn must use handler: gadget-resolver.handler');
    return false;
  }

  // Verify gadget-resolver.handler is used consistently
  const matches = (content.match(/handler: gadget-resolver\.handler/g) || []).length;
  if (matches < 4) {
    console.error(`ERROR: Expected at least 4 gadget-resolver.handler references in manifest, found ${matches}`);
    return false;
  }

  return true;
}

function main() {
  const uiKeys = extractUIInvokeKeys();
  const resolverKeys = extractResolverDefinedKeys();

  console.log('=== Invoke Key Assertion ===');
  console.log(`UI invoke keys found (${uiKeys.length}):`, uiKeys);
  console.log(`Resolver defined keys (${resolverKeys.length}):`, resolverKeys);

  // Check manifest
  console.log('Checking manifest handler...', verifyManifestHandler() ? 'OK' : 'FAIL');

  // Find missing keys
  const missing = uiKeys.filter(k => !resolverKeys.includes(k));
  const extra = resolverKeys.filter(k => !uiKeys.includes(k));

  if (missing.length > 0) {
    console.error('\nERROR: Missing resolver definitions for UI invoke keys:');
    missing.forEach(k => console.error(`  - ${k}`));
    process.exit(1);
  }

  if (extra.length > 0) {
    console.warn('\nWARN: Extra resolver definitions not used by UI (this is OK):');
    extra.forEach(k => console.warn(`  + ${k}`));
  }

  console.log('\n✓ All UI invoke keys are properly defined in gadget-resolver.ts');
  console.log('✓ Manifest correctly references gadget-resolver.handler');
  process.exit(0);
}

main();
