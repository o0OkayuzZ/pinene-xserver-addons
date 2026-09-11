import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://o0OkayuzZ.github.io',
  base: '/pine-server',
  trailingSlash: 'always',
  output: 'static',
  vite: { build: { sourcemap: false } },
});