import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { chromium } from 'playwright-core';

const executablePath = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium',
].find(existsSync);
const server = await createServer({
  configFile: false, envDir: false, appType: 'custom',
  server: { host: '127.0.0.1', port: 0, hmr: false },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://admin-test.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
  },
  plugins: [vue(), {
    name: 'fishing-area-views-fixture',
    configureServer(instance) {
      instance.middlewares.use('/__area', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<div id="app"></div><script type="module" src="/__area_fixture.ts"></script>');
      });
    },
    resolveId(id) { if (id === '/__area_fixture.ts') return id; },
    load(id) {
      if (id !== '/__area_fixture.ts') return;
      return `
        import { createApp } from 'vue';
        import { createPinia } from 'pinia';
        import Management from '/src/components/admin/admin-fishing-area/FishingAreaManagement.vue';
        import { supabaseFishingAreaRepository as repository } from '/src/data/supabaseFishingAreaRepository.ts';
        import { i18n } from '/src/i18n/index.ts';
        repository.fetchAdminPage = async (page) => ({
          items: Array.from({ length: page === 1 ? 10 : 4 }, (_, index) => ({ id: String((page - 1) * 10 + index), countryId: page === 2 && index >= 2 ? (index === 2 ? null : '') : (index % 2 ? 'US' : 'VN'), title: 'Area ' + index, scenePath: '', createdAt: '', fishingBoundary: [] })),
          total: 14, facets: { country_id: ['VN', 'US', null] },
        });
        createApp(Management).use(createPinia()).use(i18n).mount('#app');
      `;
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__area`);
  await page.getByRole('button', { name: 'Theo quốc gia', exact: true }).click();
  await page.waitForTimeout(300);
  assert.deepEqual(errors, []);
  assert.equal(await page.locator('section[aria-label="Vietnam"] article').count(), 6);
  assert.equal(await page.locator('section[aria-label="United States"] article').count(), 6);
  assert.equal(await page.locator('section[aria-label="Chưa có quốc gia"] article').count(), 2);
  await page.getByRole('button', { name: 'Lưới', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('article').length === 10);
  assert.equal(await page.locator('article').count(), 10);
  await page.getByRole('button', { name: 'Danh sách', exact: true }).click();
  assert.equal(await page.locator('tbody tr').count(), 10);
  assert.deepEqual(errors, []);
  console.log('Fishing area view modes passed.');
} finally {
  await browser?.close();
  await server.close();
}
