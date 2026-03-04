#!/usr/bin/env node
/**
 * Manifest Parser - Real YAML parsing for manifest.yml
 * Usage: cd atlassian/forge-app && NODE_PATH=$PWD/node_modules node ../../tools/marketplace/readiness/lib/manifest_parse.mjs ./manifest.yml
 * Output: JSON to stdout
 */

import { readFileSync } from 'node:fs';
import * as YAML from 'yaml';

const manifestPath = process.argv[2];

if (!manifestPath) {
  console.error('ERROR: No manifest path provided');
  console.error('Usage: node manifest_parse.mjs <path-to-manifest.yml>');
  process.exit(1);
}

try {
  const content = readFileSync(manifestPath, 'utf8');
  const manifest = YAML.parse(content);
  
  const output = {
    appId: manifest.app?.id || null,
    scopes: [],
    modules: [],
    resources: [],
    resolvers: []
  };
  
  // Extract scopes
  if (manifest.permissions) {
    if (Array.isArray(manifest.permissions.scopes)) {
      output.scopes = manifest.permissions.scopes;
    } else if (manifest.permissions.scopes) {
      output.scopes = [manifest.permissions.scopes];
    }
  }
  
  // Extract modules
  if (manifest.modules) {
    Object.keys(manifest.modules).forEach(moduleType => {
      const modules = manifest.modules[moduleType];
      if (Array.isArray(modules)) {
        modules.forEach(mod => {
          output.modules.push({
            type: moduleType,
            key: mod.key || null
          });
        });
      } else if (typeof modules === 'object') {
        Object.keys(modules).forEach(key => {
          output.modules.push({
            type: moduleType,
            key: key
          });
        });
      }
    });
  }
  
  // Extract resources
  if (manifest.resources) {
    Object.keys(manifest.resources).forEach(resourceType => {
      const resources = manifest.resources[resourceType];
      if (Array.isArray(resources)) {
        output.resources.push(...resources.map(r => ({
          type: resourceType,
          key: r.key || null
        })));
      } else if (typeof resources === 'object') {
        Object.keys(resources).forEach(key => {
          output.resources.push({
            type: resourceType,
            key: key
          });
        });
      }
    });
  }
  
  // Extract resolvers (if present)
  if (manifest.resolvers) {
    Object.keys(manifest.resolvers).forEach(resolverType => {
      const resolvers = manifest.resolvers[resolverType];
      if (Array.isArray(resolvers)) {
        output.resolvers.push(...resolvers.map(r => ({
          type: resolverType,
          key: r.key || null
        })));
      }
    });
  }
  
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
  
} catch (error) {
  console.error(`ERROR: Failed to parse manifest: ${error.message}`);
  process.exit(1);
}
