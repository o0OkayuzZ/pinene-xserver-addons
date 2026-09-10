import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://o0OkayuzZ.github.io',
  base: '/pinene-xserver-addons',
  trailingSlash: 'always',
  output: 'static',
  vite: { build: { sourcemap: false } },
});