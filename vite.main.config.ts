import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    outDir: path.resolve(__dirname, '.vite/build/main'),
    emptyOutDir: false,
    rollupOptions: {
      external: ['electron', 'fs', 'path', 'os', 'crypto', 'stream', 'util', 'events', 'net', 'tls', 'http', 'https', 'url', 'zlib', 'buffer', 'child_process'],
    },
  },
  resolve: {
    conditions: ['node'],
  },
});
