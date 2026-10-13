import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vite + Vitest configuration.
 * - `@/` resolves to `src/`.
 * - Build output is fully static (dist/), relative base so it can be hosted in any sub-folder.
 * - Vitest runs in a plain Node environment: generators must not touch the DOM or Three.js.
 */
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: 'default',
  },
});
