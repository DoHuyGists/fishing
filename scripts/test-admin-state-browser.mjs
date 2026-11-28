import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright-core';

const executablePath = process.env.ADMIN_TEST_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium',
].find(existsSync);
if (!executablePath) throw new Error('Set ADMIN_TEST_BROWSER to an installed Chromium browser.');

const server = await createServer({
  configFile: false, envDir: false, appType: 'custom', cacheDir: 'node_modules/.vite-admin-state-browser',
  server: { host: '127.0.0.1', port: 0, hmr: false },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://admin-test.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
  },
  plugins: [vue(), tailwindcss(), {
    name: 'admin-state-fixture',
    configureServer(instance) {
      instance.middlewares.use('/__admin', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><html><head><link rel="icon" href="data:,"></head><body><div id="app"></div><script type="module" src="/__admin_fixture.ts"></script></body></html>');
      });
    },
    resolveId(id) { if (id === '/__admin_fixture.ts') return id; },
    load(id) {
      if (id !== '/__admin_fixture.ts') return;
      return `
        import { createApp, h } from 'vue';
        import { createPinia } from 'pinia';
        import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
        import AdminLayout from '/src/layouts/AdminLayout.vue';
        import AdminView from '/src/views/AdminView.vue';
        import { useAuthStore } from '/src/stores/auth.ts';
        import { useReadCacheStore } from '/src/stores/player-read-cache.ts';
        import { supabaseUserProfileRepository } from '/src/data/supabaseUserProfileRepository.ts';
        import { supabaseZoneRepository, supabaseWeatherRepository, supabaseModifierRepository, supabaseWeatherModifierRepository } from '/src/data/supabaseWeatherRepository.ts';
        import supabase from '/src/database/connection.ts';
        import { i18n } from '/src/i18n/index.ts';
        import '/src/styles/index.css';
        const pinia = createPinia(), auth = useAuthStore(pinia);
        const session = { user: { id: 'admin-owner' }, access_token: 'test-token' };
        let authChange, settleRole, zoneReads = 0, zoneSearch = '', weatherWrites = 0, modifierWrites = 0;
        supabase.auth.onAuthStateChange = callback => { authChange = callback; return { data: { subscription: { unsubscribe() {} } } }; };
        supabase.auth.getSession = async () => ({ data: { session }, error: null });
        useReadCacheStore(pinia).invalidate = async () => {};
        supabaseUserProfileRepository.fetchUserProfile = () => new Promise((resolve, reject) => { settleRole = { resolve, reject }; });
        supabaseZoneRepository.fetchPage = async (_page, search) => {
          zoneReads++;
          zoneSearch = search;
          return { items: [{ id: 'zone', code: 'original', name: 'Original zone' }], total: 1 };
        };
        supabaseWeatherRepository.fetchAll = async () => [{ id: 'weather', code: 'sun', name: 'Sun' }];
        supabaseModifierRepository.fetchAll = async () => [{ id: 'modifier', code: 'strength', name: 'Strength' }];
        let weatherRows = [], rejectWeatherUpdate = true;
        supabaseWeatherRepository.fetchPage = async () => ({ items: structuredClone(weatherRows), total: weatherRows.length });
        supabaseWeatherModifierRepository.fetchPage = async () => ({ items: [], total: 0 });
        supabaseWeatherRepository.create = async payload => {
          weatherWrites++;
          const row = { id: 'weather', ...payload, createdAt: '2026-11-28T00:00:00Z' };
          weatherRows = [row];
          return row;
        };
        supabaseWeatherRepository.update = async (id, payload) => {
          if (rejectWeatherUpdate) { rejectWeatherUpdate = false; throw new Error('Weather update denied by RLS'); }
          weatherRows = [{ ...weatherRows[0], id, ...payload }];
          return weatherRows[0];
        };
        supabaseWeatherModifierRepository.create = async payload => { modifierWrites++; return { id: 'weather-modifier', ...payload }; };
        const router = createRouter({ history: createMemoryHistory(), routes: [
          { path: '/', redirect: '/admin' },
          { path: '/admin', component: AdminLayout, children: [{ path: '', component: AdminView }] },
        ] });
        const app = createApp({ render: () => h(RouterView) });
        app.use(pinia); app.use(i18n); app.use(router);
        await router.push('/admin'); await router.isReady();
        void auth.initialize(); app.mount('#app');
        window.adminTest = {
          auth, get zoneReads() { return zoneReads; }, get zoneSearch() { return zoneSearch; },
          get weatherWrites() { return weatherWrites; }, get modifierWrites() { return modifierWrites; },
          get rolePending() { return Boolean(settleRole); },
          refresh: () => authChange('TOKEN_REFRESHED', session),
          resolveRole(isAdmin) { const pending = settleRole; settleRole = null; pending.resolve({ id: session.user.id, is_admin: isAdmin }); },
          rejectRole() { const pending = settleRole; settleRole = null; pending.reject(new Error('offline')); },
          changeAccount: () => authChange('SIGNED_IN', { user: { id: 'other-owner' } }),
          signOut: () => authChange('SIGNED_OUT', null),
        };
      `;
    },
  }],
});

let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
  page.on('response', response => { if (response.status() >= 400) console.error(response.status(), response.url()); });
  await page.goto(server.resolvedUrls.local[0] + '__admin');
  await page.waitForFunction(() => window.adminTest?.rolePending);
  assert.equal(await page.locator('aside').count(), 0, 'Initial role check must finish before mounting admin');
  await page.evaluate(() => adminTest.resolveRole(true));
  await page.locator('aside').waitFor();

  const dialog = page.getByRole('dialog', { name: 'Quản lý vùng', exact: true });
  async function openDraft() {
    await page.locator('aside').getByRole('button', { name: 'Vùng', exact: true }).click();
    await dialog.waitFor();
    assert.equal(await dialog.getByRole('button', { name: 'Xoá', exact: true }).count(), 1, 'CRUD deletion is available unless explicitly disabled');
    await dialog.getByRole('button', { name: 'Sửa', exact: true }).click();
    await dialog.getByLabel(/^Mã/).fill('unsaved-zone');
    await dialog.getByLabel(/^Tên/).fill('Vùng đang soạn');
  }
  async function refreshRole() {
    await page.evaluate(() => adminTest.refresh());
    await page.waitForFunction(() => adminTest.rolePending && adminTest.auth.adminLoading);
  }
  async function assertDraft() {
    assert.equal(await dialog.isVisible(), true, 'Role refresh must preserve the open module');
    assert.equal(await dialog.getByLabel(/^Mã/).inputValue(), 'unsaved-zone');
    assert.equal(await dialog.getByLabel(/^Tên/).inputValue(), 'Vùng đang soạn');
  }

  await openDraft();
  for (let index = 0; index < 2; index++) {
    await refreshRole();
    await assertDraft();
    await page.evaluate(() => adminTest.resolveRole(true));
    await page.waitForFunction(() => !adminTest.auth.adminLoading);
    await assertDraft();
  }
  assert.equal(await page.evaluate(() => adminTest.zoneReads), 1, 'Refresh must not remount or reload the module');
  await page.evaluate(() => { adminTest.auth.loading = true; });
  await assertDraft();
  await page.evaluate(() => { adminTest.auth.loading = false; });

  await refreshRole();
  await page.evaluate(() => adminTest.resolveRole(false));
  await page.getByText('403', { exact: true }).waitFor();
  assert.equal(await dialog.count(), 0, 'Revoked admin rights must unmount the module');
  await refreshRole();
  await page.evaluate(() => adminTest.resolveRole(true));
  await page.locator('aside').waitFor();
  assert.equal(await dialog.count(), 0, 'Restored access must not restore discarded drafts');

  await openDraft();
  await refreshRole();
  await page.evaluate(() => adminTest.rejectRole());
  await page.getByText('403', { exact: true }).waitFor();
  assert.equal(await dialog.count(), 0, 'A failed authority read must still deny access');
  await refreshRole();
  await page.evaluate(() => adminTest.resolveRole(true));
  await page.locator('aside').waitFor();
  await openDraft();
  await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click();
  await dialog.getByPlaceholder('Tìm kiếm...').fill('Original');
  await page.waitForFunction(() => adminTest.zoneSearch === 'Original');
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.locator('aside').getByRole('button', { name: 'Vùng', exact: true }).click();
  await dialog.waitFor();
  assert.equal(await dialog.getByPlaceholder('Tìm kiếm...').inputValue(), 'Original', 'Reopened search must match the active repository filter');
  await dialog.getByPlaceholder('Tìm kiếm...').fill('');
  await page.waitForFunction(() => adminTest.zoneSearch === '');
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();

  await page.locator('aside').getByRole('button', { name: 'Thời tiết', exact: true }).click();
  const weatherDialog = page.getByRole('dialog', { name: 'Quản lý thời tiết', exact: true });
  await weatherDialog.getByRole('button', { name: '+ Thêm mới', exact: true }).click();
  await weatherDialog.getByLabel(/^Mã/).fill('sun');
  await weatherDialog.getByLabel(/^Tên/).fill('Sun');
  await weatherDialog.getByLabel(/^Độ hiếm/).fill('COMMON');
  await weatherDialog.getByLabel(/^Thời lượng tối thiểu/).fill('-1');
  await weatherDialog.getByLabel(/^Thời lượng tối đa/).fill('5');
  // Dispatch directly so application validation is tested independently of HTML min/max.
  await weatherDialog.locator('form').dispatchEvent('submit');
  await weatherDialog.getByText('"Thời lượng tối thiểu (phút)" nằm ngoài phạm vi hợp lệ', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => adminTest.weatherWrites), 0);
  await weatherDialog.getByLabel(/^Thời lượng tối thiểu/).fill('1');
  await weatherDialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.waitForFunction(() => adminTest.weatherWrites === 1);
  await weatherDialog.locator('form').waitFor({ state: 'detached' });
  await weatherDialog.getByRole('button', { name: 'Sửa', exact: true }).click();
  assert.equal(await weatherDialog.getByLabel(/^Tên/).inputValue(), 'Sun');
  await weatherDialog.getByLabel(/^Tên/).fill('Updated sun');
  await weatherDialog.getByRole('button', { name: 'Huỷ', exact: true }).click();
  await weatherDialog.getByRole('cell', { name: 'Sun', exact: true }).waitFor();
  await weatherDialog.getByRole('button', { name: 'Sửa', exact: true }).click();
  assert.equal(await weatherDialog.getByLabel(/^Tên/).inputValue(), 'Sun', 'Cancelled drafts must not mutate saved rows');
  await weatherDialog.getByLabel(/^Tên/).fill('Updated sun');
  await weatherDialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await weatherDialog.getByRole('alert').getByText('Weather update denied by RLS').waitFor();
  assert.equal(await weatherDialog.getByLabel(/^Tên/).inputValue(), 'Updated sun', 'Failed updates must preserve the draft');
  await weatherDialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await weatherDialog.locator('form').waitFor({ state: 'detached' });
  await weatherDialog.getByRole('cell', { name: 'Updated sun', exact: true }).waitFor();
  await weatherDialog.getByRole('button', { name: 'Đóng', exact: true }).click();

  await page.locator('aside').getByRole('button', { name: 'Chỉ số theo thời tiết', exact: true }).click();
  const modifierDialog = page.getByRole('dialog', { name: 'Chỉ số theo thời tiết', exact: true });
  await modifierDialog.getByRole('button', { name: '+ Thêm mới', exact: true }).click();
  await modifierDialog.getByLabel(/^Thời tiết/).selectOption('weather');
  await modifierDialog.getByLabel(/^Chỉ số/).selectOption('modifier');
  await modifierDialog.getByLabel(/^Giá trị nhỏ nhất/).fill('0');
  await modifierDialog.getByLabel(/^Giá trị lớn nhất/).fill('1');
  for (const chance of ['-0.1', '1.1']) {
    await modifierDialog.getByLabel(/^Tỷ lệ cơ bản/).fill(chance);
    await modifierDialog.locator('form').dispatchEvent('submit');
    await modifierDialog.getByText('"Tỷ lệ cơ bản (0-1)" nằm ngoài phạm vi hợp lệ', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => adminTest.modifierWrites), 0);
  }
  await modifierDialog.getByLabel(/^Tỷ lệ cơ bản/).fill('1');
  await modifierDialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.waitForFunction(() => adminTest.modifierWrites === 1);
  await modifierDialog.locator('form').waitFor({ state: 'detached' });
  await modifierDialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await openDraft();
  await page.evaluate(() => adminTest.changeAccount());
  await page.waitForFunction(() => adminTest.rolePending && adminTest.auth.user.id === 'other-owner');
  assert.equal(await page.locator('aside').count(), 0, 'Account changes must unmount admin immediately');
  assert.equal(await dialog.count(), 0);
  await page.evaluate(() => adminTest.signOut());
  await page.getByText('403', { exact: true }).waitFor();
  await page.evaluate(() => adminTest.resolveRole(true));
  assert.equal(await page.locator('aside').count(), 0, 'Late role responses must not restore a signed-out account');
  assert.deepEqual(errors, []);
  console.log('Admin browser checks passed: permissions, draft preservation, search restoration and weather validation.');
} finally {
  await browser?.close();
  await server.close();
}
