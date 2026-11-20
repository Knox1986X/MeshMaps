import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Preview is served through an e2b proxy host — allow it.
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2200,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // MapLibre is ~80% of the bundle. Splitting it out lets the panels paint while
        // the map engine is still parsing, and keeps vendor chunks cacheable between builds.
        manualChunks: {
          maplibre: ['maplibre-gl'],
          react: ['react', 'react-dom'],
          motion: ['framer-motion'],
        },
      },
    },
  },
})
