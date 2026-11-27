import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { chromium } from 'playwright-core';

const executablePath = process.env.MAP_TEST_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium',
].find(existsSync);
if (!executablePath) throw new Error('Set MAP_TEST_BROWSER to an installed Chromium browser.');

const server = await createServer({
  configFile: false, envDir: false, appType: 'custom',
  server: { host: '127.0.0.1', port: 0, hmr: false },
  plugins: [vue(), {
    name: 'world-map-tiles-fixture',
    configureServer(instance) {
      instance.middlewares.use('/__map', (_request, response) => {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end('<!doctype html><div id="app" style="width:512px"></div><script type="module" src="/__map_fixture.ts"></script>');
      });
    },
    resolveId(id) { if (id === '/__map_fixture.ts') return id; },
    load(id) {
      if (id !== '/__map_fixture.ts') return;
      return `
        import { createApp, h, ref } from 'vue';
        import WorldMap from '/src/components/player/player-world-map/WorldMap.vue';
        const map = ref(), visible = ref(true), tileMode = ref('player');
        window.mapTest = { map, visible, tileMode, picks: [], zooms: [] };
        createApp({ render: () => visible.value ? h(WorldMap, {
          ref: map, pickEnabled: true, tileMode: tileMode.value,
          onPick: point => window.mapTest.picks.push(point),
          onZoom: state => window.mapTest.zooms.push(state),
        }) : null }).mount('#app');
      `;
    },
  }],
});
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    window.tilePaints = [];
    window.tileLabels = [];
    window.tileFrames = [];
    window.whiteFrames = [];
    const strokeRect = CanvasRenderingContext2D.prototype.strokeRect;
    CanvasRenderingContext2D.prototype.strokeRect = function (...args) {
      if (this.strokeStyle === '#ffffff') {
        window.whiteFrames.push({ alpha: this.globalAlpha, time: performance.now(), x: args[0] });
      }
      return strokeRect.apply(this, args);
    };
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      window.tilePaints.push(this.globalAlpha);
      if (args[0] instanceof HTMLImageElement) {
        window.tileFrames.push({ src: args[0].src, alpha: this.globalAlpha, time: performance.now() });
      }
      return drawImage.apply(this, args);
    };
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      window.tileLabels.push(args[0]);
      return fillText.apply(this, args);
    };
  });
  const requests = [];
  const errors = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/__map`);
  await page.waitForFunction(() => window.mapTest?.map.value);
  await page.waitForLoadState('networkidle');
  assert(requests.includes('/world-map-tiles/manifest.json'));
  assert(requests.some(url => /^\/world-map-tiles\/1\/\d+\/\d+\.jpg$/.test(url)));
  assert(!requests.includes('/world_map.jpg'));
  assert(await page.evaluate(() => whiteFrames.some(frame => frame.alpha > 0 && frame.alpha < 1)));
  assert(await page.evaluate(() => tilePaints.every(alpha => alpha === 1)));
  assert.equal(await page.evaluate(() => tileLabels.length), 0);
  await page.waitForFunction(() => new Set(whiteFrames.map(frame => frame.x)).size >= 2);
  const columnStarts = await page.evaluate(() => {
    const starts = new Map();
    for (const frame of whiteFrames) if (!starts.has(frame.x)) starts.set(frame.x, frame.time);
    return [...starts].sort((a, b) => a[0] - b[0]);
  });
  assert(columnStarts.at(-1)[1] - columnStarts[0][1] >= 150);
  for (let i = 1; i < columnStarts.length; i++) assert(columnStarts[i][1] >= columnStarts[i - 1][1]);

  // A deep zoom must load only the visible part of the highest-resolution level.
  await page.evaluate(() => {
    whiteFrames.length = 0;
    mapTest.map.value.setView({ lon: 105, lat: 15, k: 30 });
  });
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => whiteFrames.some(frame => frame.alpha === 0));
  const highTiles = requests.filter(url => /^\/world-map-tiles\/4\//.test(url));
  assert(highTiles.length > 0 && highTiles.length < 512);
  const lastZoom = await page.evaluate(() => mapTest.zooms.at(-1));
  assert.equal(lastZoom.k, 30);
  assert(Math.abs(lastZoom.center[0] - 105) < 0.001);
  assert(Math.abs(lastZoom.center[1] - 15) < 0.001);

  const canvas = page.locator('canvas');
  await canvas.click({ position: { x: 256, y: 256 } });
  const point = await page.evaluate(() => mapTest.picks.at(-1));
  assert(Math.abs(point.lon - 105) < 0.001);
  assert(Math.abs(point.lat - 15) < 0.001);
  // Check that terrain is actually painted, rather than just requested.
  const pixels = await canvas.evaluate(element => {
    const data = element.getContext('2d').getImageData(200, 200, 100, 100).data;
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    return colors.size;
  });
  assert(pixels > 20);

  // Re-entering a cached target level still fades, for long enough to perceive.
  await page.evaluate(() => mapTest.map.value.setView({ lon: 105, lat: 15, k: 1 }));
  await page.waitForLoadState('networkidle');
  const cachedRequests = requests.length;
  await page.evaluate(() => {
    tileFrames.length = 0;
    whiteFrames.length = 0;
    mapTest.map.value.setView({ lon: 105, lat: 15, k: 30 });
  });
  await page.waitForFunction(() => whiteFrames.some(frame => frame.alpha === 0));
  const fadeFrames = await page.evaluate(() => whiteFrames);
  const firstFrame = fadeFrames[0];
  const finishedFrame = fadeFrames.find(frame => frame.alpha === 0);
  assert(firstFrame.alpha > 0.95);
  assert(finishedFrame.time - firstFrame.time >= 300);
  assert(fadeFrames.some(frame => frame.alpha > 0.2 && frame.alpha < 0.8));
  assert.equal(requests.length, cachedRequests);

  await page.evaluate(() => {
    mapTest.tileMode.value = 'admin';
    tilePaints.length = 0;
    whiteFrames.length = 0;
  });
  await page.evaluate(() => mapTest.map.value.setView({ lon: 105, lat: 15, k: 29 }));
  await page.waitForFunction(() => tileLabels.some(label => label.includes('drawn=')));
  assert(await page.evaluate(() => tileLabels.some(label => /^4\/\d+\/\d+ target$/.test(label))));
  assert(await page.evaluate(() => tilePaints.every(alpha => alpha === 1)));
  assert.equal(await page.evaluate(() => whiteFrames.length), 0);

  const beforePan = new Set(requests);
  await page.evaluate(() => mapTest.map.value.setView({ lon: -100, lat: 40, k: 30 }));
  await page.waitForLoadState('networkidle');
  assert(requests.some(url => url.startsWith('/world-map-tiles/4/') && !beforePan.has(url)));
  await page.evaluate(() => mapTest.visible.value = false);
  await page.waitForFunction(() => !document.querySelector('canvas'));
  assert.deepEqual(errors, []);

  // Missing manifest and missing individual tiles both recover via the original image.
  for (const failedUrl of ['**/world-map-tiles/manifest.json', '**/world-map-tiles/*/*/*.jpg']) {
    const failurePage = await browser.newPage();
    const recovered = failurePage.waitForResponse(response => response.url().endsWith('/world_map.jpg') && response.ok());
    await failurePage.route(failedUrl, route => route.fulfill({ status: 404, body: '' }));
    await failurePage.goto(`${origin}/__map`);
    await recovered;
    await failurePage.close();
  }

  // Device pixel ratio must affect the selected level.
  const retina = await browser.newPage({ deviceScaleFactor: 2 });
  const retinaTile = retina.waitForResponse(response => /\/world-map-tiles\/2\/\d+\/\d+\.jpg$/.test(response.url()));
  await retina.goto(`${origin}/__map`);
  await retinaTile;
  await retina.close();
  console.log('World map tiles: levels, visible requests, rendering, coordinates, pan, fallback, DPR and unmount passed.');
} finally {
  await browser?.close();
  await server.close();
}
