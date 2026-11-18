import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright-core';

const executablePath = process.env.SPECIES_TEST_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium',
].find(existsSync);
if (!executablePath) throw new Error('Set SPECIES_TEST_BROWSER to an installed Chromium browser.');
const server = await createServer({ configFile: false, envDir: false, appType: 'custom',
  cacheDir: 'node_modules/.vite-species-browser', server: { host: '127.0.0.1', port: 0, hmr: false },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://species-test.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key') },
  plugins: [vue(), tailwindcss(), {
    name: 'species-distribution-fixture',
    configureServer(instance) {
      instance.middlewares.use('/__species', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__species_fixture.ts"></script></body></html>');
      });
    },
    resolveId(id) { if (id === '/__species_fixture.ts') return id; },
    load(id) {
      if (id !== '/__species_fixture.ts') return;
      return `
        import { createApp, h } from 'vue';
        import { createPinia } from 'pinia';
        import Management from '/src/components/admin/species-in-area-management/SpeciesInAreaManagement.vue';
        import { useSpeciesInAreaStore } from '/src/components/admin/species-in-area-management/admin-species-in-area-store.ts';
        import { supabaseSpeciesInAreaRepository as repository } from '/src/data/supabaseSpeciesInAreaRepository.ts';
        import { supabaseFishingAreaRepository as areas } from '/src/data/supabaseFishingAreaRepository.ts';
        import { supabaseSpeciesRepository as species } from '/src/data/supabaseSpeciesRepository.ts';
        import { useDepthScopeStore } from '/src/components/admin/depth-scope-management/admin-depth-scope-store.ts';
        import { i18n } from '/src/i18n/index.ts';
        import '/src/styles/index.css';
        const pinia = createPinia();
        const store = useSpeciesInAreaStore(pinia);
        const makeRow = (areaId, i) => ({ id: areaId + i, areaId, speciesId: 'fish-' + i, depthScopeId: null, boundary: null, weightRate: i === 0 ? 0 : i * 10, speciesName: 'Loài cá ' + i, areaTitle: areaId === 'a' ? 'Bãi câu A' : 'Bãi câu B', areaCountryId: null, speciesImage: null, speciesRarity: 'COMMON' });
        const lakeA = Array.from({ length: 12 }, (_, i) => makeRow('a', i));
        const lakeB = Array.from({ length: 3 }, (_, i) => makeRow('b', i));
        window.speciesCalls = []; window.speciesFailure = false;
        repository.fetchPage = async () => ({ items: [...lakeA.slice(0, 8), ...lakeB.slice(0, 2)].map(row => ({ ...row })), total: 15, facets: { area_id: ['a', 'b'], species_id: lakeA.map(row => row.speciesId) } });
        repository.fetchDistribution = async id => (id === 'a' ? lakeA : lakeB).map(row => ({ ...row }));
        repository.updateDistribution = async (area, weights) => {
          if (window.speciesFailure) throw new Error('Không thể lưu thử nghiệm');
          window.speciesCalls.push({ area, weights });
          for (const row of area === 'a' ? lakeA : lakeB) {
            const value = weights.find(w => w.speciesId === row.speciesId);
            row.weightRate = value.weightRate;
            row.boundary = JSON.parse(JSON.stringify(value.boundary));
          }
        };
        areas.fetchAllAreasAdmin = async () => [{ id: 'a', title: 'Bãi câu A' }, { id: 'b', title: 'Bãi câu B' }];
        species.fetchAll = async () => lakeA.map(row => ({ id: row.speciesId, name: row.speciesName }));
        useDepthScopeStore(pinia).fetchOptions = async () => {};
        window.speciesStore = store;
        createApp({ render: () => h(Management) }).use(pinia).use(i18n).mount('#app');
      `;
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/rest/v1/**', route => route.abort());
  await page.goto(server.resolvedUrls.local[0] + '__species');
  const charts = page.locator('section[aria-busy]');
  await page.waitForFunction(() => speciesStore.distributions.a?.loaded && speciesStore.distributions.b?.loaded);
  const a = charts.nth(0), b = charts.nth(1);
  assert.equal(await a.locator('input[type=number]').count(), 12, 'the page only contains eight rows of lake A');
  assert.equal(await b.locator('input[type=number]').count(), 3);
  const ids = await page.locator('clipPath').evaluateAll(nodes => nodes.map(node => node.id));
  assert.equal(new Set(ids).size, 2);
  await a.getByLabel('Tỉ trọng Loài cá 0', { exact: true }).fill('15');
  await a.getByRole('button', { name: 'Lưu phân bổ', exact: true }).click();
  await a.getByRole('status').waitFor();
  assert.equal(await page.evaluate(() => speciesCalls[0].weights.length), 12);
  assert.equal(await page.evaluate(() => speciesStore.rows[0].weightRate), 15);
  assert.equal(await b.getByRole('button', { name: 'Lưu phân bổ', exact: true }).isDisabled(), true);
  // Real pointer capture: drag a seed, then grow its cell with the square handle.
  const originalTotal = await page.evaluate(() => Object.values(speciesStore.distributions.a.weights).reduce((a, b) => a + b, 0));
  const seed = a.locator('circle').nth(1);
  const box = await seed.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2 + 20, { steps: 6 });
  await page.mouse.up();
  assert.equal(await a.getByRole('button', { name: 'Lưu phân bổ', exact: true }).isEnabled(), true);
  const handle = a.locator('svg rect');
  const handleBox = await handle.boundingBox();
  await page.mouse.move(handleBox.x + 7, handleBox.y + 7); await page.mouse.down();
  await page.mouse.move(handleBox.x + 37, handleBox.y + 7, { steps: 4 }); await page.mouse.up();
  const total = await page.evaluate(() => Object.values(speciesStore.distributions.a.weights).reduce((a, b) => a + b, 0));
  assert.ok(Math.abs(total - originalTotal) < 1e-8);
  // A vertical radius drag must also resize the region, as in the original map.
  await a.locator('circle.cursor-grab').last().click();
  const radialHandle = a.getByLabel(/Điều chỉnh bán kính vùng/);
  await radialHandle.scrollIntoViewIfNeeded();
  const radial = await radialHandle.boundingBox();
  const beforeVertical = await page.evaluate(() => ({ ...speciesStore.distributions.a.weights }));
  await page.mouse.move(radial.x + radial.width / 2, radial.y + radial.height / 2);
  await page.mouse.down();
  await page.mouse.move(radial.x + radial.width / 2, radial.y + radial.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  assert.notDeepEqual(await page.evaluate(() => ({ ...speciesStore.distributions.a.weights })), beforeVertical);
  assert.equal(await a.locator('circle[stroke-dasharray]').count(), 1);
  const radiusBeforeInput = Number(await a.locator('circle[stroke-dasharray]').getAttribute('r'));
  await a.getByLabel('Tỉ trọng Loài cá 11', { exact: true }).fill('250');
  const radiusAfterInput = Number(await a.locator('circle[stroke-dasharray]').getAttribute('r'));
  assert.notEqual(radiusAfterInput, radiusBeforeInput, 'the radius is recalculated from influence when numeric weights change');
  await page.evaluate(() => { window.speciesFailure = true; });
  await a.getByRole('button', { name: 'Lưu phân bổ', exact: true }).click();
  await a.getByRole('alert').filter({ hasText: 'Không thể lưu thử nghiệm' }).waitFor();
  await a.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
  assert.equal(await a.getByRole('button', { name: 'Lưu phân bổ', exact: true }).isDisabled(), true);
  await a.getByLabel('Tỉ trọng Loài cá 0', { exact: true }).fill('');
  assert.equal(await a.getByRole('button', { name: 'Lưu phân bổ', exact: true }).isDisabled(), true);
  await a.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
  await page.evaluate(() => { window.speciesFailure = false; });
  const weightsBeforeBoundary = await page.evaluate(() => ({ ...speciesStore.distributions.a.weights }));
  for (const preset of ['Bầu dục', 'Tròn', 'Chữ nhật', 'Vuông', 'Bo góc', 'Lục giác']) {
    await a.getByRole('button', { name: preset, exact: true }).click();
    assert.deepEqual(await page.evaluate(() => ({ ...speciesStore.distributions.a.weights })), weightsBeforeBoundary);
  }
  await a.getByRole('button', { name: 'Tròn', exact: true }).click();
  await a.getByLabel('Chiều rộng vòng biên', { exact: true }).focus();
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => speciesStore.distributions.a.boundary.width), 161);
  assert.equal(await page.evaluate(() => speciesStore.distributions.a.boundary.height), 161);
  await a.getByRole('button', { name: 'Chữ nhật', exact: true }).click();
  await a.getByRole('button', { name: 'Chỉnh vòng biên', exact: true }).click();
  assert.equal(await a.locator('circle.cursor-grab').count(), 12, 'region handles remain available while editing the lake');
  const widthHandle = await a.getByLabel('Kéo chiều rộng vòng biên', { exact: true }).boundingBox();
  await page.mouse.move(widthHandle.x + widthHandle.width / 2, widthHandle.y + widthHandle.height / 2);
  await page.mouse.down(); await page.mouse.move(widthHandle.x - 30, widthHandle.y + widthHandle.height / 2, { steps: 4 }); await page.mouse.up();
  assert.ok(await page.evaluate(() => speciesStore.distributions.a.boundary.width < 490));
  await a.getByRole('button', { name: 'Tự nhiên', exact: true }).click();
  const node = a.getByLabel('Node vòng biên 1', { exact: true });
  const nodeBox = await node.boundingBox();
  const originalNode = await page.evaluate(() => ({ ...speciesStore.distributions.a.boundary.nodes[0] }));
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2);
  await page.mouse.down(); await page.mouse.move(nodeBox.x - 15, nodeBox.y + 10, { steps: 3 }); await page.mouse.up();
  assert.notDeepEqual(await page.evaluate(() => ({ ...speciesStore.distributions.a.boundary.nodes[0] })), originalNode);
  await a.getByRole('button', { name: 'Xóa node', exact: true }).click();
  assert.equal(await page.evaluate(() => speciesStore.distributions.a.boundary.nodes.length), 11);
  await a.getByRole('button', { name: 'Thêm node', exact: true }).click();
  assert.equal(await page.evaluate(() => speciesStore.distributions.a.boundary.nodes.length), 12);
  const edgePoint = await a.locator('svg > polygon').evaluate(element => {
    const [x, y] = element.getAttribute('points').split(' ')[4].split(',').map(Number);
    const point = new DOMPoint(x, y).matrixTransform(element.ownerSVGElement.getScreenCTM());
    return { x: point.x, y: point.y };
  });
  await page.mouse.dblclick(edgePoint.x, edgePoint.y);
  assert.equal(await page.evaluate(() => speciesStore.distributions.a.boundary.nodes.length), 13);
  assert.deepEqual(await page.evaluate(() => ({ ...speciesStore.distributions.a.weights })), weightsBeforeBoundary);
  await a.getByRole('button', { name: 'Lưu phân bổ', exact: true }).click();
  await a.getByRole('status').waitFor();
  const customBoundary = await page.evaluate(() => JSON.parse(JSON.stringify(speciesStore.distributions.a.boundary)));
  await a.getByRole('button', { name: 'Tải lại phân bổ', exact: true }).click();
  await page.waitForFunction(() => speciesStore.distributions.a?.loaded);
  assert.deepEqual(await page.evaluate(() => JSON.parse(JSON.stringify(speciesStore.distributions.a.boundary))), customBoundary);
  assert.equal(await a.getByRole('button', { name: 'Lưu phân bổ', exact: true }).isDisabled(), true);
  await a.getByRole('button', { name: 'Ngẫu nhiên', exact: true }).click();
  assert.notDeepEqual(await page.evaluate(() => JSON.parse(JSON.stringify(speciesStore.distributions.a.boundary))), customBoundary);
  await a.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => JSON.parse(JSON.stringify(speciesStore.distributions.a.boundary))), customBoundary);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const viewport = await a.locator('svg').boundingBox();
  assert.ok(viewport.width > 200 && viewport.x + viewport.width <= 390);
  // All-zero and single-positive lakes are editable, with no phantom regions.
  await page.evaluate(() => {
    const state = speciesStore.distributions.a;
    speciesStore.setDistributionWeights('a', Object.fromEntries(state.rows.map(row => [row.speciesId, 0])));
  });
  await a.getByText('Chưa có loài có tỉ trọng lớn hơn 0', { exact: true }).waitFor();
  await a.getByLabel('Tỉ trọng Loài cá 0', { exact: true }).fill('1');
  assert.equal(await a.locator('svg g[clip-path] polygon').count(), 1);
  assert.deepEqual(errors, []);
  console.log('Species distribution browser checks passed: full groups, isolated save, drag/resize, presets, boundary nodes, persistence/reload, rollback, invalid/zero weights, mobile.');
} finally {
  await browser?.close(); await server.close();
}
