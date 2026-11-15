import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const executablePath = process.env.LEADERBOARD_TEST_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium',
].find(existsSync);
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false }, appType: 'custom', plugins: [{
  name: 'leaderboard-fixture',
  configureServer(instance) {
    instance.middlewares.use('/__leaderboard', (_request, response) => {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__leaderboard-fixture.ts"></script></body></html>');
    });
  },
  resolveId(id) { if (id === '/__leaderboard-fixture.ts') return id; },
  load(id) {
    if (id !== '/__leaderboard-fixture.ts') return;
    return `
      import {createApp,h} from 'vue'; import {createPinia} from 'pinia';
      import LeaderboardModal from '/src/components/player/leaderboard/LeaderboardModal.vue';
      import FishingFatigue from '/src/components/player/fishing/FishingFatigue.vue';
      import {useLeaderboardStore} from '/src/stores/leaderboard.ts';
      import {useAuthStore} from '/src/stores/auth.ts';
      import {supabaseLeaderboardRepository as repo} from '/src/data/supabaseLeaderboardRepository.ts';
      import {supabaseUserInAreaRepository as areas} from '/src/data/supabaseUserInAreaRepository.ts';
      import {i18n} from '/src/i18n/index.ts'; import '/src/styles/index.css';
      const pinia=createPinia(); const auth=useAuthStore(pinia); auth.user={id:'player'};
      const store=useLeaderboardStore(pinia); store.activeTab='best_fish';
      window.board=store; window.testI18n=i18n;
      const fish={id:'fish',species_id:'species',name:'Cá kỷ lục',image:null,rarity:'RARE',weight:8,score:12.345678,caught_at:'2026-11-14T12:00:00Z'};
      const player={id:'player',display_name:'Người câu cá',score:0,total_caught:1,best_fish:fish,created_at:fish.caught_at,updated_at:fish.caught_at,rank:1};
      const archiveId='1479943f-d8bc-48ca-b49f-80701df0de1b',currentId='82dbaf73-3577-480c-8eb8-8584e4ef0a9a';
      repo.fetchSeasonBoard=async(page,seasonId)=>({items:[player,{...player,id:'other',display_name:'Other',rank:2}],total:2,my_entry:player,
        season:{id:seasonId??currentId,season_number:seasonId===archiveId?1:2,starts_at:'2026-11-01T00:00:00Z',ends_at:'2026-11-15T00:00:00Z',finalized_at:seasonId===archiveId?'2026-11-15T00:00:00Z':null},
        current_season_id:currentId,previous_season_id:seasonId===archiveId?null:archiveId,next_season_id:seasonId===archiveId?currentId:null,
        hall_of_fame:seasonId===archiveId?[{rank:1,user_id:'player',display_name:'Tên được vinh danh',fish,caught_at:fish.caught_at}]:[],
        meta:[{species_id:'species',name:'Cá kỷ lục',image:null,season_weight:0.7}],server_time:'2026-11-14T00:00:00Z'});
      areas.touchPresence=async()=>({area_id:'lake',fatigue_score:55.5,effects:[{code:'TEST',target:'score',value:-10,name:'Mệt mỏi'}]});
      createApp({render:()=>h('div',[h(LeaderboardModal),h(FishingFatigue,{areaId:'lake'})])}).use(pinia).use(i18n).mount('#app');
    `;
  },
}] });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/\[intlify\]/.test(message.text())) errors.push(message.text()); });
  await page.route('**/rest/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(server.resolvedUrls.local[0] + '__leaderboard');
  await page.getByText('Mùa 2', { exact: true }).waitFor();
  await page.getByText('Mệt mỏi tại bãi: 55,5/100', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Mùa trước', exact: true }).click();
  await page.getByText('Đại sảnh danh vọng · Ba loài dẫn đầu', { exact: true }).waitFor();
  await page.getByText('Tên được vinh danh', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.board.boards[0].entries.map(e => e.rank)), [1, 2]);
  await page.evaluate(() => { window.testI18n.global.locale.value = 'en'; });
  await page.getByText('Hall of Fame · Top three species', { exact: true }).waitFor();
  await page.getByText('Area fatigue: 55.5/100', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Current season', exact: true }).click();
  await page.getByText('Season 2', { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  assert.deepEqual(errors, []);
  process.stdout.write('Validated current/archive navigation, Hall of Fame, distinct ties, fatigue, both locales and mobile width.\n');
} finally { await browser?.close(); await server.close(); }
