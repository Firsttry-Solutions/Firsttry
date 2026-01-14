#!/usr/bin/env node
/**
 * run_build_with_meta.mjs — Run build:gadget with injected build metadata
 *
 * This is the portable way to inject FT_BUILD_SHA and FT_BUILD_TIME_UTC
 * into the build process without relying on shell export commands.
 *
 * Usage: node tools/run_build_with_meta.mjs
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const metaPath = path.join(__dirname, '.build_meta.json');

// Verify metadata file exists
if (!fs.existsSync(metaPath)) {
  console.error(`❌ Metadata file not found: ${metaPath}`);
  console.error('   Run: node tools/build_meta.mjs first');
  process.exit(1);
}

const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
console.log(`✅ Loaded build metadata:`);
console.log(`   FT_BUILD_SHA=${meta.FT_BUILD_SHA}`);
console.log(`   FT_BUILD_TIME_UTC=${meta.FT_BUILD_TIME_UTC}`);

// Run build:gadget with environment variables
const env = {
  ...process.env,
  FT_BUILD_SHA: meta.FT_BUILD_SHA,
  FT_BUILD_TIME_UTC: meta.FT_BUILD_TIME_UTC,
};

try {
  console.log(`\n📦 Running: npm run build:gadget`);
  execSync('npm run build:gadget', {
    env,
    stdio: 'inherit',
  });
  console.log(`\n✅ Build succeeded`);
  process.exit(0);
} catch (e) {
  console.error(`\n❌ Build failed: ${e.message}`);
  process.exit(1);
}
