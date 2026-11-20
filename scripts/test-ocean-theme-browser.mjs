import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright-core';

// Run with node scripts/test-ocean-theme-browser.mjs. No account or server data is used.
const executablePath = process.env.OCEAN_THEME_TEST_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium',
].find(existsSync);
if (!executablePath) throw new Error('Set OCEAN_THEME_TEST_BROWSER to an installed Chromium browser.');

const screenshotDirectory = resolve('node_modules/.cache/ocean-theme-browser');
const palette = {
  deep: '#102d46', panel: '#1d5475', cyan: '#35b9d5',
  gold: '#f2c66d', wood: '#93643f', pearl: '#f5ebd4',
};
const rgb = hex => hex.match(/[a-f\d]{2}/gi).map(channel => parseInt(channel, 16));
const fixture = `
  import { createApp, defineComponent, h, nextTick, reactive, Teleport } from 'vue';
  import { createPinia } from 'pinia';
  import { createMemoryHistory, createRouter } from 'vue-router';
  import App from '/src/App.vue';
  import LoginView from '/src/views/LoginView.vue';
  import SignUpView from '/src/views/SignUpView.vue';
  import Modal from '/src/components/shared/Modal.vue';
  import Tab from '/src/components/shared/Tab.vue';
  import Pagination from '/src/components/shared/Pagination.vue';
  import PaymentConfirmation from '/src/components/shared/PaymentConfirmation.vue';
  import TwoOptionsModal from '/src/components/shared/TwoOptionsModal.vue';
  import ShopModal from '/src/components/player/player-shop/ShopModal.vue';
  import WorkBenchModal from '/src/components/player/player-work-bench/WorkBenchModal.vue';
  import { useAuthStore } from '/src/stores/auth.ts';
  import { useFeatureAvailabilityStore } from '/src/stores/player-feature-availability-store.ts';
  import { useGameCatalogStore } from '/src/stores/player-game-catalog-store.ts';
  import { useCurrencyStore } from '/src/stores/player-currency-store.ts';
  import { supabaseUserInventoryRepository } from '/src/data/supabaseUserInventoryRepository.ts';
  import { supabaseCurrencyRepository } from '/src/data/supabaseCurrencyRepository.ts';
  import { FEATURE_CATALOG } from '/src/data/featureAvailability.ts';
  import { i18n } from '/src/i18n/index.ts';
  import '/src/styles/index.css';
  import '/src/styles/animation.css';

  const pinia = createPinia();
  const auth = useAuthStore(pinia);
  auth.initialized = true;
  auth.user = { id: 'ocean-theme-fixture' };
  auth.signIn = async () => { auth.error = 'Fixture sign-in error'; return false; };
  const features = useFeatureAvailabilityStore(pinia);
  features.ready = true;
  features.flags = Object.fromEntries(FEATURE_CATALOG.map(feature => [feature.key, { feature_key: feature.key, enabled: true }]));
  features.start = features.load = async () => {};
  features.stop = () => {};

  const item = { id: 'fixture-bait', name: 'Ocean bait', category: 'bait', classification: 'Fishing',
    information: 'A locally supplied item for the ocean theme check.', image: null, icon: '🐟', price: 250, quantity: 5, rpc: null };
  const catalogs = { shop: [item], items: [item], blueprints: [
    { id: 'fixture-blueprint', resultItemId: item.id, resultQuantity: 5, requiredMaterials: [{ item_id: item.id, quantity: 1 }], goldCost: 20 },
  ] };
  const catalog = useGameCatalogStore(pinia);
  catalog.activate = () => () => {};
  catalog.get = async (domain, options = {}) => {
    const data = catalogs[domain] ?? [];
    options.onUpdate?.(data);
    return data;
  };
  supabaseUserInventoryRepository.fetchUserInventory = async () => [
    { id: 'fixture-inventory', userId: auth.user.id, data: { ...item, quantity: 10 } },
  ];
  supabaseCurrencyRepository.fetchWallet = async () => ({ cash: 10000, shells: 200, tickets: 20 });
  useCurrencyStore(pinia).$patch({ cash: 10000, shells: 200, tickets: 20 });

  const state = reactive({ overlay: '', tab: 'inventory', page: 1, paid: 0, confirmed: 0 });
  const SemanticProbe = defineComponent({
    setup: () => () => h('div', { 'data-testid': 'semantic', class: 'rounded-xl bg-surface p-4 text-content' }, [
      h('div', { 'data-testid': 'muted', class: 'bg-surface-muted p-2 text-content' }, 'Ocean information'),
      h('div', { 'data-testid': 'alpha', class: 'bg-white/70 p-2 text-emerald-950/65' }, 'Translucent surface'),
    ]),
  });
  const Playground = defineComponent({
    setup: () => () => h('main', { class: 'min-h-screen bg-surface-muted p-4 text-content' }, [
      h(SemanticProbe),
      h(Tab, { tabs: [{ key: 'inventory', label: 'Inventory', badge: 3 }, { key: 'rewards', label: 'Rewards' }],
        modelValue: state.tab, 'onUpdate:modelValue': value => { state.tab = value; } }, {
        inventory: () => h('div', { class: 'bg-surface p-4' }, 'Inventory panel'),
        rewards: () => h('div', { class: 'bg-surface p-4' }, 'Rewards panel'),
      }),
      h(Pagination, { page: state.page, total: 30, pageSize: 10, onChange: value => { state.page = value; } }),
      state.overlay === 'modal' && h(Teleport, { to: 'body' }, h(Modal, {
        title: 'Ocean fixture modal', compact: true, showCountData: false,
      }, { default: () => h(SemanticProbe) })),
      state.overlay === 'payment' && h(PaymentConfirmation, {
        title: 'Ocean fixture payment', balance: 1000, total: 250, confirmText: 'Pay fixture',
        onConfirm: () => { state.paid++; state.overlay = ''; }, onCancel: () => { state.overlay = ''; },
      }),
      state.overlay === 'confirm' && h(TwoOptionsModal, {
        title: 'Ocean fixture confirmation', message: 'Keep the catch or release it.',
        firstText: 'Keep fixture', secondText: 'Release fixture',
        onFirst: () => { state.confirmed++; state.overlay = ''; }, onSecond: () => { state.overlay = ''; },
      }),
      state.overlay === 'shop' && h(ShopModal),
      state.overlay === 'workbench' && h(WorkBenchModal),
    ]),
  });
  const AdminFixture = defineComponent({ setup: () => () => h('main', { class: 'min-h-screen bg-surface p-4 text-content' }, h(SemanticProbe)) });
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/signup', name: 'signup', component: SignUpView },
    { path: '/', name: 'home', component: Playground },
    { path: '/admin', name: 'admin', component: AdminFixture },
    { path: '/forgot-password', name: 'forgotPassword', component: Playground },
  ] });
  const app = createApp(App);
  app.use(pinia); app.use(i18n); app.use(router);
  await router.push('/login'); await router.isReady(); app.mount('#app');
  window.oceanThemeTest = { state, router, i18n, auth,
    async go(path) { state.overlay = ''; await router.push(path); await nextTick(); },
    async show(overlay) { state.overlay = overlay; await nextTick(); },
  };
`;

const server = await createServer({
  configFile: false, envDir: false, appType: 'custom', cacheDir: 'node_modules/.vite-ocean-theme-browser',
  server: { host: '127.0.0.1', port: 0, hmr: false },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://ocean-theme-test.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
  },
  plugins: [vue(), tailwindcss(), {
    name: 'ocean-theme-browser-fixture',
    configureServer(instance) {
      instance.middlewares.use('/__ocean_theme', (_request, response) => {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__ocean_theme_fixture.ts"></script></body></html>');
      });
    },
    resolveId(id) { if (id === '/__ocean_theme_fixture.ts') return id; },
    load(id) { if (id === '/__ocean_theme_fixture.ts') return fixture; },
  }],
});

let browser;
let page;
const runtimeErrors = [];
const externalRequests = [];

async function color(selector, property = 'backgroundColor') {
  return page.locator(selector).first().evaluate((element, cssProperty) => {
    // Canvas normalizes rgb(), color(srgb), and color-mix() consistently.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    context.fillStyle = getComputedStyle(element)[cssProperty];
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  }, property);
}

async function assertColor(selector, property, expected) {
  assert.deepEqual(await color(selector, property), [...rgb(expected), 255], `${selector} ${property}`);
}

async function assertReadable(selector, gradientBackground) {
  const foreground = await color(selector, 'color');
  const background = gradientBackground ? [...rgb(gradientBackground), 255] : await color(selector);
  assert.equal(foreground[3], 255, `${selector}: use an opaque foreground for this contrast assertion`);
  assert.equal(background[3], 255, `${selector}: use an opaque background for this contrast assertion`);
  const luminance = value => value.slice(0, 3).map(channel => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, `${selector}: normal text contrast must be at least 4.5:1`);
}

async function screenshot(name) {
  await page.screenshot({ path: resolve(screenshotDirectory, `${name}.png`), fullPage: true, animations: 'disabled' });
}

async function assertNoOverflow(label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${label}: no horizontal overflow`);
}

async function navigate(path) {
  await page.evaluate(value => window.oceanThemeTest.go(value), path);
}

try {
  mkdirSync(screenshotDirectory, { recursive: true });
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  browser = await chromium.launch({ executablePath, headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(origin).origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    externalRequests.push(url.href);
    return route.abort('blockedbyclient');
  });
  await page.goto(`${origin}__ocean_theme`);
  await page.waitForFunction(() => Boolean(window.oceanThemeTest));
  assert.equal(await page.locator('html').evaluate(element => element.classList.contains('ocean-theme')), true);
  assert.deepEqual(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key,
    getComputedStyle(document.documentElement).getPropertyValue('--color-ocean-' + key).trim().toLowerCase(),
  ])), Object.keys(palette)), palette, 'All six public palette values match the requested colors');

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const path of ['/login', '/signup']) {
      await navigate(path);
      await page.locator('input[type="email"]').waitFor();
      await assertColor('main', 'backgroundColor', palette.deep);
      await assertColor('input[type="email"]', 'backgroundColor', palette.deep);
      await assertColor('input[type="email"]', 'color', palette.pearl);
      await assertColor('button[type="submit"]', 'backgroundColor', palette.gold);
      await assertColor('button[type="submit"]', 'color', palette.deep);
      await assertReadable('input[type="email"]');
      await assertReadable('button[type="submit"]');
      await assertNoOverflow(`${path} at ${viewport.width}px`);
      await screenshot(`${path.slice(1)}-${viewport.width < 600 ? 'mobile' : 'desktop'}`);
    }
  }
  // Exercise real auth controls without contacting Supabase.
  await navigate('/login');
  await page.locator('input[type="email"]').fill('fixture@example.test');
  await page.locator('input[autocomplete="current-password"]').fill('fixture-password');
  await page.locator('input[autocomplete="current-password"] + button').click();
  assert.equal(await page.locator('input[autocomplete="current-password"]').getAttribute('type'), 'text');
  await page.locator('button[type="submit"]').click();
  await page.getByRole('alert').filter({ hasText: 'Fixture sign-in error' }).waitFor();

  await navigate('/');
  await assertColor('[data-testid="semantic"]', 'backgroundColor', palette.panel);
  await assertColor('[data-testid="semantic"]', 'color', palette.pearl);
  await assertColor('[data-testid="muted"]', 'backgroundColor', palette.deep);
  await assertReadable('[data-testid="semantic"]');
  const alpha = await color('[data-testid="alpha"]');
  assert.ok(alpha[0] < 60 && alpha[1] < 115 && alpha[2] < 150 && alpha[3] > 0, 'bg-white/70 must become a dark ocean surface');
  const alphaInk = await color('[data-testid="alpha"]', 'color');
  assert.ok(alphaInk[0] > 160 && alphaInk[1] > 160 && alphaInk[2] > 160 && alphaInk[3] > 0, 'Legacy alpha text must become light enough to read: ' + JSON.stringify(alphaInk));
  await assertColor('[role="tab"][aria-selected="true"]', 'color', palette.gold);
  await page.getByRole('tab', { name: 'Rewards', exact: true }).click();
  await page.getByRole('tabpanel').filter({ hasText: 'Rewards panel' }).waitFor();
  assert.equal(await page.evaluate(() => window.oceanThemeTest.state.tab), 'rewards');
  await page.locator('.shared-pagination button').last().click();
  assert.equal(await page.evaluate(() => window.oceanThemeTest.state.page), 2);
  await assertColor('.shared-pagination', 'backgroundColor', palette.deep);
  await screenshot('shared-controls-mobile');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.oceanThemeTest.show('modal'));
  await page.locator('.shared-modal').waitFor();
  assert.equal(await page.locator('.shared-modal').evaluate(element => !document.querySelector('#app').contains(element)), true, 'Modal fixture must be teleported outside #app');
  await assertColor('.shared-modal__panel', 'backgroundColor', palette.deep);
  await assertColor('.shared-modal__title', 'color', palette.pearl);
  await assertColor('.shared-modal [data-testid="semantic"]', 'backgroundColor', palette.panel);
  await screenshot('shared-modal-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoOverflow('Shared modal mobile');
  await screenshot('shared-modal-mobile');
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.evaluate(() => window.oceanThemeTest.show('payment'));
  await page.getByRole('dialog', { name: 'Ocean fixture payment' }).waitFor();
  await assertColor('.shared-payment__title', 'color', palette.gold);
  await assertColor('.shared-payment__summary', 'backgroundColor', palette.deep);
  await assertColor('.shared-payment button[type="submit"]', 'borderTopColor', palette.gold);
  await assertColor('.shared-payment button[type="submit"]', 'color', palette.deep);
  assert.match(await page.locator('.shared-payment button[type="submit"]').evaluate(element => getComputedStyle(element).backgroundImage), /rgb\(242, 198, 109\)/, 'Payment primary action uses a gold gradient');
  await assertReadable('.shared-payment button[type="submit"]', palette.gold);
  await screenshot('payment-desktop');
  await page.getByRole('button', { name: 'Pay fixture', exact: true }).click();
  assert.equal(await page.evaluate(() => window.oceanThemeTest.state.paid), 1);
  await page.evaluate(() => window.oceanThemeTest.show('confirm'));
  await page.locator('.shared-confirmation').waitFor();
  await assertColor('.shared-confirmation__title', 'color', palette.gold);
  await assertColor('.shared-confirmation__message', 'color', palette.pearl);
  await page.getByRole('button', { name: 'Keep fixture', exact: true }).click();
  assert.equal(await page.evaluate(() => window.oceanThemeTest.state.confirmed), 1);

  await page.evaluate(() => window.oceanThemeTest.show('shop'));
  await page.locator('.shop-item-card').waitFor();
  await assertColor('.shared-modal__panel', 'backgroundColor', palette.deep);
  await page.locator('.shop-item-card').click();
  await page.locator('.shop-order .shared-payment').waitFor();
  await assertNoOverflow('Shop desktop');
  await screenshot('shop-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoOverflow('Shop mobile');
  await screenshot('shop-mobile');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.oceanThemeTest.show('workbench'));
  await page.locator('.workbench').waitFor();
  await page.locator('#workbench-blueprints button').first().click();
  await assertColor('#workbench-palette', 'borderTopColor', palette.wood);
  await assertNoOverflow('Workbench desktop');
  await screenshot('workbench-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoOverflow('Workbench mobile');
  await screenshot('workbench-mobile');
  await page.setViewportSize({ width: 1440, height: 1000 });

  // App.vue owns the document class; shared semantic utilities must revert on admin.
  await navigate('/admin');
  assert.equal(await page.locator('html').evaluate(element => element.classList.contains('ocean-theme')), false);
  await assertColor('[data-testid="semantic"]', 'backgroundColor', '#f5f9f0');
  await assertColor('[data-testid="semantic"]', 'color', '#24352a');
  assert.ok((await color('[data-testid="alpha"]'))[0] > 245, 'Admin bg-white/70 must retain its original white');
  await screenshot('admin-original-palette');
  await navigate('/');
  assert.equal(await page.locator('html').evaluate(element => element.classList.contains('ocean-theme')), true);
  await assertColor('[data-testid="semantic"]', 'backgroundColor', palette.panel);
  await assertColor('[data-testid="semantic"]', 'color', palette.pearl);
  assert.deepEqual(externalRequests, [], 'The fixture must make zero requests to external/production services');
  assert.deepEqual(runtimeErrors, [], 'No browser runtime errors');
  console.log('Ocean theme browser checks passed: exact palette, auth desktop/mobile, text contrast, alpha compatibility, shared controls, Teleport, shop, workbench, admin isolation and public roundtrip.');
  console.log('Screenshots: ' + screenshotDirectory);
} catch (error) {
  console.error('Browser runtime errors:', runtimeErrors);
  console.error('External requests:', externalRequests);
  if (page) {
    await screenshot('failure').catch(() => {});
    console.error('Visible page:', await page.locator('body').innerText().catch(() => 'Unavailable'));
  }
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
