import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-maplibre': ['maplibre-gl']
        }
      }
    },
    chunkSizeWarningLimit: 1600
  }
});
