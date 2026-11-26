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
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import FishingMapModal from '/src/components/player/player-fishing-maps/FishingMapModal.vue';
import { useAuthStore } from '/src/stores/auth.ts';
import { useCountryStore } from '/src/stores/player-country-store.ts';
import { useFishingMapStore } from '/src/stores/player-fishing-map-store.ts';
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
  store.mapAreas = Array.from({length: 14}, (_, i) => ({
    id: String(i), countryId: '0', title: 'Fishing area ' + i, isAvailable: true,
    maxDepth: 12, allowDepthTool: true, timezone: 'Asia/Ho_Chi_Minh',
    zone: { id: 'zone', code: 'LAKES', name: 'Lake region',
      weathers: Array.from({length: 10}, (_, j) => ({id: String(j), name: 'Weather ' + j})) },
  }));
  store.species = store.mapAreas.map(area => ({areaId: area.id, speciesId: 'fish', speciesName: 'Sample fish'}));
};
i18n.global.locale.value = new URLSearchParams(location.search).get('lang');
createApp(FishingMapModal).use(pinia).use(i18n).mount('#app');
window.mapStore = store;
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
      for (const mode of ['grid', 'list']) {
        await page.evaluate(mode => { window.mapStore.viewMode = mode; }, mode);
        await page.evaluate(() => new Promise(requestAnimationFrame));
        const label = lang + ' ' + mode + ' ' + width + 'x' + height;
        const result = await page.evaluate(() => {
          const content = document.querySelector('.shared-modal__content');
          const cards = document.querySelector('article').parentElement;
          const countries = document.querySelector('aside nav');
          const scroller = innerWidth >= 768 ? cards : content;
          scroller.scrollTop = scroller.scrollHeight;
          countries.scrollTop = countries.scrollHeight;
          return {
            horizontalOverflow: [...document.querySelectorAll('article, article > div, section, aside, .shared-modal__content')].some(el => el.scrollWidth > el.clientWidth + 2),
            scrolled: scroller.scrollTop > 0,
            countriesScrolled: countries.scrollTop > 0,
            cardsIntact: [...document.querySelectorAll('article')].every(el => el.scrollHeight <= el.clientHeight + 2),
            paginationVisible: document.querySelector('.shared-pagination').getBoundingClientRect().bottom <= innerHeight + 1,
          };
        });
        assert.equal(result.horizontalOverflow, false, label + ': horizontal overflow');
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
        const scroller = innerWidth >= 768 ? cards[0].parentElement : document.querySelector('.shared-modal__content');
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
