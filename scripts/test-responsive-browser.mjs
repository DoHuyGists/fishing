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

// Mount real components with local state, without authentication or database calls.
const fixture = `
import { createApp, h } from 'vue';
import { createPinia } from 'pinia';
import Modal from '/src/components/shared/Modal.vue';
import Confirm from '/src/components/shared/TwoOptionsModal.vue';
import Badge from '/src/components/player/player-badge/AchievementDetail.vue';
import MyMarket from '/src/components/player/player-market/MyMarketListingsTab.vue';
import Market from '/src/components/player/player-market/MarketListingsTab.vue';
import DepthForm from '/src/components/admin/admin-depth-scope/DepthScopeForm.vue';
import EquipmentMenu from '/src/components/player/player-fishing/EquipmentMenu.vue';
import TensionChallenge from '/src/components/player/player-fishing-challenge/TensionChallenge.vue';
import { useAuthStore } from '/src/stores/auth.ts';
import { useMarketStore } from '/src/stores/player-market-store.ts';
import { useCurrencyStore } from '/src/stores/player-currency-store.ts';
import { useUserTurnsStore } from '/src/stores/player-user-turns-store.ts';
import { useDepthScopeStore } from '/src/components/admin/admin-depth-scope/admin-depth-scope-store.ts';
import { i18n } from '/src/i18n/index.ts';
import '/src/styles/index.css';
const params = new URLSearchParams(location.search), mode = params.get('mode');
const pinia = createPinia();
const auth = useAuthStore(pinia); auth.user = { id: 'responsive-test' }; auth.initialized = true;
const market = useMarketStore(pinia);
market.marketListings = Array.from({length: 5}, (_, i) => ({ id: String(i), user_id: mode === 'my' ? auth.user.id : 'seller', price: 123456789, created_at: '2026-11-23T12:00:00Z', caught: { id: String(i), fish: { id: String(i), name: 'Sample fish with a long display name', weight: 12.5, rarity: 'RARE' } } }));
const currency = useCurrencyStore(pinia); currency.cash = 123456789; currency.shells = 12345; currency.tickets = 1234;
const turns = useUserTurnsStore(pinia); turns.status = { turns: 5, max_turns: 20 };
const depth = useDepthScopeStore(pinia); depth.formOpen = true;
depth.draft = {code:'SHALLOW',name:'Shallow',minDepth:0,maxDepth:1,peakDepth:0,curvePower:1};
i18n.global.locale.value = params.get('lang');
window.action = null;
const controller = { tensionChallenge: { config: { safeMin:20, safeMax:75, maxTension:100, startDistance:12, tickRate:30 }, startedAt:performance.now(), expiresAt:performance.now()+90000 }, tensionStartedAt:null, tensionFight:null, tensionReeling:false, serverClockOffset:0, castPhase:'bite', advanceTensionFight(){}, setTensionReeling(){} };
const app = createApp({ render() {
 if (mode === 'confirm') return h(Confirm, { title: 'Session warning', message: 'Sample long message. '.repeat(40), firstText:'Close tab', secondText:'Sign out', onSecond:()=>window.action='confirm' });
 if (mode === 'badge') return h(Badge, { badge: { name: 'Sample achievement', description:'Sample description. '.repeat(24), reward:{cash:1000}, is_earned:true, quantity:1, can_claim:true, badge_id:'badge' }, claimingId:'', claimError:'', onClaim:()=>window.action='claim' });
 if (mode === 'depth') return h(DepthForm);
 if (mode === 'touch') return h('div', {style:'padding:12px'}, [h(EquipmentMenu), h(TensionChallenge,{controller,untimedStart:true})]);
 return h(Modal, { title: params.get('lang') === 'vi' ? 'Trang bị và cấu hình người chơi' : 'Equipment and player configuration', onRefresh:()=>{}, guidSteps:[{target:'#test-content',title:'Guide'}], compact:mode==='compact', showCountData:mode==='modal'||mode==='compact' }, {default:()=> mode==='my' ? h(MyMarket,{viewMode:'grid',isCancellingListing:false,onCancelListing:item=>window.action=item.id}) : mode==='species' ? h(Market,{viewMode:'species',onBuy:item=>window.action=item.id}) : h('div',{id:'test-content'},'Content')});
} });
app.use(pinia); app.use(i18n); app.mount('#app'); window.ready = true;
`;

const server = await createServer({
  configFile: false, envDir: false, appType: 'custom', cacheDir: 'node_modules/.vite-responsive-browser',
  server: { host: '127.0.0.1', port: 0, hmr: false },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://responsive-test.supabase.co'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key') },
  plugins: [vue(), tailwindcss(), {
    name: 'responsive-fixture',
    configureServer(instance) {
      instance.middlewares.use('/__responsive', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><html class="ocean-theme"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/responsive-fixture.ts"></script></body></html>');
      });
    },
    resolveId(id) { if (id === '/responsive-fixture.ts') return id; },
    load(id) { if (id === '/responsive-fixture.ts') return fixture; },
  }],
});

let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => route.abort());
  for (const lang of ['vi', 'en']) {
    for (const [width, height] of [[320, 568], [360, 800], [768, 1024], [1024, 768], [844, 390], [1440, 900]]) {
      for (const mode of ['modal', 'compact', 'my', 'species', 'badge', 'confirm', 'depth', 'touch']) {
        const label = lang + ' ' + mode + ' ' + width + 'x' + height;
        await page.setViewportSize({ width, height });
        await page.goto(server.resolvedUrls.local[0] + '__responsive?mode=' + mode + '&lang=' + lang);
        await page.waitForFunction(() => window.ready);
        const failures = await page.evaluate(() => {
          const problems = [];
          if (document.documentElement.scrollWidth > innerWidth + 1) problems.push('page overflows horizontally');
          for (const el of document.querySelectorAll('.shared-modal__header, .shared-modal__header > div, article, article > div, .shared-modal__content section, .shared-modal__content .border-t')) {
            if (el.clientWidth && el.scrollWidth > el.clientWidth + 2) problems.push('horizontal overflow: ' + el.className);
          }
          const dialog = document.querySelector('.shared-confirmation, [aria-labelledby=badge-detail-title], form');
          if (dialog) {
            const rect = dialog.getBoundingClientRect();
            if (rect.top < 0 || rect.bottom > innerHeight + 1) problems.push('dialog outside viewport');
          }
          const footer = document.querySelector('form footer');
          if (footer && footer.getBoundingClientRect().bottom > innerHeight) problems.push('form actions outside viewport');
          return problems;
        });
        assert.deepEqual(failures, [], label);
        if (mode === 'species' || mode === 'my') {
          const button = mode === 'species' ? page.locator('article button').first() : page.locator('.shared-modal__content .border-t button').first();
          await button.click();
          assert.equal(await page.evaluate(() => window.action), '0', label + ' action');
        }
        if (mode === 'badge' || mode === 'confirm') {
          const button = mode === 'badge' ? page.locator('[aria-labelledby=badge-detail-title] button').last() : page.locator('.shared-confirmation button').last();
          await button.scrollIntoViewIfNeeded();
          await button.click();
          assert.equal(await page.evaluate(() => window.action), mode === 'badge' ? 'claim' : 'confirm', label + ' action');
        }
        if (mode === 'touch') {
          const heights = await page.locator('.equipment-actions > button, section > div > button').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height));
          assert.ok(heights.length >= 5 && heights.every(value => value >= 44), label + ' touch targets');
        }
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: VI/EN at 320, 360, 768, 1024, 1440px and landscape 844x390; full/compact modal headers, market cards/actions, scrollable dialogs, admin form footer and touch targets.');
} finally {
  await browser?.close();
  await server.close();
}
