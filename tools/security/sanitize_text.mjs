#!/usr/bin/env node
/**
 * sanitize_text.mjs - Redacts JWT and Bearer tokens from text streams
 * 
 * Usage:
 *   cat file.txt | node sanitize_text.mjs > sanitized.txt
 *   SANITIZE_SUMMARY_PATH=/tmp/summary.json cat file.txt | node sanitize_text.mjs
 * 
 * Redaction patterns:
 * 1. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 => REDACTED_JWT_HEADER
 * 2. Bearer <base64>.<base64>.<base64> => Bearer REDACTED_JWT
 * 3. Standalone JWT-like <a>.<b>.<c> (20+ chars/segment) => REDACTED_JWT
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

// Read all stdin
const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}
const input = Buffer.concat(chunks).toString('utf-8');

// Compute SHA256 before redaction
const sha256Before = createHash('sha256').update(input, 'utf-8').digest('hex');

let output = input;
let redactionCount = 0;
const patternsDetected = new Set();

// Pattern 1: Bearer JWT tokens (process FIRST to catch full tokens)
const bearerJwtRegex = /\bBearer\s+[A-Za-z0-9\-_=]{20,}\.[A-Za-z0-9\-_=]{20,}\.[A-Za-z0-9\-_=]{20,}\b/g;
const bearerMatches = output.match(bearerJwtRegex);
if (bearerMatches) {
  output = output.replace(bearerJwtRegex, 'Bearer REDACTED_JWT');
  redactionCount += bearerMatches.length;
  patternsDetected.add('bearer_jwt');
}

// Pattern 2: Standalone JWT-like tokens (not after "Bearer ")
// Use negative lookbehind to avoid matching tokens that were already caught by Bearer pattern
const standaloneJwtRegex = /(?<!Bearer\s)\b[A-Za-z0-9\-_=]{20,}\.[A-Za-z0-9\-_=]{20,}\.[A-Za-z0-9\-_=]{20,}\b/g;
const standaloneMatches = output.match(standaloneJwtRegex);
if (standaloneMatches) {
  output = output.replace(standaloneJwtRegex, 'REDACTED_JWT');
  redactionCount += standaloneMatches.length;
  patternsDetected.add('jwt_token');
}

// Pattern 3: Exact JWT header substring (catch-all for remaining fragments)
// Process LAST to avoid breaking full token patterns above
const jwtHeaderPattern = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
if (output.includes(jwtHeaderPattern)) {
  const beforeLen = output.length;
  output = output.replaceAll(jwtHeaderPattern, 'REDACTED_JWT_HEADER');
  const afterLen = output.length;
  if (beforeLen !== afterLen) {
    redactionCount++;
    patternsDetected.add('jwt_header');
  }
}

// Compute SHA256 after redaction
const sha256After = createHash('sha256').update(output, 'utf-8').digest('hex');

// Write sanitized output to stdout
process.stdout.write(output);

// Write summary JSON if requested
const summaryPath = process.env.SANITIZE_SUMMARY_PATH;
if (summaryPath) {
  const summary = {
    redactions: redactionCount,
    patterns: Array.from(patternsDetected).sort(),
    sha256_before: sha256Before,
    sha256_after: sha256After,
    bytes_before: input.length,
    bytes_after: output.length,
    timestamp: new Date().toISOString()
  };
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
}

// Exit with non-zero if redactions were made (for fail-closed detection)
process.exit(redactionCount > 0 ? 1 : 0);
