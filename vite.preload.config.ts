import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    outDir: path.resolve(__dirname, '.vite/build/preload'),
    emptyOutDir: false,
    rollupOptions: {
      external: ['electron'],
    },
  },
});
