import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Backend URL used only for local dev proxy.
  // In production (Vercel), VITE_BACKEND_URL is set as an env var and
  // the frontend calls the backend directly — no proxy needed.
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:5000';

  return {
    plugins: [react(), tailwindcss()],

    define: {
      // Expose GEMINI_API_KEY to the browser bundle
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    build: {
      // Raise the chunk-size warning threshold (Monaco is large)
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            monaco:  ['@monaco-editor/react'],
            react:   ['react', 'react-dom'],
            motion:  ['motion'],
            socket:  ['socket.io-client'],
          },
        },
      },
    },

    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target:      backendUrl,
          changeOrigin: true,
        },
        '/socket.io': {
          target:      backendUrl,
          changeOrigin: true,
          ws:           true,
        },
      },
    },
  };
});
