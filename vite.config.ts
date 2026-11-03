import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
  server: { host: true },
});
