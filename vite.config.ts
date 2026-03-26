import { defineConfig } from 'vite';

export default defineConfig({
  base: '/lab/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
