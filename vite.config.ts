import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // The Worker is mounted at /homegame, so keep the built asset tree under
  // the same prefix for Cloudflare's path-based static asset routing.
  base: '/homegame/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: 'dist/homegame',
    sourcemap: false,
    rollupOptions: {
      output: {
        // The animation runtime changes far less often than the app does, so it
        // gets its own chunk and stays in cache across deploys.
        manualChunks: {
          motion: ['motion/react'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
