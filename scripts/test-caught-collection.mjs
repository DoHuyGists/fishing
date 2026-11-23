import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';
import { effectScope } from 'vue';

test('caught collection filters, groups and paginates the current inventory', async t => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
    envDir: false,
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://example.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
    },
  });
  const scope = effectScope();
  t.after(async () => {
    scope.stop();
    await server.close();
  });
  const { useCaughtStore } = await server.ssrLoadModule('/src/stores/player-caught-store.ts');
  const { useCaughtCollection } = await server.ssrLoadModule('/src/composables/useCaughtCollection.ts');
  setActivePinia(createPinia());
  const store = useCaughtStore();
  const collection = scope.run(useCaughtCollection);
  const fish = (id, overrides = {}) => ({
    id: String(id), created_at: new Date(Date.UTC(2026, 0, id)).toISOString(),
    weight: id, is_shiny: false, variant_type: 'NORMAL', star_rating: null,
    species: { id: 'carp', name: 'Cá chép', rarity: 'Thường' }, origin: null,
    ...overrides,
  });

  await t.test('combines traits, origin, stars, Unicode search and inclusive weight bounds', () => {
    store.caughtFishes = [
      fish(1),
      fish(2, { is_shiny: true, variant_type: 'GOLDEN', star_rating: 5, origin: { id: 'lake', country: 'VN', name: 'Hồ' } }),
      fish(3, { is_shiny: true, variant_type: 'GOLDEN', star_rating: 4 }),
    ];
    Object.assign(collection.filters, {
      search: '  CÁ CHÉP  ', rarity: 'Thường', variant: 'GOLDEN', shiny: 'shiny',
      origin: 'lake', minStars: 5, minWeight: 2, maxWeight: 2,
    });
    assert.deepEqual(collection.filteredFishes.value.map(f => f.id), ['2']);
    assert.equal(collection.paginatedGroups.value[0].fishes.length, 1);
    assert.equal(collection.hasActiveFilters.value, true);
    collection.filters.maxWeight = 1;
    assert.equal(collection.invalidWeightRange.value, true);
    assert.equal(collection.filteredFishes.value.length, 0);
    collection.resetFilters();
    Object.assign(collection.filters, { origin: 'farm', shiny: 'regular' });
    assert.deepEqual(collection.filteredFishes.value.map(f => f.id), ['1']);
    collection.resetFilters();
    collection.filters.search = '   ';
    assert.equal(collection.hasActiveFilters.value, false);
  });

  await t.test('sorts by actual weight and stars without changing store order', () => {
    collection.resetFilters();
    store.caughtFishes = [fish(1, { star_rating: 5 }), fish(2), fish(3, { star_rating: 4 })];
    for (const [sort, expected] of [
      ['newest', ['3', '2', '1']], ['oldest', ['1', '2', '3']],
      ['heaviest', ['3', '2', '1']], ['lightest', ['1', '2', '3']],
      ['stars', ['1', '3', '2']],
    ]) {
      collection.filters.sort = sort;
      assert.deepEqual(collection.filteredFishes.value.map(f => f.id), expected);
    }
    assert.deepEqual(store.caughtFishes.map(f => f.id), ['1', '2', '3']);
  });

  await t.test('resets pages on filter/view changes and clamps after selling or releasing fish', () => {
    collection.resetFilters();
    store.caughtFishes = Array.from({ length: 25 }, (_, i) => fish(i + 1));
    assert.equal(collection.total.value, 1);
    assert.equal(collection.paginatedGroups.value[0].fishes.length, 25);
    collection.viewMode.value = 'list';
    assert.equal(collection.total.value, 25);
    collection.currentPage.value = 3;
    assert.equal(collection.paginatedFishes.value.length, 1);
    store.caughtFishes = store.caughtFishes.slice(0, 12);
    assert.equal(collection.currentPage.value, 1);
    collection.currentPage.value = 2;
    collection.filters.minWeight = 10;
    assert.equal(collection.currentPage.value, 1);
    assert.equal(collection.filteredFishes.value.length, 3);
    collection.expandedSpecies.value = 'carp';
    collection.viewMode.value = 'species';
    assert.equal(collection.expandedSpecies.value, null);
    collection.resetFilters();
    assert.equal(collection.hasActiveFilters.value, false);
  });
});
