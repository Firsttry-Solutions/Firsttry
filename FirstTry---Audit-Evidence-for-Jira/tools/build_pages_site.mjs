#!/usr/bin/env node
// build_pages_site.mjs — Entry-point Pages site builder
//
// Delegates all site-building to build_trust_portal.mjs (F100 Trust Portal).
// Keeping this wrapper preserves the existing docs.yml build step unchanged.
//
// Usage (from repo root): node atlassian/forge-app/tools/build_pages_site.mjs
//
'use strict';

import path from 'path';
import { execSync } from 'child_process';

const SCRIPT_DIR = new URL('.', import.meta.url).pathname;
const PORTAL_BUILDER = path.join(SCRIPT_DIR, 'build_trust_portal.mjs');

console.log('build_pages_site.mjs — delegating to build_trust_portal.mjs (F100)');
execSync(`node "${PORTAL_BUILDER}"`, { stdio: 'inherit' });
