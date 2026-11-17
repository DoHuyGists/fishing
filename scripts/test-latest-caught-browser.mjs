import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const executablePath = process.env.CACHE_TEST_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium',
].find(existsSync);
let hmrProbeEnabled = false;
const server = await createServer({
  server: { host: '127.0.0.1', port: 0 },
  plugins: [{
    name: 'latest-caught-fixture',
    transform(code, id) {
      if (hmrProbeEnabled && id.replaceAll('\\', '/').endsWith('/src/stores/caught.ts')) {
        return code.replace('getters: {', 'getters: { __caughtHmrProbe: () => "ready",');
      }
    },
    configureServer(instance) {
      instance.middlewares.use('/__caught_test', (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><div id="app" style="width:250px"></div><script type="module" src="/__caught_fixture.js"></script>');
      });
    },
    resolveId(id) { if (id === '/__caught_fixture.js') return id; },
    load(id) {
      if (id !== '/__caught_fixture.js') return;
      return `
        import { createApp } from 'vue';
        import { createPinia } from 'pinia';
        import LatestCaughtList from '/src/components/player/caught/LatestCaughtList.vue';
        import { useCaughtStore } from '/src/stores/caught.ts';
        import { i18n } from '/src/i18n/index.ts';
        import '/src/styles/index.css';
        import '/src/styles/animation.css';
        const pinia = createPinia();
        window.caught = useCaughtStore(pinia);
        const fish = (id, speciesId, name, status = 'in-net') => ({
          id, status, created_at: '2026-11-17T00:00:00Z',
          species: { id: speciesId, name, image: null, rarity: 'COMMON' },
        });
        window.caught.caughtFishes = [
          fish('one', 'carp', 'Carp'), fish('two', 'carp', 'Carp'),
          fish('three', 'tilapia', 'Tilapia'), fish('stored', 'other', 'Stored', 'normal'),
        ];
        createApp(LatestCaughtList).use(pinia).use(i18n).mount('#app');
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
  await page.goto(server.resolvedUrls.local[0] + '__caught_test');
  await page.waitForSelector('[role="tab"]');
  const tabs = page.getByRole('tab');
  const panel = page.locator('[role="tabpanel"]:visible');
  await tabs.nth(2).click();
  await page.waitForTimeout(500);
  console.log('group panel:', await panel.innerText());
  assert.match(await panel.innerText(), /Carp/);
  assert.match(await panel.innerText(), /Tilapia/);
  assert.equal(await panel.locator('img').count(), 2);
  assert.equal(await panel.getByText(/^2 /).count(), 1);
  assert.doesNotMatch(await panel.innerText(), /Stored/);
  for (const index of [0, 1, 2, 0, 2]) {
    await tabs.nth(index).click();
    assert.equal(await panel.locator('img').count(), index === 2 ? 2 : 3);
  }
  await page.evaluate(() => window.caught.caughtFishes.push({
    id: 'four', status: 'in-net', species: { id: 'carp', name: 'Carp' },
  }));
  await page.waitForFunction(() => window.caught.inNetFishGroups[0].count === 3);
  assert.equal(await panel.getByText(/^3 /).count(), 1);
  hmrProbeEnabled = true;
  const modules = server.moduleGraph.getModulesByFile(resolve('src/stores/caught.ts').replaceAll('\\', '/'));
  assert.ok(modules?.size, 'Caught store must be loaded before testing HMR');
  for (const module of modules) await server.reloadModule(module);
  await page.waitForFunction(() => window.caught.__caughtHmrProbe === 'ready');
  assert.equal(await page.evaluate(() => window.caught.caughtFishes.length), 5);
  assert.equal(await panel.getByText(/^3 /).count(), 1);
  assert.deepEqual(errors, []);
  console.log('PASS: list/grid/group switching, species counts, reactive catches and new Pinia getters after HMR at narrow width.');
} finally {
  await browser?.close();
  await server.close();
}
