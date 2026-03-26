import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/lab/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
