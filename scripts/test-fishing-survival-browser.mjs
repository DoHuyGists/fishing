import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright-core';

const executablePath = process.env.FISHING_SCENE_TEST_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium',
].find(existsSync);
assert.ok(executablePath, 'Set FISHING_SCENE_TEST_BROWSER to an installed Chromium browser.');
const server = await createServer({
  configFile: false, envDir: false, appType: 'custom',
  server: { host: '127.0.0.1', port: 0, hmr: false },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://survival-test.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
  },
  plugins: [vue(), tailwindcss(), {
    name: 'survival-fixture',
    configureServer(instance) {
      instance.middlewares.use('/__survival', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><html><body><div id="app"></div><script type="module" src="/__survival_fixture.ts"></script></body></html>');
      });
    },
    resolveId(id) { if (id === '/__survival_fixture.ts') return id; },
    load(id) {
      if (id !== '/__survival_fixture.ts') return;
      return `
        import {createApp,h} from 'vue';
        import {createPinia} from 'pinia';
        import {createRouter,createMemoryHistory} from 'vue-router';
        import {i18n} from '/src/i18n/index.ts';
        import {useAuthStore} from '/src/stores/auth.ts';
        import {useHealthStore} from '/src/stores/player-health-store.ts';
        import {useInventoryStore} from '/src/stores/player-inventory-store.ts';
        import {useFishingStore} from '/src/stores/player-fishing-store.ts';
        import FishingSurvival from '/src/components/player/player-fishing/FishingSurvival.vue';
        import SurvivalDeathDialog from '/src/components/player/player-fishing/SurvivalDeathDialog.vue';
        import '/src/styles/index.css';
        import '/src/styles/animation.css';
        const pinia=createPinia(), auth=useAuthStore(pinia), health=useHealthStore(pinia);
        const inventory=useInventoryStore(pinia), fishing=useFishingStore(pinia);
        auth.user={id:'owner'}; health.owner='owner'; health.generation=auth.sessionGeneration;
        inventory.items=[{id:'hat',userId:'owner',data:{category:'head',health_bonuses:{vitality:2,hydration:3,nutrition:4,energy:5,morale:6}}}];
        health.savedSets=[{id:'set',user_id:'owner',is_used:true,head:[{inventory_id:'hat'}],torso:[],hands:[],legs:[],feet:[],accessory:[]}];
        fishing.sessionReady=true;
        const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',name:'home',component:{render:()=>null}}]});
        window.survivalTest={fishing,health,i18n};
        createApp({render:()=>h('div',{style:'max-width:21rem'},[
          h(FishingSurvival),h(SurvivalDeathDialog),h('button',{id:'outside'},'Outside')
        ])}).use(pinia).use(i18n).use(router).mount('#app');
      `;
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${server.resolvedUrls.local[0]}__survival`);
  await page.getByRole('progressbar', { name: 'Sinh lực' }).waitFor();
  assert.equal(await page.getByRole('progressbar').count(), 5);
  assert.equal(await page.getByRole('progressbar', { name: 'Sinh lực' }).getAttribute('aria-valuenow'), '2');
  await page.evaluate(() => {
    window.survivalTest.fishing.applySurvival({enabled:true,trip_id:'trip',dead:true,lost_fish:3,
      equipment:[{inventory_id:'hat',remaining:{vitality:0,hydration:2,nutrition:3,energy:4,morale:5}}]});
  });
  const dialog = page.getByRole('alertdialog');
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /3 cá/);
  assert.equal(await page.evaluate(() => document.querySelector('dialog').matches(':modal')), true);
  assert.equal(await page.getByRole('progressbar', { name: 'Sinh lực', includeHidden: true }).getAttribute('aria-valuenow'), '0');
  await page.keyboard.press('Escape');
  assert.equal(await dialog.isVisible(), true);
  await page.keyboard.press('Tab');
  await page.evaluate(() => document.querySelector('#outside').focus());
  assert.notEqual(await page.evaluate(() => document.activeElement.id), 'outside');
  await page.evaluate(() => { window.survivalTest.i18n.global.locale.value='en'; });
  await page.getByText('You have died', { exact: true }).waitFor();
  assert.match(await dialog.innerText(), /Lost 3 fish/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log('Survival browser checks passed: remaining stats, death, focus, Escape, mobile and both locales.');
} finally {
  await browser?.close();
  await server.close();
}
