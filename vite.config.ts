import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 8080,
    host: true,
  },
  build: {
    target: 'es2022',
  },
});
