import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

test('area clock, scene and fish conditions share the area timezone', async t => {
  const server = await createServer({
    configFile: false, server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom', envDir: false,
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://example.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
    },
  });
  try {
    const { useDayPhaseStore } = await server.ssrLoadModule('/src/stores/dayPhase.ts');
    const { supabaseFishingAreaRepository: repo } = await server.ssrLoadModule('/src/data/supabaseFishingAreaRepository.ts');
    const { setFeatureRequestGuard } = await server.ssrLoadModule('/src/database/featureRequestGate.ts');
    setActivePinia(createPinia());
    const store = useDayPhaseStore();
    const area = { scenePath: '/lake', timezone: 'Asia/Ho_Chi_Minh' };

    await t.test('crosses all scene boundaries, fish boundaries and midnight', () => {
      store.setCurrentScenePhase(area);
      for (const [time, phase, bucket] of [
        ['02:59:59', 'night', 'NIGHT'], ['03:00:00', 'dawn', 'NIGHT'],
        ['05:59:59', 'dawn', 'NIGHT'], ['06:00:00', 'dawn', 'DAY'],
        ['08:59:59', 'dawn', 'DAY'], ['09:00:00', 'day', 'DAY'],
        ['16:59:59', 'day', 'DAY'], ['17:00:00', 'dusk', 'DAY'],
        ['18:59:59', 'dusk', 'DAY'], ['19:00:00', 'night', 'NIGHT'],
        ['23:59:59', 'night', 'NIGHT'], ['00:00:00', 'night', 'NIGHT'],
      ]) {
        store.now = Date.parse(`2026-11-18T${time}+07:00`);
        assert.equal(store.currentPhase.key, phase, time);
        assert.equal(store.currentScenePhace, `/lake/${phase}.png`, time);
        assert.equal(store.fishTimeBucket, bucket, time);
        assert.ok(store.timeLabel.includes(time), store.timeLabel);
        assert.ok(store.currentPhase.icon.endsWith('.png'));
        assert.ok(store.currentPhase.label);
      }
    });

    await t.test('ignores device timezone and follows DST transitions', () => {
      const originalTZ = process.env.TZ;
      try {
        store.now = Date.parse('2026-11-18T00:00:00Z');
        for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
          process.env.TZ = tz;
          assert.ok(store.timeLabel.includes('07:00:00'));
          assert.equal(store.currentPhase.key, 'dawn');
        }
        store.setCurrentScenePhase({ ...area, timezone: 'America/New_York' });
        for (const [instant, local] of [
          ['2026-03-08T06:59:59Z', '01:59:59'], ['2026-03-08T07:00:00Z', '03:00:00'],
          ['2026-11-01T05:59:59Z', '01:59:59'], ['2026-11-01T06:00:00Z', '01:00:00'],
        ]) {
          store.now = Date.parse(instant);
          assert.ok(store.timeLabel.includes(local), store.timeLabel);
        }
      } finally {
        if (originalTZ === undefined) delete process.env.TZ;
        else process.env.TZ = originalTZ;
      }
    });

    await t.test('missing or invalid timezones never silently use device time', () => {
      for (const timezone of [null, '', 'Invalid/Zone']) {
        store.setCurrentScenePhase({ ...area, timezone });
        assert.equal(store.currentPhase, null);
        assert.equal(store.timeLabel, '');
        assert.equal(store.fishTimeBucket, null);
        assert.equal(store.currentScenePhace, '');
      }
    });

    await t.test('one timer is shared, visibility catches up immediately, remount cleans up', () => {
      const originalDocument = globalThis.document;
      const document = new EventTarget();
      document.visibilityState = 'visible';
      globalThis.document = document;
      t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: Date.parse('2026-11-18T08:59:59+07:00') });
      let activeTimers = 0;
      const originalSet = globalThis.setInterval;
      const originalClear = globalThis.clearInterval;
      globalThis.setInterval = (...args) => { activeTimers++; return originalSet(...args); };
      globalThis.clearInterval = id => { if (id !== undefined) activeTimers--; originalClear(id); };
      try {
        store.setCurrentScenePhase(area);
        const releaseA = store.retainClock(), releaseB = store.retainClock();
        assert.equal(activeTimers, 1);
        assert.equal(store.currentPhase.key, 'dawn');
        t.mock.timers.tick(1000);
        assert.equal(store.currentPhase.key, 'day');
        t.mock.timers.setTime(Date.parse('2026-11-18T21:00:00+07:00'));
        document.dispatchEvent(new Event('visibilitychange'));
        assert.equal(store.currentPhase.key, 'night');
        assert.equal(store.currentScenePhace, '/lake/night.png');
        releaseA(); releaseA();
        assert.equal(activeTimers, 1);
        store.$reset(); // Session resets must not orphan the active timer.
        releaseB();
        assert.equal(activeTimers, 0);
        const previous = store.now;
        t.mock.timers.setTime(previous + 5000);
        document.dispatchEvent(new Event('visibilitychange'));
        assert.equal(store.now, previous);
        const releaseC = store.retainClock();
        assert.equal(activeTimers, 1);
        releaseC();
        assert.equal(activeTimers, 0);
      } finally {
        globalThis.setInterval = originalSet;
        globalThis.clearInterval = originalClear;
        t.mock.timers.reset();
        globalThis.document = originalDocument;
      }
    });

    await t.test('repository matches SQL timezone inheritance, including blank and invalid overrides', async () => {
      const originalFetch = globalThis.fetch;
      setFeatureRequestGuard(async () => null);
      try {
        for (const [override, country, expected] of [
          [' Asia/Tokyo ', 'UTC', 'Asia/Tokyo'], ['', ' America/New_York ', 'America/New_York'],
          ['  ', 'Asia/Bangkok', 'Asia/Bangkok'], [null, null, null],
          ['Invalid/Zone', 'UTC', 'Invalid/Zone'],
        ]) {
          globalThis.fetch = async input => {
            const url = new URL(input instanceof Request ? input.url : String(input));
            assert.equal(url.searchParams.get('id'), 'eq.area');
            assert.ok(url.searchParams.get('select').includes('country:countries!country_id(default_timezone)'));
            return Response.json({ id: 'area', timezone: override, country: { default_timezone: country } });
          };
          assert.equal((await repo.fetchOneAreas('area')).timezone, expected);
        }
      } finally { globalThis.fetch = originalFetch; }
    });

    await t.test('late map previews cannot overwrite the current selection or fishing scene', async () => {
      const original = repo.fetchOneAreas;
      const resolvers = new Map();
      repo.fetchOneAreas = id => new Promise(resolve => resolvers.set(id, resolve));
      try {
        store.setCurrentScenePhase(area);
        store.now = Date.parse('2026-11-18T12:00:00+07:00');
        const first = store.loadPreviewArea('a'), second = store.loadPreviewArea('b');
        resolvers.get('b')({ ...area, scenePath: '/b' }); await second;
        resolvers.get('a')({ ...area, scenePath: '/a' }); await first;
        assert.equal(store.previewScene, '/b/day.png');
        assert.equal(store.currentScenePhace, '/lake/day.png');
        await store.loadPreviewArea(null);
        assert.equal(store.previewScene, '');
      } finally { repo.fetchOneAreas = original; }
    });
    store.$dispose();
  } finally { await server.close(); }
});
