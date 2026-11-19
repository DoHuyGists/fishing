import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

test('complete inventory snapshots preserve crafting, stats and request ownership', async t => {
  const server = await createServer({ configFile: false, envDir: false,
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom',
    define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://inventory-test.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key') } });
  const originalFetch = globalThis.fetch;
  try {
    const load = path => server.ssrLoadModule('/src/' + path + '.ts');
    const { useAuthStore } = await load('stores/auth');
    const { useInventoryStore } = await load('stores/player-inventory-store');
    const { useBlueprintStore } = await load('stores/player-blueprint-store');
    const { useCurrencyStore } = await load('stores/player-currency-store');
    const { useGameCatalogStore } = await load('stores/player-game-catalog-store');
    const { supabaseUserInventoryRepository: repository } = await load('data/supabaseUserInventoryRepository');
    const { supabaseBlueprintRepository: blueprints } = await load('data/supabaseBlueprintRepository');
    const { setFeatureRequestGuard } = await load('database/featureRequestGate');
    setFeatureRequestGuard(async () => null);
    const init = () => {
      setActivePinia(createPinia());
      const auth = useAuthStore(); auth.applySession({ user: { id: 'owner' } });
      return { auth, store: useInventoryStore() };
    };
    let rows = [], requests = [], failOffset = Infinity;
    globalThis.fetch = async input => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert.equal(url.origin, 'https://inventory-test.supabase.co');
      assert.equal(url.pathname, '/rest/v1/user_inventory');
      assert.equal(url.searchParams.get('user_id'), 'eq.owner');
      assert.equal(url.searchParams.get('order'), 'id.asc');
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit'));
      assert.equal(limit, 200);
      requests.push(offset);
      if (offset >= failOffset) return Response.json({ message: 'page failed' }, { status: 400 });
      // Simulate a server max-rows setting below the client's requested page size.
      return Response.json(rows.slice(offset, offset + Math.min(limit, 73)));
    };
    const row = (n, data = {}) => ({ id: String(n).padStart(6, '0'), user_id: 'owner',
      created_at: '2026-11-19T00:00:00Z', rpc: null, data: { id: 'filler', quantity: 1, ...data } });

    await t.test('materials and equipped items beyond the API limit contribute to crafting and stats', async () => {
      const { store } = init();
      rows = Array.from({ length: 1203 }, (_, n) => row(n));
      rows[1200] = row(1200, { id: 'material', quantity: 2 });
      rows[1201] = row(1201, { id: 'material', quantity: 3 });
      rows[1202] = row(1202, { id: 'rod', category: 'rod', max_weight: 7, durability: 20 });
      store.viewItems = [{ id: 'visible-page' }];
      await store.setUserInventory('owner');
      assert.equal(store.items.length, 1203);
      assert.equal(new Set(store.items.map(item => item.id)).size, 1203);
      assert.equal(store.items.at(-1).userId, 'owner');
      assert.equal(store.ownedQuantitiesByItemId.get('material'), 5);
      assert.equal(store.viewItems[0].id, 'visible-page');
      assert.equal(requests.at(-1), 1203);
      store.savedEquipmentSets = [{ userId: 'owner', isUsed: true,
        rod: [{ inventory_id: rows[1202].id }], line: [], reel: [], hook: [], bait: [] }];
      assert.equal(store.activeFishingStats.max_weight, 7);
      assert.equal(store.activeFishingStats.durability, 20);

      const currency = useCurrencyStore(); currency.cash = 100; currency.fetchCurrency = async () => {};
      useGameCatalogStore().action = async (_rpc, _params, _domains, run) => run();
      const craft = blueprints.craft;
      let crafted = 0;
      blueprints.craft = async () => { crafted++; return { success: true }; };
      try {
        const bench = useBlueprintStore();
        bench.blueprints = [{ id: 'blueprint', goldCost: 1, requiredMaterials: [{ item_id: 'material', quantity: 5 }] }];
        await bench.craft('blueprint', 1);
        assert.equal(crafted, 1);
      } finally { blueprints.craft = craft; }
    });

    await t.test('personal inventory has no catalog-size cutoff and handles an empty bag', async () => {
      init(); requests = [];
      rows = Array.from({ length: 10001 }, (_, n) => row(n));
      assert.equal((await repository.fetchUserInventory('owner')).length, 10001);
      assert.equal(requests.at(-1), 10001);
      init(); rows = [];
      assert.deepEqual(await repository.fetchUserInventory('owner'), []);
    });

    await t.test('a later page failure preserves the last complete snapshot', async () => {
      const { store } = init(); rows = Array.from({ length: 300 }, (_, n) => row(n));
      store.items = [{ id: 'previous-complete' }]; failOffset = 73;
      try {
        await assert.rejects(store.setUserInventory('owner'), /page failed/);
        assert.equal(store.items[0].id, 'previous-complete');
      } finally { failOffset = Infinity; }
    });

    await t.test('older requests and previous sessions cannot overwrite a newer snapshot', async () => {
      const { auth, store } = init();
      const original = repository.fetchUserInventory;
      const pending = [];
      repository.fetchUserInventory = () => new Promise(resolve => pending.push(resolve));
      try {
        const old = store.setUserInventory('owner'), latest = store.setUserInventory('owner');
        pending[1]([{ id: 'latest' }]); await latest;
        pending[0]([{ id: 'old' }]); await old;
        assert.equal(store.items[0].id, 'latest');
        const oldSession = store.setUserInventory('owner');
        auth.applySession({ user: { id: 'other' } });
        const newSession = store.setUserInventory('other');
        pending[3]([{ id: 'other' }]); await newSession;
        pending[2]([{ id: 'previous-owner' }]); await oldSession;
        assert.equal(store.items[0].id, 'other');
      } finally { repository.fetchUserInventory = original; }
    });
  } finally {
    globalThis.fetch = originalFetch;
    await server.close();
  }
});
