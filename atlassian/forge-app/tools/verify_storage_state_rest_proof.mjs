#!/usr/bin/env node
/**
 * Verify auth via REST API proof
 * 
 * ONLY ACCEPTABLE PROOF:
 *   GET https://firsttry.atlassian.net/rest/api/3/myself
 *   -> HTTP 200 AND JSON contains non-empty "accountId"
 * 
 * Exit codes:
 *   0 = PASS (200 + accountId)
 *   1 = FAIL (anything else)
 */

import fs from 'fs';
import https from 'https';
import { URL } from 'url';

// Parse CLI args
const args = process.argv.slice(2);
let storageStatePath = null;
let site = null;
let outPath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--storage-state' && i + 1 < args.length) {
    storageStatePath = args[i + 1];
    i++;
  } else if (args[i] === '--site' && i + 1 < args.length) {
    site = args[i + 1];
    i++;
  } else if (args[i] === '--out' && i + 1 < args.length) {
    outPath = args[i + 1];
    i++;
  }
}

if (!storageStatePath || !site || !outPath) {
  console.error('USAGE: verify_storage_state_rest_proof.mjs --storage-state <path> --site <baseUrl> --out <jsonPath>');
  process.exit(1);
}

// Validate site format
if (!site.startsWith('https://')) {
  console.error('ERROR: site must start with https://');
  process.exit(1);
}

if (site.endsWith('/')) {
  site = site.slice(0, -1);
}

const diagnostics = {
  ts: new Date().toISOString(),
  site,
  storageState: storageStatePath,
  cookieCount: 0,
  cookieHeaderLen: 0,
  statusCode: null,
  bodySnippet: '',
  accountIdPresent: false,
  reason: ''
};

async function run() {
  try {
    // Layer 1: File must exist
    if (!fs.existsSync(storageStatePath)) {
      diagnostics.reason = 'STORAGE_STATE_NOT_FOUND';
      fs.writeFileSync(outPath, JSON.stringify(diagnostics, null, 2));
      console.error(`FAIL: File not found: ${storageStatePath}`);
      process.exit(1);
    }

    // Layer 2: Parse JSON
    let storageState;
    try {
      const content = fs.readFileSync(storageStatePath, 'utf-8');
      storageState = JSON.parse(content);
    } catch (e) {
      diagnostics.reason = 'STORAGE_STATE_PARSE_ERROR';
      fs.writeFileSync(outPath, JSON.stringify(diagnostics, null, 2));
      console.error(`FAIL: Could not parse storageState: ${e.message}`);
      process.exit(1);
    }

    // Layer 3: Extract cookies
    const cookies = storageState.cookies || [];
    diagnostics.cookieCount = cookies.length;

    if (cookies.length === 0) {
      diagnostics.reason = 'NO_COOKIES_IN_STORAGE_STATE';
      fs.writeFileSync(outPath, JSON.stringify(diagnostics, null, 2));
      console.error('FAIL: No cookies in storageState');
      process.exit(1);
    }

    // Layer 4: Build Cookie header
    const cookieHeader = cookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ');
    diagnostics.cookieHeaderLen = cookieHeader.length;

    // Layer 5: Make REST API call
    const proof = await makeRestCall(site, cookieHeader);
    
    // Write diagnostics
    fs.writeFileSync(outPath, JSON.stringify(diagnostics, null, 2));

    // Determine success/failure
    if (proof.success && proof.accountId) {
      diagnostics.accountIdPresent = true;
      console.log(`PASS: HTTP ${proof.statusCode}, accountId present`);
      process.exit(0);
    } else {
      diagnostics.reason = proof.reason || 'UNKNOWN_FAILURE';
      if (proof.statusCode) {
        diagnostics.statusCode = proof.statusCode;
      }
      if (proof.bodySnippet) {
        diagnostics.bodySnippet = proof.bodySnippet;
      }
      fs.writeFileSync(outPath, JSON.stringify(diagnostics, null, 2));
      console.error(`FAIL: ${diagnostics.reason}`);
      process.exit(1);
    }
  } catch (e) {
    diagnostics.reason = 'UNEXPECTED_ERROR';
    diagnostics.accountIdPresent = false;
    try {
      fs.writeFileSync(outPath, JSON.stringify(diagnostics, null, 2));
    } catch (writeErr) {
      // Silently fail to write, still exit 1
    }
    console.error(`ERROR: ${e.message}`);
    process.exit(1);
  }
}

function makeRestCall(baseUrl, cookieHeader) {
  return new Promise((resolve) => {
    const url = new URL(baseUrl + '/rest/api/3/myself');
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': cookieHeader,
        'User-Agent': 'Phase6-VerifyRestProof/1.0'
      },
      timeout: 8000
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        diagnostics.statusCode = res.statusCode;

        // Collapse newlines and limit to 220 chars
        const bodySnippet = data
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .substring(0, 220);
        diagnostics.bodySnippet = bodySnippet;

        if (res.statusCode !== 200) {
          resolve({
            success: false,
            statusCode: res.statusCode,
            reason: `HTTP_${res.statusCode}`,
            bodySnippet
          });
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const accountId = parsed.accountId || '';

          if (accountId && accountId.trim().length > 0) {
            resolve({
              success: true,
              statusCode: 200,
              accountId,
              bodySnippet
            });
          } else {
            resolve({
              success: false,
              statusCode: 200,
              reason: 'ACCOUNT_ID_MISSING_OR_EMPTY',
              bodySnippet
            });
          }
        } catch (parseErr) {
          resolve({
            success: false,
            statusCode: 200,
            reason: 'RESPONSE_NOT_JSON',
            bodySnippet
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        reason: `NETWORK_ERROR: ${err.code || err.message}`,
        bodySnippet: ''
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        reason: 'REQUEST_TIMEOUT',
        bodySnippet: ''
      });
    });

    req.end();
  });
}

run();
