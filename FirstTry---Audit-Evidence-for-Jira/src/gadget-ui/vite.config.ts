// @ts-ignore - import.meta is allowed in Vite config despite tsconfig.json module setting
import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get the directory where this config file is located
// @ts-ignore - import.meta is allowed in Vite config despite tsconfig.json module setting
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load UI build metadata (injected by tools/build_meta.mjs at build time)
// FAIL-CLOSED: In production, throw if metadata is missing or invalid
// (Allow "dev" only in local development)
// 
// CONTRACT: ui_build_meta.json contains:
// - UI_GIT_SHA: Full 40-hex commit SHA from git rev-parse HEAD
// - UI_GIT_TIME: ISO timestamp when built
function loadUiBuildMeta() {
  const metaPath = path.join(__dirname, 'src', 'build', 'ui_build_meta.json');
  
  // Check if we're in production mode
  const isProduction = process.env.NODE_ENV === 'production' || process.env.FORGE_ENV === 'production';
  
  try {
    if (!fs.existsSync(metaPath)) {
      if (isProduction) {
        throw new Error(
          'UI_BUILD_META_MISSING: ui_build_meta.json not found at ' + metaPath + 
          '. Did you run "node tools/build_meta.mjs" before building?'
        );
      }
      // In dev mode, allow default
      return { uiSha: 'dev', uiBuildTime: 'dev' };
    }

    const content = fs.readFileSync(metaPath, 'utf8');
    const parsed = JSON.parse(content);
    
    // NEW CONTRACT: Use UI_GIT_SHA (40-hex) instead of FT_BUILD_SHA
    const uiSha = parsed.UI_GIT_SHA;
    const uiBuildTime = parsed.UI_GIT_TIME;
    
    // Validate SHA format: must be exactly 40 hex chars (full git SHA)
    const hexRegex = /^[0-9a-f]{40}$/;
    if (!uiSha || !hexRegex.test(uiSha)) {
      if (isProduction) {
        throw new Error(
          '[FATAL_UI_GIT_SHA_MISSING] UI_GIT_SHA "' + (uiSha || 'undefined') + 
          '" must be exactly 40 hex characters, got ' + (uiSha ? uiSha.length : 0)
        );
      }
      // In dev, allow default
      return { uiSha: 'dev', uiBuildTime: 'dev' };
    }
    
    return { uiSha, uiBuildTime };
  } catch (err) {
    if (isProduction) {
      throw err; // Fail-closed: re-throw in production
    }
    // In dev, log and use default
    console.warn('⚠️  UI build meta not available (dev mode):', err.message);
    return { uiSha: 'dev', uiBuildTime: 'dev' };
  }
}

const { uiSha, uiBuildTime } = loadUiBuildMeta();

export default defineConfig({
  base: './',
  root: __dirname,
  define: {
    // Inject build metadata at compile time (from ui_build_meta.json)
    // __FT_BUILD_SHA__ is the old name, keep for backward compat in main.ts
    '__FT_BUILD_SHA__': JSON.stringify(uiSha),
    '__FT_BUILD_TIME_UTC__': JSON.stringify(uiBuildTime),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: './index.html',
      output: {
        // STABLE FILENAMES: Eliminate content-hash in output to prevent CDN cache 404s.
        // Cache busting is handled by postbuild.mjs which renames to app.<SHA>.js.
        entryFileNames: '[name].js',
        chunkFileNames: 'chunk-[name].js',
        assetFileNames: 'asset-[name][extname]'
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  // CRITICAL FIX: Ensure @forge/bridge is bundled into the output (not externalized)
  // The bridge must be available at runtime, either bundled or injected
  // We bundle it to ensure it's included in the final app.*.js bundle
  optimizeDeps: {
    include: ['@forge/bridge']
  }
});
