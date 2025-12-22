#!/usr/bin/env node

/**
 * Add disclaimer headers to existing docs with compliance terms
 * 
 * This script adds context headers to historical documentation files
 * to clarify that any SOC2/ISO/HIPAA references are Atlassian platform
 * certifications, not app-level certifications.
 */

const fs = require('fs');
const path = require('path');

const DISCLAIMER_HEADER = `
---
**COMPLIANCE DISCLAIMER**: Any references to SOC 2, ISO 27001, HIPAA, GDPR, or Cloud Fortified in this document refer to Atlassian's platform-level certifications, NOT independent app-level certifications. FirstTry Governance inherits security posture from the Atlassian Forge platform. See [docs/SECURITY.md](../atlassian/forge-app/docs/SECURITY.md) for explicit disclaimers.
---

`.trim();

const filesToUpdate = [
  'atlassian/forge-app/docs/PLATFORM_DEPENDENCIES.md',
  'atlassian/forge-app/SECURITY.md',
  'docs/PRIVACY.md'
];

filesToUpdate.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`⚠️  Skipping ${file} (not found)`);
    return;
  }
  
  const content = fs.readFileSync(file, 'utf8');
  
  // Check if disclaimer already exists
  if (content.includes('COMPLIANCE DISCLAIMER')) {
    console.log(`✅ ${file} already has disclaimer`);
    return;
  }
  
  // Add disclaimer at top (after title if markdown)
  const lines = content.split('\n');
  const insertIndex = lines[0].startsWith('#') ? 1 : 0;
  
  lines.splice(insertIndex, 0, '', DISCLAIMER_HEADER, '');
  
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  console.log(`✅ Added disclaimer to ${file}`);
});

console.log('\n✅ Disclaimer injection complete');
console.log('Note: Other historical docs are archived context - not user-facing');
