import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

test('admin drafts, selector refresh, attachment expiry and complete catalogs', async t => {
  const server = await createServer({
    configFile: false, envDir: false, appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://admin-test.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
    },
  });
  const load = path => server.ssrLoadModule('/src/' + path + '.ts');
  try {
    await t.test('cancelling area edits preserves all saved fields and resets editor mode', async () => {
      setActivePinia(createPinia());
      const { useAdminFishingAreaStore } = await load('components/admin/admin-fishing-area/admin-fishing-area-store');
      const store = useAdminFishingAreaStore();
      const saved = { id: 'area', title: 'Saved', location: { lon: 1, lat: 2, k: 3 }, fishingBoundary: [{ x: 4, y: 5 }] };
      store.adminAreas = [structuredClone(saved)];
      store.openForm(store.adminAreas[0]);
      store.target.title = 'Draft'; store.target.location.lon = 99; store.target.fishingBoundary[0].x = 99;
      store.closeForm();
      assert.deepEqual(JSON.parse(JSON.stringify(store.adminAreas[0])), saved);
      store.openForm();
      assert.equal(store.isCreate, true); assert.equal(store.isUpdate, false);
      store.openForm(store.adminAreas[0]);
      assert.equal(store.isCreate, false); assert.equal(store.isUpdate, true);
    });

    await t.test('refreshing pass rewards picks up new passes, changed duration and new items', async t => {
      setActivePinia(createPinia());
      const { supabaseFishingPassRewardsAdminRepository: repo } = await load('data/supabaseFishingPassRewardsAdminRepository');
      let passes = [{ id: 'pass', totalDays: 7 }], items = [{ id: 'old' }];
      t.mock.method(repo, 'fetchPage', async () => ({ items: [], total: 0 }));
      t.mock.method(repo, 'fetchPasses', async () => structuredClone(passes));
      t.mock.method(repo, 'fetchItems', async () => structuredClone(items));
      const { useAdminFishingPassRewardsStore } = await load('components/admin/admin-fishing-pass-rewards/admin-fishing-pass-rewards-store');
      const store = useAdminFishingPassRewardsStore(); await store.fetchAll();
      passes = [{ id: 'pass', totalDays: 30 }, { id: 'new-pass', totalDays: 14 }]; items = [{ id: 'new-item' }];
      await store.fetchAll();
      assert.deepEqual(JSON.parse(JSON.stringify(store.passes)), passes);
      assert.equal(store.items[0].id, 'new-item');
    });

    await t.test('refreshing aquaculture and blueprints reloads their related catalogs', async t => {
      setActivePinia(createPinia());
      const { supabaseAquacultureRulesAdminRepository: rules, supabaseAquacultureFoodsAdminRepository: foods } = await load('data/supabaseAquacultureAdminRepository');
      const { supabaseSpeciesRepository: species } = await load('data/supabaseSpeciesRepository');
      const { supabaseItemRepository: items } = await load('data/supabaseItemRepository');
      const { supabaseBlueprintRepository: blueprints } = await load('data/supabaseBlueprintRepository');
      let revision = 'old';
      for (const repo of [rules, foods, blueprints]) t.mock.method(repo, 'fetchPage', async () => ({ items: [], total: 0 }));
      t.mock.method(species, 'fetchAll', async () => [{ id: revision }]);
      t.mock.method(items, 'fetchAll', async () => [{ id: revision }]);
      t.mock.method(rules, 'fetchAll', async () => [{ species_id: revision }]);
      const { useAdminAquacultureSpeciesStore } = await load('components/admin/admin-aquaculture-species/admin-aquaculture-species-store');
      const { useAdminAquacultureFoodStore } = await load('components/admin/admin-aquaculture-food/admin-aquaculture-food-store');
      const { useAdminBlueprintStore } = await load('components/admin/admin-blueprint/admin-blueprint-store');
      const speciesStore = useAdminAquacultureSpeciesStore(), foodStore = useAdminAquacultureFoodStore(), blueprintStore = useAdminBlueprintStore();
      for (const store of [speciesStore, foodStore, blueprintStore]) await store.fetchAll();
      revision = 'new';
      for (const store of [speciesStore, foodStore, blueprintStore]) await store.fetchAll();
      assert.equal(speciesStore.species[0].id, 'new'); assert.equal(foodStore.species[0].id, 'new');
      assert.equal(foodStore.rules[0].species_id, 'new'); assert.equal(foodStore.sourceItems[0].id, 'new');
      assert.equal(blueprintStore.sourceItems[0].id, 'new');
    });

    await t.test('attachment URLs renew before expiry, coalesce reads, and recover after failures', async t => {
      setActivePinia(createPinia());
      const { supabaseFeedbackRepository: repo } = await load('data/supabaseFeedbackRepository');
      const { useErrorFeedbackManagementStore } = await load('components/admin/admin-feedback/admin-error-feedback-store');
      const store = useErrorFeedbackManagementStore();
      let now = 1000, calls = 0;
      t.mock.method(Date, 'now', () => now);
      const signed = t.mock.method(repo, 'createErrorFeedbackSignedUrls', async () => ({ path: 'url-' + ++calls }));
      await store.fetchAttachmentUrls(['path']);
      now += 54 * 60_000; await store.fetchAttachmentUrls(['path']); assert.equal(calls, 1);
      now += 2 * 60_000; await store.fetchAttachmentUrls(['path']); assert.equal(calls, 2);
      assert.equal(store.signedUrls.path, 'url-2');
      let resolve;
      signed.mock.mockImplementation(() => new Promise(yes => { resolve = yes; }));
      const pending = store.fetchAttachmentUrls(['path'], true);
      await store.fetchAttachmentUrls(['path'], true);
      assert.equal(signed.mock.callCount(), 3);
      resolve({ path: 'renewed' }); await pending;
      assert.equal(store.loadingAttachments, false);
      signed.mock.mockImplementation(async () => { throw new Error('offline'); });
      await store.fetchAttachmentUrls(['path'], true); assert.equal(store.attachmentError, 'offline');
      signed.mock.mockImplementation(async () => ({ path: 'recovered' }));
      await store.fetchAttachmentUrls(['path'], true);
      assert.equal(store.signedUrls.path, 'recovered'); assert.equal(store.attachmentError, '');
      t.mock.method(repo, 'fetchErrorFeedback', async () => ({ items: [{ id: 'report', attachments: [{ path: 'path' }] }], total: 1 }));
      now += 60 * 60_000; await store.fetchErrorFeedback();
      assert.equal(signed.mock.callCount(), 6, 'List refresh also renews URLs for unchanged attachment paths');
    });

    await t.test('selector repositories read every API page with a stable unique order', async t => {
      const { default: supabase } = await load('database/connection');
      const records = Array.from({ length: 8 }, (_, index) => ({
        id: String(index), species_id: String(index), name: 'Same name', code: 'same',
        created_at: '2026-11-25T00:00:00Z', total_days: 30, price: '12', min_depth: 0,
        max_depth: 10, peak_depth: 5, curve_power: 1,
      }));
      let offsets = [], orders = [];
      t.mock.method(supabase, 'from', () => {
        const query = {
          select() { return query; },
          order(column) { orders.push(column); return query; },
          range(from) { offsets.push(from); return Promise.resolve({ data: records.slice(from, from + 3), error: null, status: 200 }); },
        };
        return query;
      });
      const cases = [
        ['supabaseSpeciesRepository', 'supabaseSpeciesRepository', 'fetchAll', 'id'],
        ['supabaseItemRepository', 'supabaseItemRepository', 'fetchAll', 'id'],
        ['supabaseFishingAreaRepository', 'supabaseFishingAreaRepository', 'fetchAllAreasAdmin', 'id'],
        ['supabaseDepthScopeRepository', 'supabaseDepthScopeRepository', 'fetchAll', 'id'],
        ['supabaseEventRepository', 'supabaseEventRepository', 'fetchAll', 'id'],
        ['supabaseWeatherRepository', 'supabaseWeatherRepository', 'fetchAll', 'id'],
        ['supabaseAquacultureAdminRepository', 'supabaseAquacultureRulesAdminRepository', 'fetchAll', 'species_id'],
        ['supabaseFishingPassRewardsAdminRepository', 'supabaseFishingPassRewardsAdminRepository', 'fetchPasses', 'id'],
        ['supabaseFishingPassRewardsAdminRepository', 'supabaseFishingPassRewardsAdminRepository', 'fetchItems', 'id'],
      ];
      for (const [file, name, method, unique] of cases) {
        offsets = []; orders = [];
        const module = await load('data/' + file), result = await module[name][method]();
        assert.deepEqual(result.map(row => row.id), records.map(row => row.id), name + '.' + method);
        assert.deepEqual(offsets, [0, 3, 6, 8]);
        assert.ok(orders.includes(unique), name + ' must order by a unique key');
      }
    });
  } finally { await server.close(); }
});
