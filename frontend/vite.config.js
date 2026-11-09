import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api is proxied to Pardhanadh's Express server (change the port if needed).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080/ords/dcvs',
        changeOrigin: true,
      },
    },
  },
});
