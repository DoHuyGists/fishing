import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createApp, effectScope } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('module refactors preserve data ownership, repository contracts and lake geometry', async t => {
  const server = await createServer({ configFile: false, envDir: false, appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://refactor-test.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key') } });
  const originalFetch = globalThis.fetch;
  try {
    const load = path => server.ssrLoadModule('/src/' + path + '.ts');
    const { useAuthStore } = await load('stores/auth');
    const { resetPlayerSnapshots } = await load('stores/player-snapshot-reset-store');
    const { useEventStore } = await load('stores/player-event-store');
    const { supabaseEventScheduleRepository: events } = await load('data/supabaseEventScheduleRepository');
    const { supabaseFishRepository: fishes } = await load('data/supabaseFishRepository');
    const { useCaughtStore } = await load('stores/player-caught-store');
    const { useFishingStore } = await load('stores/player-fishing-store');
    const { supabaseUserInAreaRepository: areas } = await load('data/supabaseUserInAreaRepository');
    const { supabaseFishingPassAdminRepository: passes } = await load('data/supabaseFishingPassAdminRepository');
    const { setFeatureRequestGuard } = await load('database/featureRequestGate');
    setFeatureRequestGuard(async () => null);
    const init = () => {
      const pinia = createPinia(); pinia.use(resetPlayerSnapshots); createApp({}).use(pinia); setActivePinia(pinia);
      const auth = useAuthStore(); auth.applySession({ user: { id: 'A' } }); return auth;
    };
    const schedule = (id, disabled = false) => ({ id, isDisabled: disabled, viewCount: 0 });

    await t.test('event refresh discards reordered results and repairs a removed selection', async () => {
      init(); const store = useEventStore(); const old = deferred(); let reads = 0, views = 0;
      events.fetchAll = () => ++reads === 1 ? old.promise : Promise.resolve([schedule('new'), schedule('hidden', true)]);
      events.incrementViewCount = async () => { views++; };
      const pending = store.loadSchedules(); await store.loadSchedules();
      old.resolve([schedule('old')]); await pending;
      assert.equal(store.selectedId, 'new'); assert.equal(store.selectedSchedule.viewCount, 1);
      assert.equal(views, 1); assert.equal(store.activeSchedules.length, 1);
      await store.selectSchedule(store.schedules[1]); assert.equal(store.selectedId, 'new');
      events.fetchAll = async () => [schedule('replacement')]; await store.loadSchedules();
      assert.equal(store.selectedId, 'replacement');
      events.fetchAll = async () => []; await store.loadSchedules();
      assert.equal(store.selectedSchedule, null); assert.equal(store.selectedId, null);
    });
    await t.test('event load errors preserve confirmed data; late views cannot alter a new snapshot/session', async () => {
      const auth = init(), store = useEventStore(), view = deferred();
      events.fetchAll = async () => [schedule('same')]; events.incrementViewCount = async () => {};
      await store.loadSchedules(); const original = store.selectedSchedule;
      events.incrementViewCount = () => view.promise;
      const pending = store.selectSchedule(original);
      await store.loadSchedules(); view.resolve(); await pending;
      assert.equal(store.selectedSchedule.viewCount, 0);
      events.fetchAll = async () => { throw new Error('offline'); }; await store.loadSchedules();
      assert.equal(store.loadError, 'offline'); assert.equal(store.selectedId, 'same');
      const late = deferred(); events.fetchAll = () => late.promise;
      const request = store.loadSchedules(); auth.applySession(null); auth.applySession({ user: { id: 'B' } });
      late.resolve([schedule('private-old')]); await request;
      assert.equal(store.schedules.length, 0); assert.equal(store.isLoading, false);
    });
    await t.test('caught actions remove only confirmed fish and ignore old session success/errors', async () => {
      const auth = init(), store = useCaughtStore(); store.caughtFishes = [{ id: 'fish' }, { id: 'keep' }];
      fishes.deleteCaughtFish = async () => { throw new Error('denied'); };
      await assert.rejects(store.releaseFish('fish'), /denied/); assert.equal(store.caughtFishes.length, 2);
      fishes.listFishOnMarket = async (id, price) => { assert.equal(id, 'fish'); assert.equal(price, 12); };
      assert.equal(await store.listFishForSale('fish', 12), true);
      assert.deepEqual(store.caughtFishes.map(fish => fish.id), ['keep']);
      for (const failure of [false, true]) {
        const late = deferred(); fishes.deleteCaughtFish = () => late.promise;
        const request = store.releaseFish('keep'); auth.applySession(null); auth.applySession({ user: { id: 'B' } });
        store.caughtFishes = [{ id: 'keep' }];
        if (failure) late.reject(new Error('old error')); else late.resolve();
        assert.equal(await request, false); assert.equal(store.caughtFishes.length, 1);
      }
    });
    await t.test('nearby catches keep the existing query scope, propagate errors and skip empty IDs', async () => {
      init(); let calls = 0;
      globalThis.fetch = async input => {
        const url = new URL(input instanceof Request ? input.url : String(input)); calls++;
        assert.equal(url.origin, 'https://refactor-test.supabase.co');
        assert.equal(url.pathname, '/rest/v1/caught');
        assert.equal(url.searchParams.get('select'), 'user_id,weight,species(name)');
        assert.equal(url.searchParams.get('user_id'), 'in.(A,B)');
        assert.equal(url.searchParams.has('area_id'), false);
        return Response.json({ message: 'not allowed', code: '42501' }, { status: 403 });
      };
      assert.deepEqual(await fishes.fetchNearbyCatches([]), []); assert.equal(calls, 0);
      await assert.rejects(fishes.fetchNearbyCatches(['A', 'B']), /not allowed/);
    });
    await t.test('nearby statistics keep count/best fish and reject late account responses', async () => {
      const auth = init(), store = useFishingStore(); store.currentAreaId = 'lake';
      areas.fetchUsersInArea = async () => [{ id: 'membership', user_id: 'A' }];
      fishes.fetchNearbyCatches = async () => [{ user_id: 'A', weight: '3.5', species: { name: 'Carp' } },
        { user_id: 'A', weight: 1, species: [{ name: 'Small' }] }];
      await store.fetchPlayersInArea('lake');
      assert.equal(store.nearbyPlayers[0].caughtCount, 2); assert.equal(store.nearbyPlayers[0].bestCatch, 'Carp 3.5 kg');
      const late = deferred(); areas.fetchUsersInArea = () => late.promise;
      const pending = store.fetchPlayersInArea('lake'); auth.applySession(null); auth.applySession({ user: { id: 'B' } });
      store.nearbyPlayers = [];
      late.resolve([{ id: 'old', user_id: 'A' }]); await pending; assert.deepEqual(store.nearbyPlayers, []);
    });
    await t.test('admin fishing pass preserves table, payload mapping and error semantics after moving files', async () => {
      init(); const payload = { name: 'Pass', description: null, price: 5, totalDays: 7, startAt: 'start', endAt: 'end', isActive: true };
      globalThis.fetch = async (input, options) => {
        const request = input instanceof Request ? input : new Request(input, options);
        const url = new URL(request.url); assert.equal(url.pathname, '/rest/v1/fishing_passes');
        assert.equal(request.method, 'POST');
        const body = await request.json(); assert.equal(body.total_days, 7); assert.equal(body.is_active, true);
        assert.equal(body.start_at, 'start'); assert.equal('totalDays' in body, false);
        return Response.json({ ...body, id: 'pass', price: '5', created_at: 'created' });
      };
      assert.deepEqual(await passes.create(payload), { ...payload, id: 'pass', createdAt: 'created' });
      globalThis.fetch = async () => Response.json({ message: 'denied', code: '42501' }, { status: 403 });
      await assert.rejects(passes.remove('pass'), /denied/);
    });
    await t.test('lake editor isolates instances and preserves presets, partition and node/zone limits', async () => {
      const { useLakeEditor } = await load('composables/useLakeEditor');
      const scope = effectScope();
      try {
        const first = scope.run(() => useLakeEditor()), second = scope.run(() => useLakeEditor());
        for (const preset of first.presets) {
          first.applyPreset(preset.key);
          assert.ok(first.lake.value.length >= 4);
          assert.equal(first.inLake({ x: 300, y: 200 }), true);
          assert.equal(first.cells.value.length, 5);
          assert.ok(first.cells.value.every(cell => Number.isFinite(cell.percent) && !/NaN/.test(cell.d)));
          assert.ok(Math.abs(first.cells.value.reduce((sum, cell) => sum + cell.percent, 0) - 100) <= 3);
        }
        first.applyPreset('natural');
        for (let i = 0; i < 30; i++) first.addNodeAuto();
        assert.equal(first.naturalPts.value.length, first.NODE_MAX);
        for (let i = 0; i < 30; i++) first.removeNode(0);
        assert.equal(first.naturalPts.value.length, first.NODE_MIN);
        for (let i = 0; i < 10; i++) first.addZone();
        assert.equal(first.zones.value.length, first.MAX_ZONES); assert.equal(second.zones.value.length, 5);
        const selected = first.selectedId.value; first.removeZone(selected); assert.equal(first.selected.value, null);
      } finally { scope.stop(); }
    });
  } finally { globalThis.fetch = originalFetch; await server.close(); }
});
