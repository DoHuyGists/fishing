import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('depth preview uses a writable RPC transaction and still renews presence', async () => {
  const db = new PGlite();
  const uid = '00000000-0000-0000-0000-000000000001';
  const area = '00000000-0000-0000-0000-000000000002';
  const fish = '00000000-0000-0000-0000-000000000003';
  const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0];
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('test.uid', true), '')::UUID
      $$;
      CREATE TABLE public.user_in_area(user_id UUID, area_id UUID, session_id UUID, status TEXT, heartbeats INTEGER DEFAULT 0);
      CREATE TABLE public.species(id UUID, name TEXT, image TEXT, information TEXT, rarity TEXT, weight_min NUMERIC, weight_max NUMERIC);
      CREATE TABLE public.species_in_area(species_id UUID, area_id UUID, weight_rate NUMERIC, depth_scope_id UUID);
      CREATE TABLE public.depth_scope(id UUID, min_depth NUMERIC, max_depth NUMERIC, peak_depth NUMERIC, curve_power NUMERIC);
      CREATE TABLE public.caught_diary(user_id UUID, species_id UUID);
      CREATE FUNCTION public.touch_fishing_presence() RETURNS JSONB LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM 1 FROM public.user_in_area WHERE user_id = auth.uid() FOR SHARE;
        UPDATE public.user_in_area SET heartbeats = heartbeats + 1 WHERE user_id = auth.uid();
        RETURN '{"effects": []}'::JSONB;
      END;
      $$;
      INSERT INTO public.user_in_area VALUES ('${uid}', '${area}', '${uid}', 'enter', 0);
      INSERT INTO public.species VALUES ('${fish}', 'Preview fish', NULL, NULL, 'RARE', 1, 5);
      INSERT INTO public.species_in_area VALUES ('${fish}', '${area}', 1, NULL);
      INSERT INTO public.caught_diary VALUES ('${uid}', '${fish}');
      SET test.uid = '${uid}';
    `);
    // Use the actual fatigue calculation helper with the production preview.
    const ranked = await read('./supabase/migrations/20261115_ranked_fishing.sql');
    const multiplier = ranked.match(/CREATE FUNCTION public\.fishing_fatigue_multiplier[\s\S]*?\$\$;/);
    assert.ok(multiplier);
    await db.exec(multiplier[0]);
    await db.exec(await read('./supabase/rpc/fishing/preview_fish_by_depth.sql'));

    // Reproduce PostgREST's transaction choice for a legacy STABLE RPC.
    await db.exec('ALTER FUNCTION public.preview_fish_by_depth(NUMERIC) STABLE; BEGIN READ ONLY;');
    await assert.rejects(db.query('SELECT public.preview_fish_by_depth(2)'), /SELECT FOR SHARE.*read-only transaction/);
    await db.exec('ROLLBACK;');

    const repair = await read('./supabase/migrations/20261116_fishing_depth_preview_transaction.sql');
    await db.exec(repair);
    await db.exec(repair);
    const volatility = await scalar("SELECT provolatile FROM pg_proc WHERE oid = 'public.preview_fish_by_depth(numeric)'::regprocedure");
    assert.equal(volatility, 'v');
    await db.exec(volatility === 'v' ? 'BEGIN READ WRITE;' : 'BEGIN READ ONLY;');
    await db.exec('SET LOCAL ROLE authenticated;');
    const preview = await scalar('SELECT public.preview_fish_by_depth(2)');
    await db.exec('COMMIT;');
    assert.equal(preview.area_id, area);
    assert.equal(preview.total_species, 1);
    assert.equal(preview.discovered_species, 1);
    assert.equal(preview.fishes[0].species_id, fish);
    assert.equal(preview.fishes[0].spawn_chance, 100);
    assert.equal(await scalar('SELECT heartbeats FROM public.user_in_area'), 1);

    await assert.rejects(db.query('SELECT public.preview_fish_by_depth(-1)'), /non-negative/);
    await db.exec("UPDATE public.user_in_area SET status = 'leave';");
    await assert.rejects(db.query('SELECT public.preview_fish_by_depth(2)'), /not in an active fishing area/);
    await db.exec("SET test.uid = '';");
    await assert.rejects(db.query('SELECT public.preview_fish_by_depth(2)'), /Authentication required/);
    assert.equal(await scalar('SELECT heartbeats FROM public.user_in_area'), 1);
  } finally {
    await db.close();
  }
});
