import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron', 'fs', 'path', 'os', 'crypto', 'stream', 'util', 'events', 'net', 'tls', 'http', 'https', 'url', 'zlib', 'buffer', 'child_process'],
    },
  },
  resolve: {
    conditions: ['node'],
  },
});
