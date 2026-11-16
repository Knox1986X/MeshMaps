import { defineConfig } from 'vite';

// Relative base so the same build works inside Capacitor (file/https origin)
// and inside Tauri (asset protocol).
export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    // maplibre-gl is large; keep it in its own chunk for better caching
    rollupOptions: {
      output: { manualChunks: { maplibre: ['maplibre-gl'] } },
    },
  },
  worker: { format: 'es' },
});
