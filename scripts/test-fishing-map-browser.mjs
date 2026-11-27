import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright-core';

const executablePath = process.env.RESPONSIVE_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium',
].find(existsSync);
assert.ok(executablePath, 'Set RESPONSIVE_BROWSER to an installed Chromium browser.');

const fixture = `
import { createApp, nextTick } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import FishingMapModal from '/src/components/player/player-fishing-maps/FishingMapModal.vue';
import { useAuthStore } from '/src/stores/auth.ts';
import { useCountryStore } from '/src/stores/player-country-store.ts';
import { useFishingMapStore } from '/src/stores/player-fishing-map-store.ts';
import { useModalStore } from '/src/stores/player-modal-store.ts';
import { i18n } from '/src/i18n/index.ts';
import '/src/styles/index.css';
const pinia = createPinia();
const auth = useAuthStore(pinia); auth.user = { id: 'layout-test' };
const countries = useCountryStore(pinia);
countries.countries = Array.from({length: 40}, (_, i) => ({id: String(i), name: 'Country ' + i, code: String(i)}));
countries.unlockedCountries = countries.countries;
countries.unlockedPlayerId = auth.user.id;
countries.watchUnlockedCountries = () => () => {};
const store = useFishingMapStore(pinia);
store.load = async () => { await Promise.resolve(); store.selectedCountryId = '0'; };
store.loadSpecies = async () => {
  window.speciesLoads = (window.speciesLoads ?? 0) + 1;
  store.mapAreas = Array.from({length: 14}, (_, i) => ({
    id: String(i), countryId: '0', title: 'Fishing area ' + i, isAvailable: i !== 1,
    maxDepth: 12, allowDepthTool: true, timezone: 'Asia/Ho_Chi_Minh',
    zone: { id: 'zone', code: 'LAKES', name: 'Lake region',
      weathers: Array.from({length: i % 2 ? 3 : 10}, (_, j) => ({id: String(j), name: 'Weather ' + j})) },
  }));
  store.species = store.mapAreas.map(area => ({areaId: area.id, speciesId: 'fish', speciesName: 'Sample fish'}));
};
i18n.global.locale.value = new URLSearchParams(location.search).get('lang');
const router = createRouter({ history: createMemoryHistory(), routes: [
  { path: '/', component: { template: '<div />' } },
  { path: '/prepare/:areaId?', name: 'prepare', component: { template: '<div />' } },
] });
await router.push('/');
createApp(FishingMapModal).use(pinia).use(i18n).use(router).mount('#app');
window.testRouter = router;
window.modalStore = useModalStore(pinia);
window.mapStore = store;
window.countryStore = countries;
window.nextTick = nextTick;
`;

const server = await createServer({
  configFile: false, envDir: false, appType: 'custom',
  server: { host: '127.0.0.1', port: 0, hmr: false },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://layout-test.supabase.co'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key') },
  plugins: [vue(), tailwindcss(), {
    name: 'fishing-map-layout-fixture',
    configureServer(instance) {
      instance.middlewares.use('/__map', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/map-fixture.ts"></script></body></html>');
      });
    },
    resolveId(id) { if (id === '/map-fixture.ts') return id; },
    load(id) { if (id === '/map-fixture.ts') return fixture; },
  }],
});

let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => route.abort());
  for (const lang of ['vi', 'en']) {
    for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [844, 390], [1440, 900], [1908, 875]]) {
      await page.setViewportSize({ width, height });
      await page.goto(server.resolvedUrls.local[0] + '__map?lang=' + lang);
      await page.locator('article').first().waitFor();
      if (lang === 'vi' && width === 320) {
        assert.equal(await page.locator('article').nth(1).locator('.fishing-map-prepare').count(), 0, 'closed areas must not offer navigation');
        await page.evaluate(() => { window.modalStore.modalOpening = 'fishing-map'; });
        await page.locator('article').first().locator('.fishing-map-prepare').click();
        await page.waitForFunction(() => window.testRouter.currentRoute.value.fullPath === '/prepare/0' && window.modalStore.modalOpening === null);
      }
      if (lang === 'vi' && width === 320) {
        const refresh = await page.evaluate(async () => {
          const countries = window.countryStore;
          countries.unlockedCountries = countries.countries.slice(0, -1);
          window.mapStore.countryIdsWithAreas = ['39'];
          await window.nextTick();
          const loads = window.speciesLoads;
          const unlockCount = () => document.querySelectorAll('aside nav button.ocean-primary-action').length;
          const before = unlockCount();
          countries.isLoadingUnlocked = true;
          await window.nextTick();
          const during = unlockCount();
          countries.unlockedCountries = [...countries.unlockedCountries];
          countries.isLoadingUnlocked = false;
          await window.nextTick();
          const result = { before, during, after: unlockCount(), loads, afterLoads: window.speciesLoads };
          countries.unlockedCountries = countries.countries;
          await window.nextTick();
          return result;
        });
        assert.equal(refresh.before, 1);
        assert.equal(refresh.during, 1, 'background country refresh must keep unlock buttons mounted');
        assert.equal(refresh.after, 1);
        assert.equal(refresh.afterLoads, refresh.loads, 'unchanged country access must not reload fishing areas');
      }
      for (const mode of ['grid', 'list']) {
        await page.evaluate(mode => { window.mapStore.viewMode = mode; }, mode);
        await page.evaluate(() => new Promise(requestAnimationFrame));
        const label = lang + ' ' + mode + ' ' + width + 'x' + height;
        const result = await page.evaluate(() => {
          const content = document.querySelector('.shared-modal__content');
          const cards = document.querySelector('.fishing-map-areas');
          const countries = document.querySelector('aside nav');
          const scroller = innerWidth >= 768 ? cards : content;
          scroller.scrollTop = scroller.scrollHeight;
          countries.scrollTop = countries.scrollHeight;
          const columns = new Map();
          for (const card of document.querySelectorAll('.fishing-map-area-grid article')) {
            const rect = card.getBoundingClientRect();
            const key = Math.round(rect.left);
            const column = columns.get(key) ?? [];
            column.push(rect);
            columns.set(key, column);
          }
          return {
            masonryPacked: [...columns.values()].every(column => column.every((rect, i) =>
              i === 0 || Math.abs(rect.top - column[i - 1].bottom - 12) <= 2)),
            horizontalOverflow: [...document.querySelectorAll('article, article > div, section, aside, .shared-modal__content')].some(el => el.scrollWidth > el.clientWidth + 2),
            scrolled: scroller.scrollTop > 0,
            countriesScrolled: countries.scrollTop > 0,
            cardsIntact: [...document.querySelectorAll('article')].every(el => el.scrollHeight <= el.clientHeight + 2),
            paginationVisible: document.querySelector('.shared-pagination').getBoundingClientRect().bottom <= innerHeight + 1,
          };
        });
        assert.equal(result.horizontalOverflow, false, label + ': horizontal overflow');
        assert.equal(result.masonryPacked, true, label + ': masonry cards must stack without row gaps');
        assert.equal(result.scrolled, true, label + ': areas must scroll');
        assert.equal(result.countriesScrolled, true, label + ': countries must scroll');
        assert.equal(result.cardsIntact, true, label + ': card content clipped');
        assert.equal(result.paginationVisible, true, label + ': pagination unreachable');
      }
      // A short list must keep tall cards intact instead of shrinking grid rows to fit.
      await page.evaluate(() => {
        window.mapStore.viewMode = 'list';
        window.mapStore.mapAreas = window.mapStore.mapAreas.slice(0, 2);
      });
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const shortList = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('article')];
        const scroller = innerWidth >= 768 ? document.querySelector('.fishing-map-areas') : document.querySelector('.shared-modal__content');
        scroller.scrollTop = scroller.scrollHeight;
        return cards.every(card => {
          const style = getComputedStyle(card);
          return style.overflowY === 'visible' && card.scrollHeight <= card.clientHeight + 2;
        }) && cards.at(-1).querySelector('details').getBoundingClientRect().bottom <= innerHeight + 1;
      });
      assert.equal(shortList, true, lang + ' short list ' + width + 'x' + height + ': full card content must remain reachable');
    }
  }
  assert.deepEqual(errors, []);
  console.log('Fishing map layout passed: 24 viewport, language and view-mode combinations.');
} finally {
  await browser?.close();
  await server.close();
}
