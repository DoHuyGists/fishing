import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

test('map loads closed areas, zone weather and fish details without truncating pages or mixing countries', async () => {
  const server = await createServer({ configFile: false, envDir: false, server: { middlewareMode: true, hmr: false, watch: null }, define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://example.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
  } });
  const originalFetch = globalThis.fetch;
  try {
    setActivePinia(createPinia());
    const { setFeatureRequestGuard } = await server.ssrLoadModule('/src/database/featureRequestGate.ts');
    setFeatureRequestGuard(async () => null);
    const { supabaseFishingAreaRepository: areasRepository } = await server.ssrLoadModule('/src/data/supabaseFishingAreaRepository.ts');
    const { supabaseSpeciesInAreaRepository: speciesRepository } = await server.ssrLoadModule('/src/data/supabaseSpeciesInAreaRepository.ts');
    const weather = { id: 'rain', code: 'RAIN', name: 'Rain', image: null };
    const fish = { id: 'fish', name: 'Carp', weight_min: 1, weight_max: 8, strength: 20, base_catch_rate: 0.5 };
    const offsets = [];
    globalThis.fetch = async input => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert.equal(url.origin, 'https://example.supabase.co');
      const offset = Number(url.searchParams.get('offset'));
      if (url.pathname.endsWith('/fishing_areas')) {
        assert.equal(url.searchParams.get('country_id'), 'eq.a');
        assert.equal(url.searchParams.has('is_available'), false);
        offsets.push(offset);
        return Response.json(offset < 2 ? [{
          id: `area-${offset}`, country_id: 'a', title: 'Lake', is_available: offset === 0,
          max_depth: '12.5', allow_depth_tool: true, zone_id: offset === 0 ? 'zone' : null,
          zone: offset === 0 ? { id: 'zone', code: 'NORTH', name: 'North', allowed: [{ weather }, { weather: null }] } : null,
        }] : []);
      }
      assert.equal(url.searchParams.get('area.country_id'), 'eq.a');
      assert.equal(url.searchParams.has('area.is_available'), false);
      return Response.json(offset === 0 ? [{ id: 'distribution', area_id: 'area-1', species_id: 'fish', weight_rate: 10, species: fish }] : []);
    };
    const areas = await areasRepository.fetchMapAreas('a');
    assert.deepEqual(offsets, [0, 1, 2]);
    assert.deepEqual(areas.map(area => area.isAvailable), [true, false]);
    assert.equal(areas[0].maxDepth, 12.5);
    assert.deepEqual(areas[0].zone.weathers, [weather]);
    assert.equal(areas[1].zone, null);
    const species = await speciesRepository.fetchMapSpecies('a');
    assert.deepEqual(species[0].details, fish);

    setActivePinia(createPinia());
    const { useFishingMapStore } = await server.ssrLoadModule('/src/stores/player-fishing-map-store.ts');
    const { useCountryStore } = await server.ssrLoadModule('/src/stores/player-country-store.ts');
    const { useAuthStore } = await server.ssrLoadModule('/src/stores/auth.ts');
    useAuthStore().user = { id: 'player' };
    const countries = useCountryStore();
    countries.countries = [{ id: 'a', name: 'A', code: 'A' }, { id: 'b', name: 'B', code: 'B' }];
    countries.unlockedCountries = countries.countries;
    countries.unlockedPlayerId = 'player';
    const store = useFishingMapStore();
    store.selectCountry('a');
    await store.loadSpecies();
    assert.equal(store.areas.length, 2);
    store.speciesId = 'fish';
    assert.equal(store.areas[0].isAvailable, false);
    store.selectedSpecies = species[0];

    let finishOld;
    areasRepository.fetchMapAreas = () => new Promise(resolve => { finishOld = resolve; });
    speciesRepository.fetchMapSpecies = async () => species;
    const oldRequest = store.loadSpecies();
    assert.equal(store.selectedSpecies, null);
    store.selectCountry('b');
    areasRepository.fetchMapAreas = async () => [{ ...areas[0], id: 'b-area', countryId: 'b' }];
    speciesRepository.fetchMapSpecies = async () => [];
    await store.loadSpecies();
    finishOld(areas);
    await oldRequest;
    assert.deepEqual(store.areas.map(area => area.id), ['b-area']);
    countries.unlockedCountries = [];
    assert.deepEqual(store.areas, []);
  } finally {
    globalThis.fetch = originalFetch;
    await server.close();
  }
});
