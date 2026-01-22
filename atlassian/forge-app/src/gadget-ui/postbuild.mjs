#!/usr/bin/env node
/**
 * POST-BUILD SCRIPT: Filename-Based Cache Busting
 * 
 * After Vite builds:
 * 1. Read UI_GIT_SHA from src/gadget-ui/src/ui_build_meta.ts
 * 2. Rename index.js to app.<SHA>.js (filename-based cache-busting)
 * 3. Remove Vite's auto-injected index.js script tag from dist/index.html
 * 4. Inject EXACTLY ONE script tag: <script src="./app.<SHA>.js"></script>
 * 
 * Result: dist/index.html will have ONLY <script src="./app.<SHA>.js"></script>
 * Browser cache key is based on filename, NOT query param.
 * Different SHA = completely different filename = guaranteed cache miss.
 * Forge CDN will always serve the correct file.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
const metaPath = path.join(__dirname, 'src', 'ui_build_meta.ts');
const htmlPath = path.join(distDir, 'index.html');

function extractShaFromMeta() {
  try {
    const content = fs.readFileSync(metaPath, 'utf-8');
    // Match: export const UI_GIT_SHA = "f1c06fb";
    const match = content.match(/export\s+const\s+UI_GIT_SHA\s*=\s*["']([^"']+)["']/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (err) {
    console.error(`[POSTBUILD] Error reading ${metaPath}:`, err.message);
  }
  return null;
}

function main() {
  try {
    // 1. Extract UI_GIT_SHA from ui_build_meta.ts
    const uiBuildSha = extractShaFromMeta();

    if (!uiBuildSha) {
      console.error(`[POSTBUILD] ERROR: Could not extract UI_GIT_SHA from ${metaPath}`);
      process.exit(1);
    }

    console.log(`[POSTBUILD] sha=${uiBuildSha}`);

    // 2. Rename index.js to app.<SHA>.js (filename-based cache busting)
    const indexJsPath = path.join(distDir, 'index.js');
    const appShaJsPath = path.join(distDir, `app.${uiBuildSha}.js`);

    if (!fs.existsSync(indexJsPath)) {
      console.error(`[POSTBUILD] ERROR: ${indexJsPath} not found (expected Vite output)`);
      process.exit(1);
    }

    fs.renameSync(indexJsPath, appShaJsPath);
    console.log(`[POSTBUILD] wrote entry=app.${uiBuildSha}.js`);

    // ========================================================================
    // L0.1B: INJECT ACTUAL IDENTITY ANCHOR WITH REAL BUNDLE HASH
    // git= first 7 hex of git SHA (commit identifier)
    // bundle= first 7 hex of SHA-256 of FINAL JS FILE CONTENT (real provenance)
    // time= build time ISO string
    // ========================================================================
    try {
      const bundleContent = fs.readFileSync(appShaJsPath, 'utf-8');
      
      // Extract UI_BUILD_TIME_UTC from ui_build_meta.ts
      const metaContent = fs.readFileSync(metaPath, 'utf-8');
      const timeMatch = metaContent.match(/export\s+const\s+UI_BUILD_TIME_UTC\s*=\s*["']([^"']+)["']/);
      const buildTimeUtc = timeMatch ? timeMatch[1] : new Date().toISOString();
      
      // Git SHA: first 7 chars (git commit identifier)
      const gitSha = uiBuildSha.substring(0, 7);
      
      // Bundle hash: SHA-256 of final file CONTENT (not derived from git SHA)
      // This provides REAL provenance - bundle hash cannot be predicted from git SHA
      const bundleHashFull = crypto.createHash('sha256').update(bundleContent).digest('hex');
      const bundleShort = bundleHashFull.substring(0, 7);
      
      // Create the actual anchor string with REAL distinctness
      const actualAnchor = `FT_IDENTITY_ANCHOR_V1|git=${gitSha}|bundle=${bundleShort}|time=${buildTimeUtc}`;
      
      // INVARIANT CHECK: git and bundle must be different (real distinctness)
      if (gitSha === bundleShort) {
        console.error(`[POSTBUILD] FATAL: git SHA === bundle hash (${gitSha}). This violates distinctness!`);
        console.error(`[POSTBUILD] git (first 7 of commit): ${gitSha}`);
        console.error(`[POSTBUILD] bundle (first 7 of sha256(content)): ${bundleShort}`);
        process.exit(1);
      }
      
      console.log(`[POSTBUILD] ✓ Anchor components:`);
      console.log(`[POSTBUILD]   git=${gitSha} (from UI_GIT_SHA.slice(0,7))`);
      console.log(`[POSTBUILD]   bundle=${bundleShort} (from sha256(content).slice(0,7))`);
      console.log(`[POSTBUILD]   time=${buildTimeUtc}`);
      console.log(`[POSTBUILD]   Anchor: ${actualAnchor}`);
      
      // Try to replace template anchor if it exists
      const templatePattern = /FT_IDENTITY_ANCHOR_V1\|git=\$\{.*?\.substring\(0,\s*7\)\}\|bundle=\$\{.*?\}\|time=\$\{.*?\}/g;
      let newContent = bundleContent.replace(templatePattern, actualAnchor);
      
      if (bundleContent !== newContent) {
        fs.writeFileSync(appShaJsPath, newContent, 'utf-8');
        console.log(`[POSTBUILD] ✓ Replaced template anchor with literal`);
      } else {
        // Template not found - append anchor as a comment (deterministic, appears once)
        // Use marker comment that is grep-able and won't interfere with code
        const anchorComment = `/*\n * FT_IDENTITY_ANCHOR_V1|git=${gitSha}|bundle=${bundleShort}|time=${buildTimeUtc}\n */`;
        const finalContent = bundleContent + '\n' + anchorComment;
        fs.writeFileSync(appShaJsPath, finalContent, 'utf-8');
        console.log(`[POSTBUILD] ✓ Appended anchor as comment (template not found in bundle)`);
      }
    } catch (err) {
      console.error(`[POSTBUILD] ERROR during anchor injection: ${err.message}`);
      process.exit(1);
    }

    // 3. Process index.html
    if (!fs.existsSync(htmlPath)) {
      console.error(`[POSTBUILD] ERROR: ${htmlPath} not found`);
      process.exit(1);
    }

    let htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    // ========================================================================
    // L0.2: ASSERT NO QUERY-PARAM CACHE BUST OR LEGACY ENTRY ASSETS
    // ========================================================================
    if (htmlContent.includes('app.js?v=')) {
      console.error('[POSTBUILD] ASSERT FAIL: Found legacy query-param cache bust "app.js?v="');
      process.exit(1);
    }
    if (htmlContent.includes('assets/index.')) {
      // Check if it's a .js file (bad) or just .css (OK - Vite convention)
      const assetMatches = htmlContent.match(/assets\/index\.[^"']*/g) || [];
      const jsAssets = assetMatches.filter(m => m.endsWith('.js'));
      if (jsAssets.length > 0) {
        console.error('[POSTBUILD] ASSERT FAIL: Found legacy JS asset reference in assets/index.*');
        process.exit(1);
      }
      // CSS assets are OK (Vite bundles CSS separately)
    }
    if (htmlContent.includes('index.js?v=')) {
      console.error('[POSTBUILD] ASSERT FAIL: Found legacy query-param "index.js?v="');
      process.exit(1);
    }
    console.log('[POSTBUILD] ✓ Asserts passed: no query-param cache bust, no legacy entry assets');
    
    // Remove any existing script tags that reference app.*.js or index.js
    htmlContent = htmlContent.replace(
      /<script[^>]*\s(src=["']\.\/)?(?:index\.js|app\.[0-9a-f]+\.js)["'][^>]*><\/script>/g,
      ''
    );
    
    // Inject exactly ONE script tag with filename-based cache bust
    const scriptTag = `<script type="module" src="./app.${uiBuildSha}.js"></script>`;
    
    if (htmlContent.includes('</head>')) {
      htmlContent = htmlContent.replace('</head>', `    ${scriptTag}\n</head>`);
      fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
      console.log(`[POSTBUILD] index.html script=<script type="module" src="./app.${uiBuildSha}.js"></script>`);
    } else {
      console.error('[POSTBUILD] ERROR: </head> tag not found in index.html');
      process.exit(1);
    }

    // 4. Verification
    const finalHtml = fs.readFileSync(htmlPath, 'utf-8');
    const scriptTagMatch = finalHtml.match(/<script[^>]+src="([^"]+)"/);
    if (!scriptTagMatch) {
      console.error('[POSTBUILD] ERROR: No script tag found after injection');
      process.exit(1);
    }

    // Verify exactly one script tag
    const scriptCount = (finalHtml.match(/<script/g) || []).length;
    if (scriptCount !== 1) {
      console.error(`[POSTBUILD] ERROR: Found ${scriptCount} script tags, expected exactly 1`);
      process.exit(1);
    }

    // Verify the loaded file exists
    if (!fs.existsSync(appShaJsPath)) {
      console.error(`[POSTBUILD] ERROR: File does not exist: ${appShaJsPath}`);
      process.exit(1);
    }

    // ========================================================================
    // L0.1: WRITE ENTRY_PROOF.json FOR CACHE-BUST VERIFICATION
    // ========================================================================
    const entryProof = {
      build_sha: uiBuildSha,
      entry_filename: `app.${uiBuildSha}.js`,
      time_utc: new Date().toISOString(),
      cache_bust_method: 'filename-based',
      verification: 'Filename must be unique per build; different SHA guarantees cache miss'
    };
    const entryProofPath = path.join(distDir, 'ENTRY_PROOF.json');
    fs.writeFileSync(entryProofPath, JSON.stringify(entryProof, null, 2), 'utf-8');
    console.log(`[POSTBUILD] wrote ENTRY_PROOF.json (build_sha=${uiBuildSha})`);

    console.log(`[POSTBUILD] ✓ Filename-based cache-bust ready`);
  } catch (err) {
    console.error('[POSTBUILD] ERROR:', err.message);
    process.exit(1);
  }
}

main();
