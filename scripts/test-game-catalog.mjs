import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

test('Pinia catalogs preserve feature gates, login isolation and transaction retries', async t => {
  const server = await createServer({ configFile: false, envDir: false, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom',
    define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://example.supabase.co'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
      'import.meta.env.VITE_GAME_CATALOG_VERSIONED': JSON.stringify('true') } });
  try {
    const { useGameCatalogStore } = await server.ssrLoadModule('/src/stores/gameCatalog.ts');
    const { useAuthStore } = await server.ssrLoadModule('/src/stores/auth.ts');
    const { useFeatureAvailabilityStore } = await server.ssrLoadModule('/src/stores/featureAvailability.ts');
    const { useCountryStore } = await server.ssrLoadModule('/src/stores/country.ts');
    const { useInventoryStore } = await server.ssrLoadModule('/src/stores/inventory.ts');
    const { supabaseGameCatalogRepository: repository } = await server.ssrLoadModule('/src/data/supabaseGameCatalogRepository.ts');
    const { RepositoryError } = await server.ssrLoadModule('/src/data/repositoryError.ts');
    const { catalogPolicies } = await server.ssrLoadModule('/src/data/gameCachePolicies.ts');
    let revision = '1';
    const init = () => {
      setActivePinia(createPinia()); const auth = useAuthStore(); auth.applySession({ user: { id: 'a' } });
      useFeatureAvailabilityStore().checkRequests = async () => null;
      revision = '1'; repository.versions = async () => Object.fromEntries(Object.keys(catalogPolicies).map(domain => [domain, revision]));
      return { auth, catalog: useGameCatalogStore() };
    };
    await t.test('ten store callers share one catalog fetch and return independent DTOs', async () => {
      const { catalog } = init(); let calls = 0;
      repository.snapshot = async () => { calls++; return { data: [{ id: 'x', name: 'Country', code: 'VN', location: null }], revision }; };
      const data = await Promise.all(Array.from({ length: 10 }, () => catalog.get('countries')));
      assert.equal(calls, 1); data[0][0].name = 'mutated';
      assert.equal((await catalog.get('countries'))[0].name, 'Country');
    });
    await t.test('feature-store bindings clear on logout; a late response cannot paint the next account', async () => {
      const { auth } = init(); const country = useCountryStore();
      repository.snapshot = async () => ({ data: [{ id: 'x', name: 'Country', code: 'VN', location: null }], revision });
      await country.fetchCountries(); assert.equal(country.countries.length, 1);
      auth.applySession(null); assert.deepEqual(country.countries, []); assert.equal(country.loaded, false);
      auth.applySession({ user: { id: 'a' } });
      let resolve, started;
      const ready = new Promise(yes => { started = yes; });
      repository.snapshot = () => new Promise(yes => { resolve = yes; started(); });
      const pending = country.fetchCountries();
      await ready;
      auth.applySession({ user: { id: 'b' } });
      resolve({ data: [{ id: 'a', name: 'Old account', code: 'VN', location: null }], revision });
      await pending; assert.deepEqual(country.countries, []);
    });
    await t.test('maintenance rejects a RAM hit and clears the displayed catalog', async () => {
      const { catalog } = init();
      repository.snapshot = async () => ({ data: [{ id: 'g', title: 'Guide', content: 'text', sort_order: 1 }], revision });
      let shown; await catalog.get('guides', { onUpdate: data => { shown = data; } }); assert.equal(shown.length, 1);
      useFeatureAvailabilityStore().checkRequests = async () => ({ code: 'FEATURE_DISABLED', message: 'maintenance' });
      await assert.rejects(catalog.get('guides'), /maintenance/); assert.equal(shown, undefined);
    });
    await t.test('RPC mismatch invalidates and reloads once, then requires an explicit second action', async () => {
      const { catalog } = init(); let reads = 0, mutations = 0;
      repository.snapshot = async () => { reads++; return { data: [{ id: 'item', name: 'Bait', price: revision === '1' ? 10 : 20, quantity: 1 }], revision }; };
      const inventory = useInventoryStore(); await inventory.loadShopItems();
      repository.action = async () => {
        mutations++;
        if (mutations === 1) { revision = '2'; throw new RepositoryError({ message: 'changed', code: 'P0001', details: JSON.stringify({ code: 'CATALOG_VERSION_MISMATCH', domains: ['shop'] }) }); }
        return { success: true };
      };
      await assert.rejects(inventory.purchaseItem('item', 1), error => error.code === 'CATALOG_VERSION_MISMATCH');
      assert.equal(mutations, 1); assert.equal(reads, 2); assert.equal(inventory.shopItems[0].price, 20);
      await inventory.purchaseItem('item', 1); assert.equal(mutations, 2); assert.equal(reads, 2);
      assert.equal(catalog.state('shop').revision, '2');
    });
    await t.test('receipt retry reaches the guarded RPC even when no catalog has been hydrated', async () => {
      const { catalog } = init(); let calls = 0;
      repository.snapshot = async () => { throw new Error('A receipt retry must not need a catalog read'); };
      repository.action = async (name, args) => { calls++; return { batch_id: args.p_request_id }; };
      const value = await catalog.action('stock_aquaculture_batch', { p_request_id: 'receipt' }, ['aquaculture'], async () => { throw new Error('legacy'); }, true);
      assert.equal(value.batch_id, 'receipt'); assert.equal(calls, 1);
    });
    await t.test('legacy catalog queries assemble every page even when the API caps responses below the requested page size', async () => {
      const { supabaseCountryRepository } = await server.ssrLoadModule('/src/data/supabaseCountryRepository.ts');
      const transport = globalThis.fetch;
      const all = Array.from({ length: 135 }, (_, id) => ({ id: String(id), name: 'country', code: 'VN', location: null }));
      const offsets = [];
      globalThis.fetch = async input => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        assert.equal(url.hostname, 'example.supabase.co');
        const offset = Number(url.searchParams.get('offset') ?? 0); offsets.push(offset);
        return Response.json(all.slice(offset, offset + 55));
      };
      try { assert.equal((await supabaseCountryRepository.fetchCountries()).length, 135); assert.deepEqual(offsets, [0,55,110,135]); }
      finally { globalThis.fetch = transport; }
    });
    await t.test('wrapper requests keep the original feature and mutation refresh mapping', async () => {
      const { featureRequestUrl, createCatalogMutationFetch, setCatalogMutationHandler } = await server.ssrLoadModule('/src/database/catalogRequests.ts');
      const { requestFeatures } = await server.ssrLoadModule('/src/data/featureAvailability.ts');
      const { createMutationRefreshFetch, setMutationRefreshHandler } = await server.ssrLoadModule('/src/database/mutationRefresh.ts');
      const base = 'https://example.supabase.co'; const url = new URL(base + '/rest/v1/rpc/execute_game_catalog_action');
      const init = { method: 'POST', body: JSON.stringify({ p_action: 'purchase_item' }) };
      assert.deepEqual(requestFeatures(await featureRequestUrl(url, url.toString(), init), 'POST'), ['shop']);
      const snapshotUrl = new URL(base + '/rest/v1/rpc/get_game_catalog_snapshot');
      const areaRequest = { method: 'POST', body: JSON.stringify({ p_domain: 'areas' }) };
      assert.deepEqual(requestFeatures(await featureRequestUrl(snapshotUrl, snapshotUrl.toString(), areaRequest), 'POST'), ['world-map']);
      let refresh = 0; setMutationRefreshHandler(snapshots => () => { assert.deepEqual(snapshots, ['currency']); refresh++; });
      const fetch = createMutationRefreshFetch(base, async () => Response.json({ success: true }));
      await fetch(url.toString(), init); assert.equal(refresh, 1);
      let owner = 'old', applied = 0;
      setMutationRefreshHandler(() => { const captured = owner; return () => { if (captured === owner) applied++; }; });
      const pending = fetch(new Request(url.toString(), { method: 'POST', body: init.body }));
      owner = 'new'; await pending; assert.equal(applied, 0);
      let invalidated; setCatalogMutationHandler(domains => () => { invalidated = domains; });
      await createCatalogMutationFetch(base, async () => new Response(null, { status: 204 }))(base + '/rest/v1/items', { method: 'PATCH' });
      assert.deepEqual(invalidated, ['items','shop']);
      const limited = await createCatalogMutationFetch(base, async () => Response.json({ code: 'RATE_LIMITED', message: 'wait', details: null }, { status: 429, headers: { 'Retry-After': '90' } }))(base + '/rest/v1/countries');
      assert.equal(new RepositoryError({ ...await limited.json(), status: 429 }).retryAfterMs, 90_000);
    });
  } finally { await server.close(); }
});
