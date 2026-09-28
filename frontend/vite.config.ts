import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const backendPort = process.env.API_BACKEND_PORT || env.API_BACKEND_PORT || '5000';
    return {
      cacheDir: '/private/tmp/nodalx-vite-cache',
      server: {
        proxy: {
          '/api-proxy': {
            target: `http://127.0.0.1:${backendPort}`,
            changeOrigin: true
          },
          '/ws-proxy': {
            target: `ws://127.0.0.1:${backendPort}`,
            ws: true,
            changeOrigin: true
          },
          '/api': {
            target: `http://127.0.0.1:${backendPort}`,
            changeOrigin: true
          },
        },
      },
      plugins: [react()],
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                  return 'vendor-react';
                }
                if (id.includes('lucide-react')) {
                  return 'vendor-icons';
                }
              }
            },
          },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
