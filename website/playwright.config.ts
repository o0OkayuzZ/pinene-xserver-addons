import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: './tests',
 timeout: 30000,
 fullyParallel: false,
 workers: 1,
 use: { baseURL: 'http://127.0.0.1:4321/pinene-xserver-addons/', headless: true },
 projects: [
  { name: 'mobile-390', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  { name: 'tablet-768', use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
  { name: 'desktop-1440', use: { viewport: { width: 1440, height: 1000 } } },
 ],
 webServer: { command: 'node scripts/preview-test.mjs', url: 'http://127.0.0.1:4321/pinene-xserver-addons/', reuseExistingServer: true, timeout: 60000 },
 reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
});
