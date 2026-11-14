import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright-core';

const executablePath = process.env.DISPATCH_TEST_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium',
].find(existsSync);
if (!executablePath) throw new Error('Set DISPATCH_TEST_BROWSER to an installed Chromium browser.');
const server = await createServer({ configFile: false, envDir: false, appType: 'custom',
  server: { host: '127.0.0.1', port: 0, hmr: false },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://dispatch-test.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key') },
  plugins: [vue(), tailwindcss(), {
    name: 'dispatch-test',
    configureServer(instance) {
      instance.middlewares.use('/__dispatch', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__dispatch_fixture.ts"></script></body></html>');
      });
    },
    resolveId(id) { if (id === '/__dispatch_fixture.ts') return id; },
    load(id) {
      if (id !== '/__dispatch_fixture.ts') return;
      return `
        import { createApp, h } from 'vue';
        import { createPinia } from 'pinia';
        import FeatureTable from '/src/components/player/world-map/FeatureTable.vue';
        import DispatchModal from '/src/components/player/dispatch/DispatchModal.vue';
        import { useAuthStore } from '/src/stores/auth.ts';
        import { useModalStore } from '/src/stores/modal.ts';
        import { useDispatchStore } from '/src/stores/dispatch.ts';
        import { useCurrencyStore } from '/src/stores/currency.ts';
        import { useFeatureAvailabilityStore } from '/src/stores/featureAvailability.ts';
        import { FEATURE_CATALOG } from '/src/data/featureAvailability.ts';
        import { setFeatureRequestGuard } from '/src/database/featureRequestGate.ts';
        import { supabaseDispatchRepository as repository } from '/src/data/supabaseDispatchRepository.ts';
        import { i18n } from '/src/i18n/index.ts';
        import '/src/styles/index.css';
        const pinia = createPinia();
        const auth = useAuthStore(pinia); auth.user = { id: 'owner' }; auth.initialized = true;
        const features = useFeatureAvailabilityStore(pinia); features.ready = true;
        features.flags = Object.fromEntries(FEATURE_CATALOG.map(f => [f.key, { feature_key: f.key, enabled: true }]));
        setFeatureRequestGuard(async () => null);
        const modal = useModalStore(pinia), store = useDispatchStore(pinia), wallet = useCurrencyStore(pinia);
        wallet.cash = 1000; wallet.shells = 100;
        const version = new Date().toISOString();
        const npc = { id: 'npc', name: { vi: 'Thủy thủ', en: 'Sailor' }, description: { vi: 'Giỏi khám phá', en: 'An explorer' }, image_path: '', enabled: true, purchase_shells: 20, operating_cash: 100, data: { stats: { strength: 10 } }, updated_at: version };
        const job = { id: 'job', name: { vi: 'Khám phá', en: 'Explore' }, description: {}, image_path: '', enabled: true, duration_seconds: 60, data: { requirements: { strength: 5 } }, rewards: { cash: 150 }, updated_at: version };
        const state = { npcs: [npc], jobs: [job], owned: [], runs: [] };
        const history = []; let counter = 0;
        window.dispatchCalls = []; window.dispatchReads = 0;
        repository.fetchState = async () => { window.dispatchReads++; return structuredClone({ ...state, server_time: new Date().toISOString() }); };
        repository.fetchHistory = async () => ({ items: structuredClone(history), total: history.length });
        repository.execute = async request => {
          window.dispatchCalls.push({ ...request });
          if (request.kind === 'buy') { wallet.shells -= 20; state.owned.push({ id: 'owned', npc_id: npc.id }); }
          if (['claim','repeat','cancel'].includes(request.kind)) {
            const run = state.runs.shift();
            history.unshift({ ...run, id: 'history-' + counter, run_id: run.id, resolved_at: new Date().toISOString(), outcome: request.kind === 'cancel' ? 'cancelled' : 'claimed', rewards: request.kind === 'cancel' ? {} : run.rewards });
            if (request.kind !== 'cancel') wallet.cash += 150;
          }
          if (['start','repeat'].includes(request.kind)) {
            wallet.cash -= 100;
            state.runs.push({ id: 'run-' + ++counter, owned_npc_id: 'owned', job_id: job.id, npc_snapshot: npc, job_snapshot: job, operating_cash: 100, rewards: job.rewards, started_at: new Date(Date.now() - 30000).toISOString(), ends_at: new Date(Date.now() + 30000).toISOString() });
          }
        };
        window.dispatchReady = async () => { state.runs[0].started_at = new Date(Date.now() - 120000).toISOString(); state.runs[0].ends_at = new Date(Date.now() - 1000).toISOString(); await store.refresh(); };
        window.dispatch = store; window.dispatchI18n = i18n;
        createApp({ render: () => [h(FeatureTable), modal.isOpening('dispatch') ? h(DispatchModal) : null] }).use(pinia).use(i18n).mount('#app');
      `;
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (/\[intlify\]/.test(msg.text())) errors.push(msg.text()); });
  await page.route('**/rest/v1/**', route => route.abort());
  await page.goto(server.resolvedUrls.local[0] + '__dispatch');
  await page.getByRole('button', { name: 'Phái NPC', exact: true }).click();
  await page.getByRole('button', { name: 'Mua NPC', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Mua NPC', exact: true });
  await payment.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await page.getByRole('tab', { name: 'Công việc', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Chọn công việc', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn NPC', exact: true }).click();
  const assignment = page.locator('form').filter({ has: page.getByText('Phân công công việc', { exact: true }) });
  await assignment.getByRole('button', { name: 'Giao việc', exact: true }).click();
  await page.getByRole('dialog', { name: 'Giao việc', exact: true }).getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await page.getByRole('progressbar').waitFor();
  assert.ok(Number(await page.getByRole('progressbar').getAttribute('aria-valuenow')) >= 50);
  assert.equal(await page.getByRole('button', { name: 'Lặp lại chu kỳ', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Hủy công việc', exact: true }).count(), 1);
  const reads = await page.evaluate(() => window.dispatchReads);
  await page.waitForTimeout(1100);
  assert.equal(await page.evaluate(() => window.dispatchReads), reads, 'the clock must not poll Supabase');
  await page.evaluate(() => window.dispatchReady());
  assert.equal(await page.getByRole('button', { name: 'Hủy công việc', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Lặp lại chu kỳ', exact: true }).click();
  await page.getByRole('dialog', { name: 'Lặp lại chu kỳ', exact: true }).getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await page.waitForFunction(() => window.dispatchCalls.length === 3 && !window.dispatch.busy);
  assert.equal(await page.getByRole('progressbar').count(), 1);
  await page.evaluate(() => window.dispatchReady());
  await page.getByRole('button', { name: 'Nhận thưởng & giao việc khác', exact: true }).click();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await page.waitForFunction(() => window.dispatch.tab === 'jobs' && !window.dispatch.busy);
  assert.equal(await page.evaluate(() => window.dispatch.selectedNpcId), 'npc');
  // NPC-first assignment uses the same shared selectors.
  await assignment.getByRole('combobox').nth(1).selectOption('job');
  await assignment.getByRole('button', { name: 'Giao việc', exact: true }).click();
  await page.getByRole('dialog', { name: 'Giao việc', exact: true }).getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await page.getByRole('button', { name: 'Hủy công việc', exact: true }).click();
  await page.getByRole('dialog').last().getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await page.waitForFunction(() => window.dispatchCalls.length === 6 && !window.dispatch.busy);
  await page.getByRole('tab', { name: 'Lịch sử', exact: true }).click();
  await page.getByText('Đã hủy · Không hoàn phí', { exact: true }).waitFor();
  await page.evaluate(() => { window.dispatchI18n.global.locale.value = 'en'; });
  await page.getByRole('tab', { name: 'History', exact: true }).waitFor();
  assert.ok(await page.getByText('Sailor · Explore', { exact: true }).count());
  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(await page.evaluate(() => window.dispatchCalls.map(c => c.kind)), ['buy','start','repeat','claim','start','cancel']);
  assert.deepEqual(errors, []);
  console.log('Dispatch browser flow passed: menu, buy, both selection directions, progress, repeat, claim, cancel, history, languages and mobile.');
} finally {
  await browser?.close();
  await server.close();
}
