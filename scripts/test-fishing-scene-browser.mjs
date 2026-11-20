import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
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
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://scene-test.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
  },
  plugins: [vue(), {
    name: 'fishing-scene-fixture',
    configureServer(instance) {
      instance.middlewares.use('/__scene', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><html><body style="margin:0"><div id="app"></div><script type="module" src="/__scene_fixture.ts"></script></body></html>');
      });
    },
    resolveId(id) { if (id === '/__scene_fixture.ts') return id; },
    load(id) {
      if (id !== '/__scene_fixture.ts') return;
      return `
        import { createApp, computed, h, reactive, ref } from 'vue';
        import { createPinia } from 'pinia';
        import { i18n } from '/src/i18n/index.ts';
        import FishingScene from '/src/components/player/player-fishing/FishingScene.vue';
        import { useDayPhaseStore } from '/src/stores/player-day-phase-store.ts';
        import { useWeatherStore } from '/src/stores/player-weather-store.ts';
        import { useFishingSceneStore } from '/src/stores/player-fishing-scene-store.ts';
        import '/src/styles/theme.css';
        import '/src/styles/animation.css';
        const pinia = createPinia();
        const day = useDayPhaseStore(pinia), weather = useWeatherStore(pinia), scene = useFishingSceneStore(pinia);
        day.setCurrentScenePhase({ id: 'a', scenePath: '/area/VN/777.430', timezone: 'Asia/Ho_Chi_Minh' });
        day.now = Date.parse('2026-11-20T20:00:00+07:00');
        weather.areaId = 'a'; weather.zone = { id: 'zone', weather: { code: 'CLEAR' } };
        const override = ref('');
        const state = reactive({
          canCast: true, castPhase: 'idle', baitRetrievalSequence: 0, baitPosition: { x: 50, y: 65 }, castMessage: '',
          tensionChallenge: null, tensionFight: null, tensionStartedAt: null, tensionReeling: false,
          currentArea: { fishingBoundary: [{x:5,y:40},{x:95,y:40},{x:95,y:95},{x:5,y:95}] },
          castTo(x, y) { state.baitPosition = { x, y }; state.castPhase = 'waiting'; },
          rejectCast() { window.rejected = true; },
        });
        const context = computed(() => ({ state, sceneImage: override.value || scene.sceneImage,
          fallbackSceneImage: scene.fallbackSceneImage, sceneKey: scene.sceneKey, rodImage: '/items/rod/fishing-rob.png' }));
        window.sceneTest = { day, weather, scene, state, setSource(src) { override.value = src; } };
        createApp({ render: () => h(FishingScene, { context: context.value, style: 'width:100vw;height:500px' }) })
          .use(pinia).use(i18n).mount('#app');
      `;
    },
  }],
});

let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${server.resolvedUrls.local[0]}__scene`);
  const waitForImage = async suffix => {
    await page.waitForFunction(suffix => {
      const images = [...document.querySelectorAll('.fishing-scene-background')];
      return images.length === 1 && images[0].src.endsWith(suffix) && images[0].naturalWidth > 0;
    }, suffix);
  };
  await waitForImage('/night.png');
  const surface = page.locator('.pond-image');
  const geometry = await surface.boundingBox();
  await surface.click({ position: { x: geometry.width * 0.4, y: geometry.height * 0.65 } });
  assert.deepEqual(await page.evaluate(() => window.sceneTest.state.baitPosition), { x: 40, y: 65 });
  await page.evaluate(() => { window.sceneTest.weather.zone.weather.code = 'RAIN'; });
  await waitForImage('/night_rain.png');
  assert.deepEqual(await surface.boundingBox(), geometry);
  assert.equal(await page.evaluate(() => window.sceneTest.state.castPhase), 'waiting');
  assert.deepEqual(await page.evaluate(() => window.sceneTest.state.baitPosition), { x: 40, y: 65 });

  await page.route('**/__missing_scene.png', route => route.fulfill({ status: 404, body: '' }));
  await page.evaluate(() => window.sceneTest.setSource('/__missing_scene.png'));
  await waitForImage('/night.png');
  await surface.click({ position: { x: geometry.width * 0.5, y: geometry.height * 0.7 } });
  assert.deepEqual(await page.evaluate(() => window.sceneTest.state.baitPosition), { x: 50, y: 70 });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 650 });
  await page.evaluate(() => window.sceneTest.setSource(''));
  await waitForImage('/night_rain.png');
  const mobile = await surface.boundingBox();
  assert.equal(mobile.width, 390);
  await surface.click({ position: { x: mobile.width * 0.5, y: mobile.height * 0.6 } });
  assert.deepEqual(await page.evaluate(() => window.sceneTest.state.baitPosition), { x: 50, y: 60 });
  const duration = await page.evaluate(() => {
    const image = document.querySelector('.fishing-scene-background');
    image.classList.add('fishing-scene-background-enter-active');
    return getComputedStyle(image).transitionDuration;
  });
  assert.equal(duration, '0s');
  await page.evaluate(() => {
    window.sceneTest.day.setCurrentScenePhase({ id: 'b', scenePath: '/area/VN/780.420', timezone: 'Asia/Ho_Chi_Minh' });
    window.sceneTest.day.now = Date.parse('2026-11-20T12:00:00+07:00');
    window.sceneTest.weather.areaId = 'b';
  });
  await waitForImage('/day_rain.png');
  await surface.click({ position: { x: mobile.width * 0.5, y: mobile.height * 0.6 } });
  assert.deepEqual(await page.evaluate(() => window.sceneTest.state.baitPosition), { x: 50, y: 60 });
  assert.deepEqual(errors, []);
  console.log('Fishing scene browser checks passed: weather swap, fallback, casting geometry, mobile, reduced motion.');
} finally {
  await browser?.close();
  await server.close();
}
