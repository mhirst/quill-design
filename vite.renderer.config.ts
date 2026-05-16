import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vite adds crossorigin="crossorigin" to script/link tags which breaks
// file:// loading in Electron production builds. Strip it from the output HTML.
function removeCrossorigin(): Plugin {
  return {
    name: 'remove-crossorigin',
    transformIndexHtml(html) {
      return html
        .replace(/\s+crossorigin="?crossorigin"?/gi, '')
        .replace(/\s+crossorigin(?=[\s/>])/gi, '');
    },
  };
}

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  plugins: [react(), removeCrossorigin()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  css: {
    postcss: path.resolve(__dirname, 'postcss.config.ts'),
  },
  // Proxy /api → Express dev server so there's zero CORS friction
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, '.vite/renderer/main_window'),
    emptyOutDir: false,
  },
});
