import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const target = process.env.VITE_DEV_API || "http://localhost:5000";
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target, changeOrigin: true },
      '/uploads': { target, changeOrigin: true },
      '/socket.io': { target, ws: true, changeOrigin: true },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: { output: { manualChunks(id) { if (id.includes('node_modules')) { if (/react|react-dom|react-router/.test(id)) return 'vendor'; if (/socket\.io|engine\.io|axios|react-hook-form/.test(id)) return 'libs'; } } } },
  },
});
