import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const DIR_NAME = dirname(fileURLToPath(import.meta.url));

// Builds the customization layer as one script + stylesheet that the desktop app injects into the official
// Telegram Web (web mode). Run with `npm run build:inject`.
export default defineConfig({
  publicDir: false,
  resolve: {
    alias: [{
      find: /^.*\/lib\/fasterdom\/fasterdom$/,
      replacement: resolve(DIR_NAME, 'src/customization/inject/fasterdomShim.ts'),
    }],
  },
  build: {
    outDir: 'electron/inject',
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: resolve(DIR_NAME, 'src/customization/inject/index.ts'),
      formats: ['iife'],
      name: 'AbudjagramInject',
      fileName: () => 'abudjagram-inject.js',
      cssFileName: 'abudjagram-inject',
    },
  },
});
