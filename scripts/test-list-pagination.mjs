import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const player = '00000000-0000-0000-0000-000000000001';
const id = n => `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

test('list pagination keeps global filters, totals and caller RLS', async t => {
  const db = new PGlite();
  const read = async (name, args) => (await db.query(`SELECT public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) AS data`, args)).rows[0].data;
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE public.user_profile(id uuid PRIMARY KEY, display_name text, level integer);
      CREATE TABLE public.user_friends(id uuid PRIMARY KEY, user_id uuid, friend_id uuid, status text, created_at timestamptz);
      CREATE TABLE public.user_teams(id uuid PRIMARY KEY, status text, created_at timestamptz);
      CREATE TABLE public.personal_notifications(id uuid PRIMARY KEY, user_id uuid, created_at timestamptz);
      CREATE TABLE public.system_notifications(id uuid PRIMARY KEY, created_at timestamptz);
      CREATE TABLE public.species(id uuid PRIMARY KEY, name text, rarity text, status text, owner_id uuid);
      CREATE TABLE public.items(id uuid PRIMARY KEY, name text, category text, created_at timestamptz);
      CREATE TABLE public.weathers(id uuid PRIMARY KEY, code text, name text);
      CREATE TABLE public.modifiers(id uuid PRIMARY KEY, code text, name text);
      CREATE TABLE public.zones(id uuid PRIMARY KEY, code text, name text);
      CREATE TABLE public.zone_allowed_weathers(id uuid PRIMARY KEY, zone_id uuid, weather_id uuid);
      CREATE TABLE public.weather_modifiers(id uuid PRIMARY KEY, weather_id uuid, modifier_id uuid);
      CREATE TABLE public.depth_scope(id uuid PRIMARY KEY, code text, name text);
      CREATE TABLE public.blueprint(id uuid PRIMARY KEY, result_item_id uuid, created_at timestamptz);
      CREATE TABLE public.aquaculture_species_rules(species_id uuid PRIMARY KEY);
      CREATE TABLE public.aquaculture_species_foods(species_id uuid, item_id uuid);
      CREATE TABLE public.event(id uuid PRIMARY KEY, name text, created_at timestamptz);
      CREATE TABLE public.event_schedule(id uuid PRIMARY KEY, event_id uuid, start timestamptz);
      CREATE TABLE public.skills(id uuid PRIMARY KEY, sort_order integer, name text);
      CREATE TABLE public.guides(id uuid PRIMARY KEY, sort_order integer, title text);
      CREATE TABLE public.redeem_code(id uuid PRIMARY KEY, code text, is_disabled boolean, expires_at timestamptz, created_at timestamptz);
      CREATE TABLE public.hour_missions(id uuid PRIMARY KEY, start timetz);
      CREATE TABLE public.fishing_passes(id uuid PRIMARY KEY, name text, created_at timestamptz);
      CREATE TABLE public.fishing_pass_rewards(id uuid PRIMARY KEY, pass_id uuid, item_id uuid, day_number integer, reward_type text);
      CREATE TABLE public.daily_mission_templates(id uuid PRIMARY KEY, code text);
      CREATE TABLE public.daily_mission_rewards(id uuid PRIMARY KEY, required_points integer);
      CREATE TABLE public.countries(id text PRIMARY KEY, name text);
      CREATE TABLE public.fishing_areas(id uuid PRIMARY KEY, country_id text, title text, created_at timestamptz);
      CREATE TABLE public.species_in_area(id uuid PRIMARY KEY, area_id uuid, species_id uuid, weight_rate numeric);
      ALTER TABLE public.species ENABLE ROW LEVEL SECURITY;
      CREATE POLICY owner_read ON public.species FOR SELECT TO authenticated USING (owner_id=auth.uid());
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
      SET test.uid='${player}';
    `);
    const sql = await readFile(new URL('./supabase/migrations/20261113_list_pagination.sql', import.meta.url), 'utf8');
    await db.exec(sql); await db.exec(sql);
    await db.query('INSERT INTO public.user_profile VALUES($1,$2,1)', [player, 'Người chơi']);
    for (let n = 1; n <= 23; n++) {
      await db.query('INSERT INTO public.user_profile VALUES($1,$2,$3)', [id(n), n === 23 ? 'Ngư thủ đặc biệt' : 'Player ' + n, n]);
      await db.query('INSERT INTO public.user_friends VALUES($1,$2,$3,$4,$5)', [id(n), player, id(n), n <= 20 ? 'ACCEPTED' : 'PENDING', '2026-11-13T00:00:00Z']);
      await db.query('INSERT INTO public.species VALUES($1,$2,$3,$4,$5)', [id(n), 'Fish ' + String(n).padStart(2, '0'), n === 23 ? 'LEGENDARY' : 'COMMON', n % 2 ? 'ACTIVE' : 'DISABLED', player]);
    }
    await db.query('INSERT INTO public.species VALUES($1,$2,$3,$4,$1)', [id(99), 'Hidden', 'SECRET', 'ACTIVE']);
    await db.exec('SET ROLE authenticated');

    await t.test('friend pages contain at most ten rows without overlap', async () => {
      const one = await read('get_friend_list_page', ['friends', '', 1]);
      const two = await read('get_friend_list_page', ['friends', '', 2]);
      const empty = await read('get_friend_list_page', ['friends', '', 3]);
      assert.equal(one.profiles.length, 10); assert.equal(two.profiles.length, 10);
      assert.equal(new Set([...one.profiles, ...two.profiles].map(p => p.id)).size, 20);
      assert.equal(empty.total, 20); assert.deepEqual(empty.profiles, []);
      assert.equal(one.counts.sent, 3); assert.equal(one.counts.discover, 23);
      assert.equal(one.friends.length, 10);
    });
    await t.test('discovery and request search work beyond the first page', async () => {
      const found = await read('get_friend_list_page', ['sent', 'ngư thủ', 1]);
      assert.equal(found.total, 1); assert.equal(found.profiles[0].id, id(23));
      const byId = await read('get_friend_list_page', ['discover', '000000000023', 1]);
      assert.equal(byId.total, 1); assert.equal(byId.friends[0].status, 'PENDING');
      const first = await read('get_friend_list_page', ['discover', '', 1]);
      assert.equal(first.profiles[0].level, 23);
      const negative = await read('get_friend_list_page', ['discover', '', -4]);
      assert.deepEqual(negative.profiles, first.profiles);
    });
    await t.test('admin filters run before LIMIT and facets cover every visible row', async () => {
      const result = await read('get_admin_list_page', ['species', 1, 'fish', { status: 'ACTIVE' }]);
      assert.equal(result.total, 12); assert.equal(result.items.length, 10);
      assert.ok(result.items.every(row => row.status === 'ACTIVE'));
      assert.deepEqual(result.facets.rarity, ['COMMON', 'LEGENDARY']);
      const last = await read('get_admin_list_page', ['species', 2, 'fish', { status: 'ACTIVE' }]);
      assert.equal(last.items.length, 2); assert.equal(last.items[1].name, 'Fish 23');
      const specific = await read('get_admin_list_page', ['species', 1, '23', {}]);
      assert.equal(specific.total, 1); assert.equal(specific.items[0].name, 'Fish 23');
      assert.ok(!result.facets.rarity.includes('SECRET'), 'RLS must protect rows and facet metadata');
    });
    await t.test('invalid tables and unauthenticated callers cannot use the RPCs', async () => {
      await assert.rejects(read('get_admin_list_page', ['user_profile', 1, '', {}]), /Unsupported catalog/);
      await assert.rejects(read('get_admin_list_page', ['species; DROP TABLE public.species', 1, '', {}]), /Unsupported catalog/);
      await assert.rejects(read('get_friend_list_page', ['invalid', '', 1]), /Invalid friend tab/);
    });
    await t.test('every supported admin catalog executes its ordered query', async () => {
      const tables = [...sql.matchAll(/WHEN '([^']+)' THEN/g)].map(match => match[1]);
      for (const table of tables) {
        const result = await read('get_admin_list_page', [table, 1, '', {}]);
        assert.ok(Array.isArray(result.items), table);
        assert.ok(result.items.length <= 10, table);
        assert.equal(typeof result.total, 'number', table);
      }
    });
    await t.test('anonymous calls cannot execute either RPC', async () => {
      await db.exec("SET test.uid=''");
      await assert.rejects(read('get_friend_list_page', ['friends', '', 1]), /Authentication required/);
      await db.exec('RESET ROLE; SET ROLE anon');
      await assert.rejects(read('get_admin_list_page', ['species', 1, '', {}]), /permission denied/);
    });
  } finally { await db.close(); }
});
