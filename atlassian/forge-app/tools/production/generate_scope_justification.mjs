#!/usr/bin/env node

/**
 * generate_scope_justification.mjs
 * 
 * Cross-references manifest.yml scopes with requestJira usage
 * Generates scope justification table with code links
 * 
 * REQUIRES: FT_PROD_READY_E environment variable (absolute path to evidence root)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const REPO_ROOT = process.argv[2] || process.cwd();

// Validate FT_PROD_READY_E environment variable
const AUDIT_ROOT = process.env.FT_PROD_READY_E || '';
if (!AUDIT_ROOT) {
  console.error('FAIL: FT_PROD_READY_E environment variable is not set');
  process.exit(1);
}
if (!fs.existsSync(AUDIT_ROOT)) {
  console.error(`FAIL: FT_PROD_READY_E directory does not exist: ${AUDIT_ROOT}`);
  process.exit(1);
}

const AUDIT_DIR = path.join(AUDIT_ROOT, '14_enterprise_audit');
const OUTPUT_FILE = path.join(AUDIT_DIR, 'scopes_justification_table.md');

// Read manifest
const manifestPath = path.join(REPO_ROOT, 'manifest.yml');
let manifest = {};
if (fs.existsSync(manifestPath)) {
  const content = fs.readFileSync(manifestPath, 'utf-8');
  // Simple YAML parsing for scopes
  const scopesMatch = content.match(/scopes:\s*\n([\s\S]*?)(?=\n\S|$)/);
  if (scopesMatch) {
    const scopesText = scopesMatch[1];
    manifest.scopes = scopesText
      .split('\n')
      .map(l => l.replace(/^\s*-\s*/, '').trim())
      .filter(l => l.startsWith('read:') || l.startsWith('write:') || l.startsWith('storage:'));
  }
}

// Read requestjira_map.csv
const csvPath = path.join(AUDIT_DIR, 'requestjira_map.csv');
const scopeUsage = {};

if (fs.existsSync(csvPath)) {
  const lines = fs.readFileSync(csvPath, 'utf-8').split('\n').slice(1);
  for (const line of lines) {
    if (!line.trim()) continue;
    const [file, lineNum, method, endpoint, classification] = line.split(',');
    if (!endpoint || endpoint.includes('"')) continue;
    
    // Map endpoints to scopes
    const scope = mapEndpointToScope(endpoint);
    if (!scope) continue;
    
    if (!scopeUsage[scope]) {
      scopeUsage[scope] = { read: 0, write: 0, files: new Set() };
    }
    
    if (classification === 'READ') scopeUsage[scope].read++;
    else if (classification === 'WRITE') scopeUsage[scope].write++;
    scopeUsage[scope].files.add(file);
  }
}

// Generate table
const table = ['| Scope | Usage | Classification | File References | Justification |'];
table.push('|-------|-------|-----------------|------------------|----------------|');

const scopes = manifest.scopes || ['read:jira-user', 'read:jira-work', 'storage:app'];
for (const scope of scopes) {
  const usage = scopeUsage[scope] || { read: 0, write: 0, files: new Set() };
  const usageStr = usage.read > 0 ? `READ (${usage.read})` : usage.write > 0 ? `WRITE (${usage.write})` : 'Not used';
  const classification = usage.read > 0 ? 'READ' : 'WRITE';
  const files = Array.from(usage.files).slice(0, 3).join(', ') || 'N/A';
  const justification = getJustification(scope);
  
  table.push(`| ${scope} | ${usageStr} | ${classification} | ${files} | ${justification} |`);
}

// Write output
fs.mkdirSync(AUDIT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `# Scope Justification Table\n\n${table.join('\n')}\n`);
console.log(table.join('\n'));

// Explicit success exit
process.exit(0);

function mapEndpointToScope(endpoint) {
  if (endpoint.includes('/myself') || endpoint.includes('/user')) return 'read:jira-user';
  if (endpoint.includes('/project') || endpoint.includes('/issue')) return 'read:jira-work';
  if (endpoint.includes('/field') || endpoint.includes('/screen')) return 'read:jira-work';
  if (endpoint.includes('/permission')) return 'read:jira-work';
  return null;
}

function getJustification(scope) {
  const justifications = {
    'read:jira-user': 'Read access to current user context (/myself endpoint)',
    'read:jira-work': 'Read access to projects, issues, permissions for governance analysis',
    'storage:app': 'Persistent storage for snapshots and audit ledgers'
  };
  return justifications[scope] || 'Required for app functionality';
}
