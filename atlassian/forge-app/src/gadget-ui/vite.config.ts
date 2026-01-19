import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

// Load UI build metadata (injected by tools/build_meta.mjs at build time)
// FAIL-CLOSED: In production, throw if metadata is missing or invalid
// (Allow "dev" only in local development)
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
    
    const uiSha = parsed.FT_BUILD_SHA;
    const uiBuildTime = parsed.FT_BUILD_TIME_UTC;
    
    // Validate SHA format
    const hexRegex = /^[0-9a-f]{7,40}$/;
    if (!uiSha || !hexRegex.test(uiSha)) {
      if (isProduction) {
        throw new Error(
          'UI_GIT_SHA_INVALID: FT_BUILD_SHA "' + (uiSha || 'undefined') + 
          '" does not match expected format /^[0-9a-f]{7,40}$/'
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
    '__FT_BUILD_SHA__': JSON.stringify(uiSha),
    '__FT_BUILD_TIME_UTC__': JSON.stringify(uiBuildTime),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: './index.html',
      output: {
        // CACHE-BUST: Keep hashed names in assets folder, but also output stable app.js for query param cache-busting
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]'
      }
    }
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname
    }
  }
});
