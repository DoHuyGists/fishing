import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';
import { effectScope, nextTick, ref } from 'vue';

const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const zone = (id, code = 'RAIN') => ({
  id, weather: { code }, weather_expires_at: '2026-11-20T13:01:00Z',
  weather_updated_at: '2026-11-20T13:00:00Z', weather_active_modifiers: [],
});

test('weather scenes, ownership and image loading', async t => {
  const server = await createServer({
    configFile: false, server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom', envDir: false,
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://example.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
    },
  });
  const originalDocument = globalThis.document;
  globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  try {
    const { useDayPhaseStore } = await server.ssrLoadModule('/src/stores/player-day-phase-store.ts');
    const { useWeatherStore } = await server.ssrLoadModule('/src/stores/player-weather-store.ts');
    const { useFishingSceneStore } = await server.ssrLoadModule('/src/stores/player-fishing-scene-store.ts');
    const { fishingSceneVariants, resolveFishingScene } = await server.ssrLoadModule('/src/data/fishingSceneVariants.ts');
    const { supabaseZoneRepository: repo } = await server.ssrLoadModule('/src/data/supabaseZoneRepository.ts');
    const { useFishingSceneImage } = await server.ssrLoadModule('/src/composables/useFishingSceneImage.ts');

    await t.test('registered assets exist and missing variants preserve the phase', () => {
      for (const [path, phases] of Object.entries(fishingSceneVariants)) {
        for (const variants of Object.values(phases)) {
          for (const image of Object.values(variants)) {
            assert.ok(existsSync(new URL(`../public${path}/${image}`, import.meta.url)));
          }
        }
      }
      assert.equal(resolveFishingScene('/area/VN/777.430/', 'night', ' rain '), '/area/VN/777.430/night_rain.png');
      assert.equal(resolveFishingScene('/area/VN/780.420', 'day', 'RAIN'), '/area/VN/780.420/day_rain.png');
      for (const phase of ['dawn', 'day', 'dusk', 'night']) {
        assert.equal(resolveFishingScene('/lake', phase, 'RAIN'), `/lake/${phase}.png`);
        assert.equal(resolveFishingScene('/area/VN/777.430', phase, 'UNKNOWN'), `/area/VN/777.430/${phase}.png`);
      }
      assert.equal(resolveFishingScene('/lake', null, 'RAIN'), '');
      assert.equal(resolveFishingScene(null, 'night', 'RAIN'), '');
    });

    await t.test('scene follows matching area weather and clock without changing fish buckets or previews', () => {
      setActivePinia(createPinia());
      const day = useDayPhaseStore(), weather = useWeatherStore(), scene = useFishingSceneStore();
      day.setCurrentScenePhase({ id: 'a', scenePath: '/area/VN/777.430', timezone: 'Asia/Ho_Chi_Minh' });
      day.now = Date.parse('2026-11-20T20:00:00+07:00');
      day.previewArea = { scenePath: '/other', timezone: 'Asia/Ho_Chi_Minh' };
      weather.areaId = 'a'; weather.zone = zone('z');
      assert.equal(scene.sceneImage, '/area/VN/777.430/night_rain.png');
      assert.equal(scene.fallbackSceneImage, '/area/VN/777.430/night.png');
      assert.equal(day.fishTimeBucket, 'NIGHT');
      assert.equal(day.previewScene, '/other/night.png');
      weather.zone = zone('z', 'CLEAR');
      assert.equal(scene.sceneImage, scene.fallbackSceneImage);
      weather.zone = zone('z'); weather.areaId = 'b';
      assert.equal(scene.sceneImage, scene.fallbackSceneImage);
      weather.areaId = 'a';
      day.now = Date.parse('2026-11-21T10:00:00+07:00');
      assert.equal(scene.sceneImage, '/area/VN/777.430/day.png');
      assert.equal(day.fishTimeBucket, 'DAY');
      day.setCurrentScenePhase({ id: 'a', scenePath: '/area/VN/777.430', timezone: 'Invalid/Zone' });
      assert.equal(scene.sceneImage, '');
      scene.$dispose(); weather.$dispose(); day.$dispose();
    });

    await t.test('owners share one clock and subscription, Realtime and expiry work without a panel', async t => {
      setActivePinia(createPinia());
      const weather = useWeatherStore();
      const callbacks = new Map();
      let loads = 0, refreshes = 0, subscriptions = 0, unsubscriptions = 0;
      let nextWeather = 'RAIN';
      t.mock.method(repo, 'fetchZoneByAreaId', async id => { loads++; return zone(id); });
      t.mock.method(repo, 'fetchZoneById', async id => { refreshes++; return zone(id, nextWeather); });
      t.mock.method(repo, 'subscribeToZone', (id, cb) => { subscriptions++; callbacks.set(id, cb); return { id }; });
      t.mock.method(repo, 'unsubscribe', async () => { unsubscriptions++; });
      t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: Date.parse('2026-11-20T13:00:00Z') });
      try {
        const releaseA = weather.retain('a');
        const releaseSameArea = weather.retain('a');
        await settle();
        assert.equal(loads, 1); assert.equal(subscriptions, 1);
        nextWeather = 'CLEAR'; callbacks.get('a')(); await settle();
        assert.equal(weather.weather.code, 'CLEAR');
        releaseA(); releaseA();
        assert.equal(unsubscriptions, 0);
        t.mock.timers.tick(60000); await settle();
        assert.equal(refreshes, 2);
        t.mock.timers.tick(9000); await settle(); assert.equal(refreshes, 2);
        t.mock.timers.tick(1000); await settle(); assert.equal(refreshes, 3);
        const releaseB = weather.retain('b'); await settle();
        releaseSameArea();
        assert.equal(weather.areaId, 'b'); assert.equal(weather.zone.id, 'b');
        assert.equal(subscriptions, 2);
        releaseB(); await settle();
        assert.equal(weather.zone, null); assert.equal(unsubscriptions, 2);
        const stoppedAt = weather.now;
        t.mock.timers.tick(20000);
        assert.equal(weather.now, stoppedAt);
      } finally { weather.$dispose(); t.mock.timers.reset(); t.mock.restoreAll(); }
    });

    await t.test('late loads and Realtime responses cannot replace the new area', async t => {
      setActivePinia(createPinia());
      const weather = useWeatherStore();
      const pendingA = deferred(), pendingRefresh = deferred();
      const callbacks = new Map();
      t.mock.method(repo, 'fetchZoneByAreaId', id => id === 'a' ? pendingA.promise : Promise.resolve(zone(id)));
      t.mock.method(repo, 'fetchZoneById', () => pendingRefresh.promise);
      t.mock.method(repo, 'subscribeToZone', (id, cb) => { callbacks.set(id, cb); return { id }; });
      t.mock.method(repo, 'unsubscribe', async () => {});
      try {
        const a = weather.init('a'); await settle();
        await weather.init('b');
        pendingA.resolve(zone('a')); await a;
        assert.equal(weather.zone.id, 'b'); assert.equal(callbacks.has('a'), false);
        callbacks.get('b')(); await settle();
        await weather.init('c');
        pendingRefresh.resolve(zone('b', 'STORM')); await settle();
        assert.equal(weather.zone.id, 'c'); assert.equal(weather.areaId, 'c');
        callbacks.get('b')(); await settle();
        assert.equal(weather.zone.id, 'c');
      } finally { weather.$dispose(); t.mock.restoreAll(); }
    });

    await t.test('Realtime changes during a refresh trigger a follow-up fetch', async t => {
      setActivePinia(createPinia());
      const weather = useWeatherStore();
      const first = deferred();
      let callback, calls = 0;
      t.mock.method(repo, 'fetchZoneByAreaId', async id => zone(id));
      t.mock.method(repo, 'fetchZoneById', id => ++calls === 1 ? first.promise : Promise.resolve(zone(id, 'CLEAR')));
      t.mock.method(repo, 'subscribeToZone', (_id, cb) => { callback = cb; return {}; });
      t.mock.method(repo, 'unsubscribe', async () => {});
      try {
        await weather.init('a');
        callback(); callback();
        assert.equal(calls, 1);
        first.resolve(zone('a', 'RAIN')); await settle();
        assert.equal(calls, 2); assert.equal(weather.weather.code, 'CLEAR');
      } finally { weather.$dispose(); t.mock.restoreAll(); }
    });

    await t.test('images decode before swapping, fall back on failure, and ignore stale requests', async () => {
      const originalImage = globalThis.Image;
      const requests = new Map();
      globalThis.Image = class {
        decode() { const pending = deferred(); requests.set(this.src, pending); return pending.promise; }
      };
      const scope = effectScope();
      try {
        const src = ref('/night.png'), backup = ref('/night.png'), key = ref('a');
        const displayed = scope.run(() => useFishingSceneImage(src, backup, key));
        assert.equal(displayed.value, '');
        requests.get('/night.png').resolve(); await settle();
        assert.equal(displayed.value, '/night.png');
        src.value = '/night_rain.png'; await nextTick();
        assert.equal(displayed.value, '/night.png');
        requests.get('/night_rain.png').reject(new Error('404')); await settle();
        requests.get('/night.png').resolve(); await settle();
        assert.equal(displayed.value, '/night.png');
        src.value = '/old.png'; await nextTick();
        src.value = '/new.png'; await nextTick();
        requests.get('/new.png').resolve(); await settle();
        requests.get('/old.png').resolve(); await settle();
        assert.equal(displayed.value, '/new.png');
        key.value = 'b'; src.value = '/b.png'; backup.value = '/b.png'; await nextTick();
        assert.equal(displayed.value, '');
        scope.stop(); requests.get('/b.png').resolve(); await settle();
        assert.equal(displayed.value, '');
      } finally { scope.stop(); globalThis.Image = originalImage; }
    });
  } finally { globalThis.document = originalDocument; await server.close(); }
});
