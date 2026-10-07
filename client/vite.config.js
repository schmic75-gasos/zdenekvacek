import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: {
    proxy: { '/api': 'http://localhost:3000', '/photos': 'http://localhost:3000', '/games': 'http://localhost:3000' },
  },
});
