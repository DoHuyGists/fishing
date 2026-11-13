import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const executablePath = process.env.HEALTH_TEST_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium',
].find(existsSync);
const owner = '11111111-1111-4111-8111-111111111111';
const rows = [
  { id: 'hat', user_id: owner, data: { name: 'Mũ sinh tồn', category: 'head', classification: 'body', health_bonuses: { morale: 15 }, quantity: 1 } },
  { id: 'vest', user_id: owner, data: { name: 'Áo bảo hộ', category: 'torso', classification: 'body', health_bonuses: { vitality: 20 }, quantity: 1 } },
  { id: 'rod', user_id: owner, data: { name: 'Cần câu', category: 'rod', classification: 'fishing', quantity: 1, max_weight: 30, pull_strength: 5, durability: 80, catch_rate: 0.05, luck_bonus: 2 } },
];
const makeSet = (id, used = false) => ({ id, user_id: owner, created_at: '2026-11-13', is_used: used, head: [], torso: [], hands: [], legs: [], feet: [], accessory: [] });
const bodySets = [makeSet('body-1', true), makeSet('body-2')];
const fishingSets = [true, false].map((used, index) => ({ id: `set-${index + 1}`, user_id: owner, is_used: used, rod: [], line: [], reel: [], hook: [], bait: [] }));
const server = await createServer({
  server: { host: '127.0.0.1', port: 0, hmr: false }, appType: 'custom',
  plugins: [{
    name: 'health-equipment-test',
    configureServer(instance) {
      instance.middlewares.use('/__health', (_request, response) => {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__fixture.ts"></script></body></html>');
      });
    },
    resolveId(id) { if (id === '/__fixture.ts') return id; },
    load(id) {
      if (id !== '/__fixture.ts') return;
      return `
        import { createApp, h } from 'vue';
        import { createPinia } from 'pinia';
        import InventoryModal from '/src/components/player/inventory/InventoryModal.vue';
        import { useAuthStore } from '/src/stores/auth.ts';
        import { useHealthStore } from '/src/stores/health.ts';
        import { useInventoryStore } from '/src/stores/inventory.ts';
        import { useUserProfileStore } from '/src/stores/userProfile.ts';
        import { useModalStore } from '/src/stores/modal.ts';
        import { i18n } from '/src/i18n/index.ts';
        import { setFeatureRequestGuard } from '/src/database/featureRequestGate.ts';
        import { useFeatureAvailabilityStore } from '/src/stores/featureAvailability.ts';
        import { FEATURE_CATALOG } from '/src/data/featureAvailability.ts';
        import '/src/styles/index.css';
        const pinia = createPinia();
        setFeatureRequestGuard(async () => null);
        const features = useFeatureAvailabilityStore(pinia); features.ready = true;
        features.flags = Object.fromEntries(FEATURE_CATALOG.map(feature => [feature.key, { feature_key: feature.key, enabled: true }]));
        const auth = useAuthStore(pinia); auth.user = { id: '${owner}' }; auth.initialized = true;
        useUserProfileStore(pinia).profile = { id: '${owner}', equipment_capacity: 10 };
        const modal = useModalStore(pinia); modal.modalOpening = 'inventory';
        createApp({ render: () => modal.isOpening('inventory') || modal.isOpening('body') ? h(InventoryModal, { compact: true, initialTab: modal.isOpening('body') ? 'health' : 'fishing' }) : null }).use(pinia).use(i18n).mount('#app');
        window.health = useHealthStore(pinia); window.inventory = useInventoryStore(pinia); window.healthI18n = i18n; window.healthModal = modal;
      `;
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = [], reads = [], mutations = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' || /\[intlify\]/.test(message.text())) errors.push(message.text()); });
  await page.route('**/rest/v1/**', route => {
    const request = route.request(), url = request.url();
    if (url.includes('rpc/get_all_user_equipment_sets')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fishingSets) });
    if (url.includes('/user_body_equipments?')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bodySets) });
    if (!['GET', 'HEAD'].includes(request.method())) mutations.push(url);
    if (url.includes('rpc/save_equipment_set')) {
      const args = request.postDataJSON(), set = fishingSets.find(set => set.id === args.p_set_id);
      for (const slot of ['rod','line','reel','hook','bait']) set[slot] = args['p_' + slot];
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.includes('rpc/switch_equipment')) {
      for (const set of fishingSets) set.is_used = set.id === request.postDataJSON().p_id;
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.includes('rpc/save_body_equipment_set')) {
      const args = request.postDataJSON(), set = bodySets.find(set => set.id === args.p_set_id);
      for (const slot of ['head','torso','hands','legs','feet','accessory']) set[slot] = args['p_' + slot];
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.includes('rpc/switch_body_equipment')) {
      for (const set of bodySets) set.is_used = set.id === request.postDataJSON().p_set_id;
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.includes('rpc/create_body_equipment_set')) {
      const set = makeSet('body-' + (bodySets.length + 1)); bodySets.push(set);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(set) });
    }
    if (url.includes('/user_inventory?')) {
      reads.push(url);
      const classification = new URL(url).searchParams.get('data->>classification')?.replace(/^eq\./, '');
      const filtered = classification ? rows.filter(row => row.data.classification === classification) : rows;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Content-Range': `0-${Math.max(0, filtered.length - 1)}/${filtered.length}`, 'Access-Control-Expose-Headers': 'Content-Range' }, body: request.method() === 'HEAD' ? '' : JSON.stringify(filtered) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.goto(server.resolvedUrls.local[0] + '__health');
  const fishingTab = page.getByRole('tab', { name: 'Công cụ câu', exact: true });
  const healthTab = page.getByRole('tab', { name: 'Sức khỏe & trang bị', exact: true });
  await fishingTab.waitFor();
  assert.equal(await fishingTab.getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#user-inventory').count(), 1);
  assert.deepEqual(await page.evaluate(() => window.inventory.viewItems.map(item => item.id)), ['rod']);
  assert.ok(reads.some(url => new URL(url).searchParams.get('data->>classification') === 'eq.fishing'));
  const fishingSummary = page.getByRole('region', { name: 'Chỉ số trang bị câu', exact: true });
  assert.equal(await fishingSummary.locator('output').count(), 5);
  assert.equal(await fishingSummary.locator('output[aria-label="Tải trọng tối đa"]').textContent(), '0 kg');
  // A draft fishing set survives switching to body equipment and back.
  await page.locator('#set-0-slot-0').click();
  const rodCard = page.locator('#user-inventory .font-medium').getByText('Cần câu', { exact: true });
  await rodCard.click();
  assert.equal(await page.evaluate(() => window.inventory.equipmentSets[0].rod.length), 1);
  assert.equal(await page.evaluate(() => window.inventory.activeFishingStats.max_weight), 0);
  const firstFishingSet = page.locator('#user-equipment-sets article').nth(0);
  const secondFishingSet = page.locator('#user-equipment-sets article').nth(1);
  await firstFishingSet.getByRole('button', { name: 'Lưu set', exact: true }).click();
  await page.waitForFunction(() => window.inventory.activeFishingStats.max_weight === 30);
  assert.equal(await fishingSummary.locator('output[aria-label="Tải trọng tối đa"]').textContent(), '30 kg');
  assert.equal(await fishingSummary.locator('output[aria-label="Thưởng tỷ lệ móc cá"]').textContent(), '5%');
  await firstFishingSet.getByRole('button', { name: 'Gỡ Cần câu khỏi set', exact: true }).click();
  assert.equal(await page.evaluate(() => window.inventory.activeFishingStats.max_weight), 30);
  await secondFishingSet.getByRole('radio').click();
  await page.waitForFunction(() => window.inventory.activeFishingStats.max_weight === 0);
  await firstFishingSet.getByRole('radio').click();
  await page.waitForFunction(() => window.inventory.activeFishingStats.max_weight === 30);
  await page.locator('#set-0-slot-0').click(); await rodCard.click();
  const readsBefore = reads.length;
  await page.getByRole('checkbox', { name: 'Chọn Cần câu để xóa', exact: true }).check();
  await page.evaluate(() => { window.inventory.viewPage = 3; });
  await page.evaluate(() => { window.sharedListNode = document.querySelector('#user-inventory'); });
  await healthTab.click();
  assert.equal(await page.evaluate(() => window.sharedListNode === document.querySelector('#user-inventory')), true);
  await page.waitForFunction(() => window.inventory.viewItems.length === 2 && window.inventory.viewItems.every(item => item.data.classification === 'body'));
  assert.ok(reads.length > readsBefore);
  assert.ok(reads.some(url => new URL(url).searchParams.get('data->>classification') === 'eq.body'));
  assert.equal(await page.evaluate(() => window.inventory.viewPage), 1);
  assert.equal(await page.getByRole('button', { name: /Xóa đã chọn/ }).isDisabled(), true);
  assert.equal(await page.locator('#user-inventory .font-medium').getByText('Cần câu', { exact: true }).count(), 0);
  assert.equal(await page.locator('output:visible').count(), 5);
  assert.equal(await page.locator('svg[viewBox="0 0 200 470"]').count(), 0);
  assert.ok(await page.evaluate(() => window.health.stats.every(stat => stat.value === 0)));
  assert.equal(await page.getByRole('button', { name: 'Trang bị Mũ sinh tồn', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Set 1: chọn ô Đầu', exact: true }).click();
  await page.getByRole('button', { name: 'Trang bị Mũ sinh tồn', exact: true }).click();
  assert.equal(await page.evaluate(() => window.health.bonuses.morale), 0);
  const firstSet = page.locator('article').filter({ has: page.getByRole('button', { name: 'Set 1: chọn ô Đầu', exact: true }) });
  await firstSet.getByRole('button', { name: 'Lưu set', exact: true }).click();
  await page.waitForFunction(() => window.health.bonuses.morale === 15);
  await page.getByRole('button', { name: 'Set 1: chọn ô Thân', exact: true }).click();
  await page.getByRole('button', { name: 'Trang bị Áo bảo hộ', exact: true }).click();
  await firstSet.getByRole('button', { name: 'Lưu set', exact: true }).click();
  await page.waitForFunction(() => window.health.bonuses.vitality === 20);
  const secondSet = page.locator('article').filter({ has: page.getByRole('button', { name: 'Set 2: chọn ô Đầu', exact: true }) });
  await secondSet.getByRole('radio').check();
  await page.waitForFunction(() => window.health.stats.every(stat => stat.value === 0));
  await firstSet.getByRole('radio').check();
  await page.waitForFunction(() => window.health.bonuses.vitality === 20);
  // The shared delete flow protects references in every body set.
  const mutationsBeforeDelete = mutations.length;
  await page.getByRole('checkbox', { name: 'Chọn Mũ sinh tồn để xóa', exact: true }).check();
  await page.getByRole('button', { name: /Xóa đã chọn/ }).click();
  await page.getByRole('button', { name: 'Xóa', exact: true }).click();
  assert.equal(mutations.length, mutationsBeforeDelete);
  await page.getByRole('button', { name: 'Hủy', exact: true }).last().click();
  await page.getByRole('button', { name: 'Tháo Mũ sinh tồn', exact: true }).click();
  assert.equal(await page.evaluate(() => window.health.bonuses.morale), 15);
  await firstSet.getByRole('button', { name: 'Lưu set', exact: true }).click();
  await page.waitForFunction(() => window.health.bonuses.morale === 0);
  await page.getByRole('button', { name: 'Thêm set', exact: true }).click();
  await page.waitForFunction(() => window.health.sets.length === 3);
  await fishingTab.click();
  await page.waitForFunction(() => window.inventory.viewItems.length === 1 && window.inventory.viewItems[0].data.classification === 'fishing');
  assert.equal(await page.evaluate(() => window.inventory.equipmentSets[0].rod.length), 1);
  await healthTab.click();
  await page.screenshot({ path: join(tmpdir(), 'fishing-health-equipment-desktop.png'), fullPage: true });
  await page.evaluate(() => { window.healthI18n.global.locale.value = 'en'; });
  await page.getByRole('tab', { name: 'Health & equipment', exact: true }).waitFor();
  await page.locator('output[aria-label="Morale"]').waitFor();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.screenshot({ path: join(tmpdir(), 'fishing-health-equipment-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.evaluate(() => { window.healthModal.modalOpening = 'body'; });
  assert.equal(await page.getByRole('tab', { name: 'Health & equipment', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#user-inventory').count(), 1);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.ok(reads.length > 0); assert.ok(mutations.length >= 8); assert.ok(mutations.every(url => /rpc\/(save_body_equipment_set|switch_body_equipment|create_body_equipment_set|save_equipment_set|switch_equipment)/.test(url))); assert.deepEqual(errors, []);
  console.log('Inventory tabs passed: shared inventory, fishing drafts, body set save/switch/create, committed totals, deletion guard, mobile, translations and close.');
} finally { await browser?.close(); await server.close(); }
