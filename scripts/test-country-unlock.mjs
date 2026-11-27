import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

test('country purchase store checks eligibility, prevents duplicate requests and ignores old sessions', async () => {
  const server = await createServer({ configFile: false, envDir: false,
    server: { middlewareMode: true, hmr: false, watch: null }, define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://example.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
    } });
  try {
    setActivePinia(createPinia());
    const { useAuthStore } = await server.ssrLoadModule('/src/stores/auth.ts');
    const { useCountryStore } = await server.ssrLoadModule('/src/stores/player-country-store.ts');
    const { useCurrencyStore } = await server.ssrLoadModule('/src/stores/player-currency-store.ts');
    const { useFishingMapStore } = await server.ssrLoadModule('/src/stores/player-fishing-map-store.ts');
    const { supabaseCountryRepository: repo } = await server.ssrLoadModule('/src/data/supabaseCountryRepository.ts');
    const auth = useAuthStore(), countries = useCountryStore(), currency = useCurrencyStore(), store = useFishingMapStore();
    auth.user = { id: 'player' };
    countries.countries = [{ id: 'a', name: 'A' }, { id: 'empty', name: 'Empty' }];
    countries.unlockedPlayerId = 'player';
    store.countryIdsWithAreas = ['a'];
    countries.isLoadingUnlocked = true;
    assert.equal(store.canUnlock('a'), true, 'background refresh preserves the unlock button');
    assert.deepEqual(store.countries.map(country => country.id), ['a', 'empty']);
    countries.unlockedPlayerId = 'previous-player';
    assert.equal(store.canUnlock('a'), false, 'a different account cannot use the previous snapshot');
    countries.unlockedPlayerId = 'player';
    countries.isLoadingUnlocked = false;
    assert.equal(store.canUnlock('empty'), false);
    assert.equal(await store.unlockCountry('empty'), false);
    let resolvePurchase, calls = 0, refreshes = 0;
    repo.purchaseUnlock = () => { calls++; return new Promise(resolve => { resolvePurchase = resolve; }); };
    countries.fetchMyUnlockedCountries = async () => { countries.unlockedCountries = [countries.countries[0]]; refreshes++; };
    currency.fetchCurrency = async () => { currency.shells = 0; refreshes++; };
    const purchase = store.unlockCountry('a');
    assert.equal(await store.unlockCountry('a'), false);
    assert.equal(calls, 1);
    resolvePurchase();
    assert.equal(await purchase, true);
    assert.equal(store.selectedCountryId, 'a');
    assert.equal(store.canUnlock('a'), false);
    assert.equal(refreshes, 2);

    countries.unlockedCountries = [];
    repo.purchaseUnlock = async () => { throw new Error('insufficient shells'); };
    assert.equal(await store.unlockCountry('a'), false);
    assert.ok(store.unlockError);
    assert.equal(store.unlockingCountryId, '');

    repo.purchaseUnlock = () => new Promise(resolve => { resolvePurchase = resolve; });
    const stale = store.unlockCountry('a');
    auth.sessionGeneration++;
    store.$reset();
    resolvePurchase();
    assert.equal(await stale, false);
    assert.equal(store.selectedCountryId, '');
    assert.equal(store.unlockError, '');
    assert.equal(refreshes, 2);
  } finally {
    await server.close();
  }
});

test('paid country unlock validates eligibility and charges once in an atomic transaction', async () => {
  const db = new PGlite();
  const player = '11111111-1111-4111-8111-111111111111';
  const country = '22222222-2222-4222-8222-222222222222';
  const empty = '33333333-3333-4333-8333-333333333333';
  const other = '44444444-4444-4444-8444-444444444444';
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
        SELECT nullif(current_setting('test.uid', true), '')::uuid
      $$;
      CREATE TABLE currency(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, shells bigint, cash bigint, tickets bigint);
      CREATE TABLE fishing_areas(country_id uuid, is_available boolean);
      CREATE TABLE player_unlocked_countries(id uuid DEFAULT gen_random_uuid(), player_id uuid, country_id uuid, UNIQUE(player_id, country_id));
      GRANT USAGE ON SCHEMA auth TO authenticated;
      GRANT SELECT, UPDATE ON currency TO authenticated;
      GRANT SELECT ON fishing_areas TO authenticated;
      GRANT SELECT, INSERT ON player_unlocked_countries TO authenticated;
      INSERT INTO currency(user_id, shells, cash, tickets) VALUES ('${player}', 299, 1000, 10), ('${other}', 900, 0, 0);
      INSERT INTO fishing_areas VALUES ('${country}', false);
    `);
    const sql = await readFile(new URL('./supabase/rpc/countries/purchase_country_unlock.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec('SET ROLE authenticated');
    const purchase = id => db.query('SELECT purchase_country_unlock($1)', [id]);
    const balance = async () => (await db.query('SELECT shells, cash, tickets FROM currency WHERE user_id=$1', [player])).rows[0];
    await assert.rejects(purchase(country), /Authentication required/);
    await db.query("SELECT set_config('test.uid', $1, false)", [player]);
    await assert.rejects(purchase(empty), /no fishing areas/);
    await assert.rejects(purchase(country), /Insufficient shells/);
    assert.equal((await balance()).shells, 299);
    assert.equal((await db.query('SELECT * FROM player_unlocked_countries')).rows.length, 0);
    await db.query('UPDATE currency SET shells=300 WHERE user_id=$1', [player]);
    await purchase(country);
    assert.deepEqual(await balance(), { shells: 0, cash: 1000, tickets: 10 });
    await purchase(country);
    assert.equal((await balance()).shells, 0);
    assert.equal((await db.query('SELECT * FROM player_unlocked_countries')).rows.length, 1);
    assert.equal((await db.query('SELECT shells FROM currency WHERE user_id=$1', [other])).rows[0].shells, 900);

    // A rejected wallet update must roll back the new unlock too.
    await db.exec(`RESET ROLE;
      INSERT INTO fishing_areas VALUES ('${empty}', true);
      UPDATE currency SET shells=600 WHERE user_id='${player}';
      CREATE FUNCTION reject_payment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'payment rejected'; END $$;
      CREATE TRIGGER reject_payment BEFORE UPDATE ON currency FOR EACH ROW EXECUTE FUNCTION reject_payment();
      SET ROLE authenticated;`);
    await assert.rejects(purchase(empty), /payment rejected/);
    assert.equal((await balance()).shells, 600);
    assert.equal((await db.query('SELECT * FROM player_unlocked_countries WHERE country_id=$1', [empty])).rows.length, 0);
  } finally {
    await db.close();
  }
});
