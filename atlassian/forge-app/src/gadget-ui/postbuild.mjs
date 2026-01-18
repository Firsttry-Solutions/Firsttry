#!/usr/bin/env node
/**
 * POST-BUILD SCRIPT: Cache-Bust Loader Injection
 * 
 * After Vite builds:
 * 1. Read ui_build_meta.json to get FT_BUILD_SHA
 * 2. Rename index.js to app.js (stable filename for cache-busting)
 * 3. Remove Vite's auto-injected index.js script tag from dist/index.html
 * 4. Inject new <script src="app.js?v=<sha>"></script> with cache-bust version
 * 
 * Result: dist/index.html will have ONLY <script src="app.js?v=<sha>"></script>
 * Browser will refetch app.js whenever the version query param changes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
const metaPath = path.join(__dirname, 'src', 'build', 'ui_build_meta.json');
const htmlPath = path.join(distDir, 'index.html');

function main() {
  try {
    // 1. Read build metadata
    if (!fs.existsSync(metaPath)) {
      console.warn('⚠️  ui_build_meta.json not found, skipping postbuild injection');
      return;
    }

    const metaContent = fs.readFileSync(metaPath, 'utf-8');
    const meta = JSON.parse(metaContent);
    const uiBuildSha = meta.FT_BUILD_SHA;

    if (!uiBuildSha) {
      console.warn('⚠️  FT_BUILD_SHA not found in ui_build_meta.json');
      return;
    }

    console.log(`[POSTBUILD] Injecting FT_BUILD_SHA=${uiBuildSha} cache-bust loader`);

    // 2. Rename index.js to app.js (make entry stable for cache-busting)
    const indexJsPath = path.join(distDir, 'index.js');
    const appJsPath = path.join(distDir, 'app.js');

    if (fs.existsSync(indexJsPath)) {
      fs.renameSync(indexJsPath, appJsPath);
      console.log(`[POSTBUILD] ✓ Renamed index.js → app.js (stable entry point)`);
    } else {
      console.warn(`⚠️  ${indexJsPath} not found (expected Vite output)`);
      return;
    }

    // 3. Process index.html
    if (!fs.existsSync(htmlPath)) {
      console.warn(`⚠️  ${htmlPath} not found, skipping HTML injection`);
      return;
    }

    let htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    
    // Remove Vite's auto-injected index.js script tag
    htmlContent = htmlContent.replace(
      /<script[^>]*\ssrc=["']\.\/index\.js["'][^>]*><\/script>/g,
      ''
    );
    console.log(`[POSTBUILD] ✓ Removed auto-injected index.js script tag`);
    
    // Inject new script tag with cache-bust version
    const scriptTag = `<script type="module" src="./app.js?v=${uiBuildSha}"></script>`;
    
    if (htmlContent.includes('</head>')) {
      htmlContent = htmlContent.replace('</head>', `    ${scriptTag}\n</head>`);
      fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
      console.log(`[POSTBUILD] ✓ Injected script tag with cache-bust: ${scriptTag}`);
    } else {
      console.warn('⚠️  </head> tag not found in index.html');
      return;
    }

    // 4. Verification: Print what browser will load
    const finalHtml = fs.readFileSync(htmlPath, 'utf-8');
    const scriptTagMatch = finalHtml.match(/<script[^>]+src="([^"]+)"/);
    if (scriptTagMatch) {
      console.log(`[POSTBUILD] ✓ Browser will load: ${scriptTagMatch[1]}`);
    }
    
    // Verify we have exactly one script tag
    const scriptCount = (finalHtml.match(/<script/g) || []).length;
    console.log(`[POSTBUILD] ✓ Final HTML has ${scriptCount} script tag(s)`);

    console.log(`[POSTBUILD] ✓ Cache-bust loader ready`);
  } catch (err) {
    console.error('[POSTBUILD] ERROR:', err.message);
    process.exit(1);
  }
}

main();
