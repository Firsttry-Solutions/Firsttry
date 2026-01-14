import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './',
  root: __dirname,
  define: {
    // Inject build metadata at compile time (from env or defaults)
    '__FT_BUILD_SHA__': JSON.stringify(process.env.FT_BUILD_SHA || 'dev'),
    '__FT_BUILD_TIME_UTC__': JSON.stringify(process.env.FT_BUILD_TIME_UTC || 'dev'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: './index.html',
      output: {
        entryFileNames: 'assets/[name].[hash].js',
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
