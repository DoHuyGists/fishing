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
      repo.fetchTop=async(page,criterion)=>({items:Array.from({length:page===1?10:2},(_,index)=>({...player,
        id:index===0&&page===1?'player':'player-'+page+'-'+index,display_name:'Angler '+page+' '+index,
        score:1000-((page-1)*10+index)*10,total_caught:100-((page-1)*10+index)})),total:12});
      repo.fetchByUser=async()=>({...player,score:1000,total_caught:100});
      repo.countHigher=async(value,criterion)=>criterion==='score'?(1000-value)/10:100-value;
      const archiveId='1479943f-d8bc-48ca-b49f-80701df0de1b',currentId='82dbaf73-3577-480c-8eb8-8584e4ef0a9a';
      repo.fetchSeasonBoard=async(page,seasonId)=>({items:[player,{...player,id:'other',display_name:'Other',rank:2}],total:2,my_entry:player,
        season:{id:seasonId??currentId,season_number:seasonId===archiveId?1:2,starts_at:'2026-11-01T00:00:00Z',ends_at:'2026-11-15T00:00:00Z',finalized_at:seasonId===archiveId?'2026-11-15T00:00:00Z':null},
        current_season_id:currentId,previous_season_id:seasonId===archiveId?null:archiveId,next_season_id:seasonId===archiveId?currentId:null,
        hall_of_fame:seasonId===archiveId?[{rank:1,user_id:'player',display_name:'Tên được vinh danh',fish,caught_at:fish.caught_at}]:[],
        meta:[{species_id:'species',name:'Cá kỷ lục',image:null,season_weight:0.7}],server_time:'2026-11-14T00:00:00Z'});
      areas.touchPresence=async()=>({area_id:'lake',fatigue_score:55.5,effects:[{code:'TEST',target:'score',value:-10,name:'Mệt mỏi'}]});
      window.presenceCalls=0; window.previewCalls=0;
      const touch=areas.touchPresence;
      areas.touchPresence=async()=>{window.presenceCalls++;return touch();};
      areas.fetchFatigue=async(areaId)=>{window.previewCalls++;return {area_id:areaId,fatigue_score:0,effects:[]};};
      createApp({render:()=>h('div',[h(LeaderboardModal),h(FishingFatigue,{areaId:'lake',presence:true}),h(FishingFatigue,{areaId:'preview-lake'})])}).use(pinia).use(i18n).mount('#app');
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
  await page.getByText('Mệt mỏi tại bãi: 0/100', { exact: true }).waitFor();
  assert.equal(await page.getByRole('progressbar').nth(0).getAttribute('aria-valuenow'), '55.5');
  assert.equal(await page.getByRole('progressbar').nth(1).getAttribute('aria-valuenow'), '0');
  assert.deepEqual(await page.evaluate(()=>[window.presenceCalls,window.previewCalls]), [1,1]);
  await page.getByText('Chưa bị giảm hiệu quả do mệt mỏi.', {exact:true}).waitFor();
  assert.equal(await page.getByRole('tab').count(), 4);
  await page.getByRole('tab', { name: 'Đại sảnh danh vọng', exact: false }).click();
  await page.getByText('Mùa này chưa kết thúc. Hãy chọn mùa trước để xem các thành tích đã được vinh danh.', { exact: true }).waitFor();
  assert.equal(await page.locator('section aside').count(), 0);
  await page.getByRole('button', { name: 'Mùa trước', exact: true }).click();
  await page.getByText('Đại sảnh danh vọng · Ba loài dẫn đầu', { exact: true }).waitFor();
  await page.getByText('Tên được vinh danh', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.board.seasonBoard.items.map(e => e.rank)), [1, 2]);
  await page.evaluate(() => { window.testI18n.global.locale.value = 'en'; });
  await page.getByText('Hall of Fame · Top three species', { exact: true }).waitFor();
  await page.getByText('Area fatigue: 55.5/100', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Current season', exact: true }).click();
  await page.getByText('Season 2', { exact: true }).waitFor();
  await page.getByRole('tab').nth(2).click();
  await page.getByText('Season 2', { exact: true }).waitFor();
  const rules = page.locator('details');
  assert.equal(await rules.evaluate(element => element.open), false);
  await page.getByText('Rules & seasonal multipliers', { exact: true }).click();
  assert.equal(await rules.evaluate(element => element.open), true);
  await page.getByText('Rules & seasonal multipliers', { exact: true }).click();

  for (const criterion of ['score', 'total_caught']) {
    await page.getByRole('tab').nth(criterion === 'score' ? 0 : 1).click();
    await page.getByText('Angler 1 0', { exact: true }).waitFor();
    const podium = page.getByLabel('Top three', { exact: true });
    assert.equal(await podium.count(), 1);
    const cards = podium.locator(':scope > div');
    const positions = await cards.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().x));
    assert.ok(positions[1] < positions[0] && positions[0] < positions[2], 'Podium places the leader in the center');
    assert.equal(await page.locator('section aside').count(), 1);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByText('Angler 2 0', { exact: true }).waitFor();
    assert.equal(await podium.count(), 0);
    assert.deepEqual(await page.evaluate(() => window.board.boards[0].entries.map(entry => entry.rank)), [11, 12]);
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await page.getByText('Angler 1 0', { exact: true }).waitFor();
  }

  if (process.env.LEADERBOARD_TEST_SCREENSHOT) await page.screenshot({ path: process.env.LEADERBOARD_TEST_SCREENSHOT + '-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  if (process.env.LEADERBOARD_TEST_SCREENSHOT) await page.screenshot({ path: process.env.LEADERBOARD_TEST_SCREENSHOT + '-mobile.png' });
  await page.setViewportSize({ width: 320, height: 740 });
  for (let index = 0; index < 3; index++) {
    await page.getByRole('tab').nth(index).click();
    await page.waitForFunction(() => !window.board.loading);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    const panel = page.getByRole('tabpanel');
    assert.ok(await panel.evaluate(element => element.scrollWidth <= element.clientWidth), 'Ranking fits the smallest mobile width');
  }
  assert.deepEqual(errors, []);
  process.stdout.write('Validated all three tabs, podium order, pagination, personal rank, season rules and navigation, Hall of Fame, distinct ties, fatigue, both locales and mobile widths.\n');
} finally { await browser?.close(); await server.close(); }
