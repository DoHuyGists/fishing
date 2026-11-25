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
import DispatchModal from '/src/components/player/player-dispatch/DispatchModal.vue';
import { useDispatchStore } from '/src/stores/player-dispatch-store';
import { i18n } from '/src/i18n';
import '/src/styles/index.css';
const pinia = createPinia(), store = useDispatchStore(pinia);
const text = (vi, en) => ({vi, en});
const npc = {id:'fox',name:text('Cáo đỏ','Red fox'),description:text('Nhanh nhẹn, phù hợp với những chuyến điều động đơn giản.','Agile and suited to simple assignments.'),image_path:'/missing-npc.png',enabled:true,purchase_shells:100,operating_cash:1000,data:{stats:{strength:12,navigation:18,perception:24}}};
const job = {id:'job',name:text('Vận chuyển hàng hóa','Deliver supplies'),description:text('Chuyển vật tư tới bến hồ.','Deliver supplies to the lake dock.'),image_path:'',enabled:true,duration_seconds:1800,data:{requirements:{strength:10,navigation:8}},rewards:{cash:5000,shells:2}};
const run = {id:'run',owned_npc_id:'busy-owned',npc_snapshot:npc,job_snapshot:job,rewards:job.rewards,operating_cash:1000,started_at:new Date(Date.now()-600000).toISOString(),ends_at:new Date(Date.now()+1200000).toISOString()};
store.initialize = async () => {
  store.snapshot = {npcs:Array.from({length:10},(_,i)=>({...npc,id:i===0?'fox':'npc'+i,name:i===0?npc.name:text('Gấu nâu '+i,'Brown bear '+i),description:i%2?{}:npc.description})),jobs:[job],owned:[{id:'owned',npc_id:'fox'}],runs:[run]};
};
store.fetchHistory = async () => { store.history = [{...run,id:'history',outcome:'claimed',resolved_at:new Date().toISOString()}]; };
store.refresh = async () => true;
i18n.global.locale.value = new URLSearchParams(location.search).get('lang');
createApp(DispatchModal).use(pinia).use(i18n).mount('#app'); window.dispatchStore=store;
`;
const server = await createServer({
  configFile:false,envDir:false,appType:'custom',server:{host:'127.0.0.1',port:0,hmr:false},
  define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://layout-test.supabase.co'),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('test-key')},
  plugins:[vue(),tailwindcss(),{
    name:'dispatch-layout-fixture',
    configureServer(instance){instance.middlewares.use('/__dispatch',(_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html class="ocean-theme"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/dispatch-fixture.ts"></script></body></html>');});},
    resolveId(id){if(id==='/dispatch-fixture.ts')return id;},
    load(id){if(id==='/dispatch-fixture.ts')return fixture;},
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({executablePath,headless:true});
  const page = await browser.newPage({reducedMotion:'reduce'}), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://**/*',route=>route.abort());
  for(const lang of ['vi','en']){
    for(const [width,height] of [[320,568],[390,844],[768,1024],[1024,768],[1908,875]]){
      await page.setViewportSize({width,height});
      await page.goto(server.resolvedUrls.local[0]+'__dispatch?lang='+lang);
      await page.locator('article').first().waitFor();
      for(const tab of ['npcs','jobs','runs','history']){
        await page.evaluate(tab=>{window.dispatchStore.tab=tab;},tab);
        await page.evaluate(()=>new Promise(requestAnimationFrame));
        const result=await page.evaluate(()=>{
          const panel=[...document.querySelectorAll('[role="tabpanel"]')].find(el=>getComputedStyle(el).display!=='none');
          const content=document.querySelector('.shared-modal__content');
          content.scrollTop=content.scrollHeight;
          return {
            overflow:[panel,...panel.querySelectorAll('article, article > div'),document.querySelector('form')].some(el=>el.scrollWidth>el.clientWidth+2),
            clipped:[...panel.querySelectorAll('article')].some(el=>el.scrollHeight>el.clientHeight+2),
            bottom:panel.getBoundingClientRect().bottom<=innerHeight+2,
          };
        });
        assert.deepEqual(result,{overflow:false,clipped:false,bottom:true},lang+' '+tab+' '+width+'x'+height);
      }
      await page.evaluate(()=>{window.dispatchStore.tab='npcs';});
      await page.locator('[role="tabpanel"]:visible article').first().getByRole('button').click();
      assert.equal(await page.evaluate(()=>window.dispatchStore.tab),'jobs');
      await page.locator('[role="tabpanel"]:visible article').first().getByRole('button').click();
      assert.equal(await page.evaluate(()=>window.dispatchStore.selectedJobId),'job');
      assert.equal(await page.locator('form button[type="submit"]').isEnabled(),true);
      await page.evaluate(()=>{window.dispatchStore.busy=true;});
      assert.equal(await page.locator('form button[type="submit"]').isDisabled(),true);
    }
  }
  assert.deepEqual(errors,[]);
  console.log('Dispatch layout and selection passed: 40 tab, viewport and language combinations.');
} finally {await browser?.close();await server.close();}
