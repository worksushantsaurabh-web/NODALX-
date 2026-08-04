import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
      cacheDir: '/private/tmp/nodalx-vite-cache',
      define: {
        // This is just generic value for the GEMINI API key.
        // This is not used at all, and can be ignored!
        'process.env.API_KEY' : JSON.stringify('api-key-this-is-not-used-can-be-ignored!'),
      },
      server: {
        proxy: {
          //Target your Node.js backend
          '/api-proxy': {
            target: 'http://127.0.0.1:5001',
            changeOrigin: true
          },
          '/ws-proxy': {
            target: 'ws://127.0.0.1:5001',
            ws: true,
            changeOrigin: true
          },
          '/api': {
            target: 'http://127.0.0.1:5001',
            changeOrigin: true
          },
        },
      },
      plugins: react(),
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
