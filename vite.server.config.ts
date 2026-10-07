import path from 'path';
import { defineConfig } from 'vite';

/**
 * Build configuration for the REST API server.
 *
 * The server is bundled for Node.js (SSR target). `pdfmake` is bundled as well
 * because the library imports its browser build, which Node.js cannot resolve
 * on its own.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  ssr: {
    noExternal: ['pdfmake'],
    target: 'node',
  },
  build: {
    ssr: true,
    target: 'node22',
    outDir: path.resolve(__dirname, 'dist-server'),
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/server/main.ts'),
      output: {
        format: 'es',
        entryFileNames: 'main.js',
      },
    },
  },
});
