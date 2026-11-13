import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';
import { createApp } from 'vue';

test('HTTP read cache preserves gameplay mutations, owners and response semantics', async t => {
  const server = await createServer({ configFile: false, envDir: false, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom',
    define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://read-test.supabase.co'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test') } });
  const realNow = Date.now;
  let clock = realNow(); Date.now = () => clock;
  const base = 'https://read-test.supabase.co/rest/v1/';
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  try {
    const { useReadCacheStore } = await server.ssrLoadModule('/src/stores/readCache.ts');
    const { useAuthStore } = await server.ssrLoadModule('/src/stores/auth.ts');
    const { useFeatureAvailabilityStore } = await server.ssrLoadModule('/src/stores/featureAvailability.ts');
    const { createReadCacheFetch, createReadCacheContextFetch, setReadCacheHandler } = await server.ssrLoadModule('/src/database/readCacheRequests.ts');
    const { createFeatureFetch, setFeatureRequestGuard } = await server.ssrLoadModule('/src/database/featureRequestGate.ts');
    const init = transport => {
      setActivePinia(createPinia()); const auth = useAuthStore(); auth.applySession({ user: { id: 'a' } });
      useFeatureAvailabilityStore().checkRequests = async () => null;
      const store = useReadCacheStore(); setReadCacheHandler(() => store.capture());
      return { auth, store, fetch: createReadCacheFetch('https://read-test.supabase.co', transport) };
    };
    const caught = (fetch, options = {}) => fetch(base + 'rpc/get_caught_in_home', { method: 'POST', body: '{}', ...options });
    await t.test('ten callers share one request; reopening uses RAM; expiry and explicit invalidation fetch again', async () => {
      let calls = 0;
      const { store, fetch } = init(async () => { calls++; return Response.json([{ id: 'fish' }]); });
      const responses = await Promise.all(Array.from({ length: 10 }, () => caught(fetch)));
      for (const response of responses) assert.equal((await response.json())[0].id, 'fish');
      await (await caught(fetch)).json(); assert.equal(calls, 1);
      assert.equal(store.inspect().counts.caught.ramHit, 1);
      clock += 30_001; await caught(fetch); assert.equal(calls, 2);
      await store.invalidate(['caught']); await caught(fetch); assert.equal(calls, 3);
    });
    await t.test('successful RPC and direct table writes invalidate before the next read; failed writes do not', async () => {
      let reads = 0, writes = 0, fail = false;
      const { fetch } = init(async input => {
        if (String(input).includes('get_caught_in_home')) return Response.json([{ id: ++reads }]);
        writes++; return fail ? Response.json({ success: false }, { status: 200 }) : new Response(null, { status: 204 });
      });
      await caught(fetch);
      await fetch(base + 'rpc/execute_game_catalog_action', { method: 'POST', body: JSON.stringify({ p_action: 'purchase_item' }) });
      assert.equal((await (await caught(fetch)).json())[0].id, 2);
      fail = true; await fetch(base + 'rpc/release_in_net_fishes', { method: 'POST' }); await caught(fetch); assert.equal(reads, 2);
      fail = false; await fetch(base + 'caught?id=eq.fish', { method: 'DELETE' }); await caught(fetch);
      assert.equal(reads, 3); assert.equal(writes, 3);
    });
    await t.test('in-flight pre-mutation snapshots are discarded and reconciled once', async () => {
      let release, started; let reads = 0;
      const ready = new Promise(resolve => { started = resolve; });
      const { fetch } = init(async input => {
        if (!String(input).includes('get_caught_in_home')) return new Response(null, { status: 204 });
        reads++;
        if (reads === 1) return new Promise(resolve => { release = () => resolve(Response.json([{ id: 'old' }])); started(); });
        return Response.json([{ id: 'new' }]);
      });
      const pending = caught(fetch); await ready;
      await fetch(base + 'rpc/move_species', { method: 'POST' }); release();
      assert.equal((await (await pending).json())[0].id, 'new'); assert.equal(reads, 2);
    });
    await t.test('empty 201 writes and uncertain write outcomes invalidate; mutations are never retried', async () => {
      let reads = 0, writes = 0, outcome = 'created';
      const { fetch } = init(async (_input, options) => {
        if (options?.method === 'POST' && String(_input).includes('/caught')) {
          writes++;
          if (outcome === 'network') throw new TypeError('Network disconnected after commit');
          if (outcome === 'server') return Response.json({ message: 'unknown outcome' }, { status: 503 });
          return new Response(null, { status: 201 });
        }
        return Response.json([{ id: ++reads }]);
      });
      const write = () => fetch(base + 'caught', { method: 'POST', body: '{}' });
      await caught(fetch); assert.equal((await write()).status, 201); await caught(fetch); assert.equal(reads, 2);
      outcome = 'server'; assert.equal((await write()).status, 503); await caught(fetch); assert.equal(reads, 3);
      outcome = 'network'; await assert.rejects(write(), /Network disconnected/); await caught(fetch); assert.equal(reads, 4);
      assert.equal(writes, 3);
    });
    await t.test('Cache-Control no-cache forces a fresh response', async () => {
      let calls = 0; const { fetch } = init(async () => { calls++; return Response.json([]); });
      await caught(fetch); await caught(fetch); assert.equal(calls, 1);
      await caught(fetch, { headers: { 'Cache-Control': 'no-cache' } }); assert.equal(calls, 2);
    });
    await t.test('query, range, count and locale form distinct keys; Content-Range survives replay', async () => {
      let calls = 0;
      const { fetch } = init(async () => { calls++; return Response.json([], { headers: { 'Content-Range': '0-19/45' } }); });
      const url = base + 'species_market?select=id&offset=0';
      const read = headers => fetch(url, { headers });
      await read({ Range: '0-19', Prefer: 'count=exact', 'Accept-Language': 'vi' });
      const hit = await read({ Range: '0-19', Prefer: 'count=exact', 'Accept-Language': 'vi' });
      assert.equal(hit.headers.get('Content-Range'), '0-19/45'); assert.equal(calls, 1);
      await read({ Range: '20-39', Prefer: 'count=exact', 'Accept-Language': 'vi' });
      await read({ Range: '0-19', Prefer: 'count=exact', 'Accept-Language': 'en' });
      await fetch(base + 'species_market?select=id&offset=20'); assert.equal(calls, 4);
    });
    await t.test('logout rejects old requests; new login never reuses private snapshots', async () => {
      let release, started; let calls = 0;
      const ready = new Promise(resolve => { started = resolve; });
      const { auth, fetch } = init(async () => {
        calls++; if (calls === 1) return new Promise(resolve => { release = () => resolve(Response.json([{ id: 'a' }])); started(); });
        return Response.json([{ id: 'b' }]);
      });
      const pending = caught(fetch); await ready;
      const rejected = assert.rejects(pending, /Cache context changed/);
      auth.applySession(null); auth.applySession({ user: { id: 'b' } }); release(); await rejected;
      assert.equal((await (await caught(fetch)).json())[0].id, 'b'); assert.equal(calls, 2);
    });
    await t.test('feature denial still blocks a fresh cached response', async () => {
      let calls = 0, disabled = false;
      const { fetch } = init(async () => { calls++; return Response.json([]); });
      setFeatureRequestGuard(async () => disabled ? { message: 'maintenance' } : null);
      const gated = createFeatureFetch('https://read-test.supabase.co', fetch);
      await gated(base + 'rpc/get_spin_wheel_rewards', { method: 'POST', body: '{}' });
      disabled = true;
      assert.equal((await gated(base + 'rpc/get_spin_wheel_rewards', { method: 'POST', body: '{}' })).status, 403);
      assert.equal(calls, 1);
    });
    await t.test('a token retrieved before a login switch cannot enter the new account cache or send a mutation', async () => {
      let calls = 0; const { auth, fetch } = init(async () => { calls++; return Response.json([]); });
      auth.applySession({ user: { id: 'a' }, access_token: 'token-a' });
      await caught(fetch, { headers: { Authorization: 'Bearer token-a' } }); assert.equal(calls, 1);
      auth.applySession({ user: { id: 'b' }, access_token: 'token-b' });
      await assert.rejects(caught(fetch, { headers: { Authorization: 'Bearer token-a' } }), /Cache context changed/);
      await assert.rejects(fetch(base + 'rpc/move_species', { method: 'POST', headers: { Authorization: 'Bearer token-a' } }), /Cache context changed/);
      assert.equal(calls, 1);
      await caught(fetch, { headers: { Authorization: 'Bearer token-b' } }); assert.equal(calls, 2);
      const rotated = 'header.' + Buffer.from(JSON.stringify({ sub: 'b', iat: 2 })).toString('base64url') + '.signature';
      await caught(fetch, { headers: { Authorization: 'Bearer ' + rotated } });
      assert.equal(calls, 2, 'Same-owner token rotation must preserve a warm cache');
    });
    await t.test('a login change during asynchronous feature authorization cannot cache the old request under the new owner', async () => {
      let release, started, calls = 0;
      const ready = new Promise(resolve => { started = resolve; });
      const { auth, fetch } = init(async () => { calls++; return Response.json([{ id: 'old' }]); });
      setFeatureRequestGuard(() => new Promise(resolve => { release = () => resolve(null); started(); }));
      const gated = createReadCacheContextFetch(createFeatureFetch('https://read-test.supabase.co', fetch));
      const pending = gated(base + 'rpc/get_spin_wheel_rewards', { method: 'POST', body: '{}' });
      const rejected = assert.rejects(pending, /Cache context changed/);
      await ready; auth.applySession({ user: { id: 'b' } }); release(); await rejected;
      assert.equal(calls, 0);
      assert.deepEqual((await (await caught(fetch)).json())[0], { id: 'old' }); assert.equal(calls, 1);
    });
    await t.test('429 returns the original error, then cools down without another HTTP request', async () => {
      let calls = 0;
      const { fetch } = init(async () => { calls++; return calls === 1 ? Response.json({ code: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': '90' } }) : Response.json([]); });
      assert.equal((await caught(fetch)).status, 429);
      await assert.rejects(caught(fetch)); assert.equal(calls, 1);
      clock += 90_001; assert.equal((await caught(fetch)).status, 200); assert.equal(calls, 2);
    });
    await t.test('permission failures are never cached; session authority reads bypass caching', async () => {
      let calls = 0;
      const { fetch } = init(async () => { calls++; return Response.json({ message: 'denied' }, { status: 403 }); });
      await caught(fetch); await caught(fetch); assert.equal(calls, 2);
      await fetch(base + 'rpc/get_aquaculture_farm', { method: 'POST' });
      await fetch(base + 'rpc/get_aquaculture_farm', { method: 'POST' }); assert.equal(calls, 4);
    });
    await t.test('an aborted caller does not cancel a shared read', async () => {
      let release, started; let calls = 0;
      const ready = new Promise(resolve => { started = resolve; });
      const { fetch } = init(async () => new Promise(resolve => { calls++; release = () => resolve(Response.json([])); started(); }));
      const controller = new AbortController();
      const first = caught(fetch, { signal: controller.signal }); const rejected = assert.rejects(first, /abort/i);
      const second = caught(fetch); await ready; controller.abort(); await rejected;
      release(); await second; assert.equal(calls, 1);
    });
    await t.test('admin reads bypass cache; admin writes still invalidate player caches', async () => {
      let reads = 0;
      const { store, fetch } = init(async (_input, options) => options?.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json([{ id: ++reads }]));
      await caught(fetch);
      setReadCacheHandler(() => ({ ...store.capture(), bypassReads: true }));
      await caught(fetch); await caught(fetch); assert.equal(reads, 3);
      await fetch(base + 'caught?id=eq.fish', { method: 'DELETE' });
      setReadCacheHandler(() => store.capture());
      await caught(fetch); assert.equal(reads, 4);
    });
    await t.test('hour-bound missions use a new key at the next hour', async () => {
      let calls = 0; const { fetch } = init(async () => { calls++; return Response.json([]); });
      clock = Math.floor(clock / 3_600_000) * 3_600_000 + 3_599_000;
      await fetch(base + 'rpc/get_current_hour_missions', { method: 'POST' });
      clock += 2000;
      await fetch(base + 'rpc/get_current_hour_missions', { method: 'POST' }); assert.equal(calls, 2);
    });
    await t.test('the real caught store reopens without repeating get_caught_in_home; force refresh bypasses it', async () => {
      const { useCaughtStore } = await server.ssrLoadModule('/src/stores/caught.ts');
      const transport = globalThis.fetch; let homeCalls = 0;
      init(async () => Response.json([]));
      const store = useCaughtStore();
      globalThis.fetch = async input => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        assert.equal(url.origin, 'https://read-test.supabase.co');
        if (url.pathname.endsWith('/get_caught_in_home')) homeCalls++;
        return Response.json([]);
      };
      try {
        await Promise.all(Array.from({ length: 10 }, () => store.loadCaughtFishes()));
        await store.loadCaughtFishes(); assert.equal(homeCalls, 1);
        await store.loadCaughtFishes(true); assert.equal(homeCalls, 2);
      } finally { globalThis.fetch = transport; }
    });
    await t.test('account changes clear displayed snapshots and discard late inventory responses', async () => {
      const { resetPlayerSnapshots } = await server.ssrLoadModule('/src/stores/playerSnapshotReset.ts');
      const { useCaughtStore } = await server.ssrLoadModule('/src/stores/caught.ts');
      const { useInventoryStore } = await server.ssrLoadModule('/src/stores/inventory.ts');
      const { useEquipmentStore } = await server.ssrLoadModule('/src/stores/equipment.ts');
      const { supabaseUserInventoryRepository: inventoryRepo } = await server.ssrLoadModule('/src/data/supabaseUserInventoryRepository.ts');
      const pinia = createPinia(); pinia.use(resetPlayerSnapshots); createApp({}).use(pinia); setActivePinia(pinia);
      const auth = useAuthStore(); auth.applySession({ user: { id: 'a' } });
      const caughtStore = useCaughtStore(), inventory = useInventoryStore();
      const equipment = useEquipmentStore();
      caughtStore.caughtFishes = [{ id: 'old-fish' }]; inventory.items = [{ id: 'old-item' }];
      let resolve;
      const original = inventoryRepo.fetchUserInventory;
      inventoryRepo.fetchUserInventory = () => new Promise(yes => { resolve = yes; });
      try {
        const read = inventory.setUserInventory('a');
        const equipmentRead = equipment.fetchEquipment('a', true);
        auth.applySession({ user: { id: 'b' } });
        assert.deepEqual(caughtStore.caughtFishes, []); assert.deepEqual(inventory.items, []);
        resolve([{ id: 'late-old-item' }]); await read;
        await equipmentRead; assert.equal(equipment.loaded, false);
        assert.deepEqual(inventory.items, []);
        caughtStore.caughtFishes = [{ id: 'new-fish' }];
        auth.applySession({ user: { id: 'b' }, access_token: 'refreshed-token' });
        assert.equal(caughtStore.caughtFishes[0].id, 'new-fish', 'Token refresh for the same owner must preserve snapshots');
      } finally { inventoryRepo.fetchUserInventory = original; }
    });
    await t.test('notification snapshots share reads despite time-based query filters and still expire on time', async () => {
      const { useNotificationStore } = await server.ssrLoadModule('/src/stores/notification.ts');
      const { supabaseNotificationRepository: repository } = await server.ssrLoadModule('/src/data/supabaseNotificationRepository.ts');
      init(async () => Response.json([]));
      const notifications = useNotificationStore(); let calls = 0;
      const original = repository.fetchNotifications;
      repository.fetchNotifications = async () => {
        calls++;
        return { personal: [], system: [{ id: 'notice', is_read: false, expires_at: new Date(clock + 1000).toISOString() }] };
      };
      try {
        await notifications.loadNotifications('a'); assert.equal(notifications.unreadCount, 1);
        clock += 1500;
        await notifications.loadNotifications('a'); assert.equal(calls, 1); assert.equal(notifications.unreadCount, 0);
        await notifications.loadNotifications('a', true); assert.equal(calls, 2);
        useFeatureAvailabilityStore().checkRequests = async () => ({ code: 'FEATURE_DISABLED', message: 'maintenance' });
        await notifications.loadNotifications('a'); assert.equal(calls, 2); assert.equal(notifications.loadError, 'maintenance');
      } finally { notifications.stopRefreshing('modal'); repository.fetchNotifications = original; }
    });
    await flush();
    setReadCacheHandler(undefined);
  } finally { Date.now = realNow; await server.close(); }
});
