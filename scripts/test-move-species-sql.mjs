import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('batch fish transfers validate ownership, status and total capacity atomically', async () => {
  const db = new PGlite();
  const user = randomUUID(), other = randomUUID();
  const ids = Array.from({ length: 5 }, () => randomUUID());
  const move = async (selected, status = 'normal') =>
    (await db.query('SELECT public.move_species($1::uuid[], $2::text) AS result', [selected, status])).rows[0].result;
  const snapshot = async () => (await db.query('SELECT * FROM public.caught ORDER BY id')).rows;
  const rejectUnchanged = async (selected, status = 'normal') => {
    const before = await snapshot();
    await assert.rejects(move(selected, status));
    assert.deepEqual(await snapshot(), before);
  };
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('test.uid', true), '')::uuid
      $$;
      CREATE TABLE public.user_profile(id uuid PRIMARY KEY, species_storage_capacity bigint);
      CREATE TABLE public.caught(id uuid PRIMARY KEY, user_id uuid, status text);
      GRANT SELECT ON public.caught TO authenticated;
      CREATE FUNCTION public.move_species(p_caught_id uuid, p_status text) RETURNS json LANGUAGE sql AS $$ SELECT '{}'::json $$;
    `);
    await db.query('INSERT INTO public.user_profile VALUES ($1, 3)', [user]);
    for (let i = 0; i < ids.length; i++) {
      await db.query('INSERT INTO public.caught VALUES ($1, $2, $3)',
        [ids[i], i === 4 ? other : user, i === 3 ? 'normal' : 'in-net']);
    }
    const sql = await readFile(new URL('./supabase/rpc/caught/move_species.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    assert.equal((await db.query("SELECT to_regprocedure('public.move_species(uuid,text)') AS old")).rows[0].old, null);
    await rejectUnchanged([ids[0]]); // No login.
    await db.query("SELECT set_config('test.uid', $1, false)", [user]);
    await db.exec('SET ROLE authenticated');
    assert.equal((await move([ids[0]])).moved_count, 1);
    await rejectUnchanged([ids[1], ids[2]]); // Only one free storage slot.
    await rejectUnchanged([ids[1], ids[4]]); // Includes another user's fish.
    await rejectUnchanged([ids[1], randomUUID()]);
    await rejectUnchanged([ids[1], ids[3]]); // Includes fish already in storage.
    await rejectUnchanged([]);
    await rejectUnchanged(null);
    await rejectUnchanged([ids[1], null]);
    await rejectUnchanged([ids[1]], 'invalid');
    await rejectUnchanged([ids[1]], null);
    assert.equal((await move([ids[0], ids[3]], 'in-net')).moved_count, 2);
    assert.equal((await move([ids[0], ids[1], ids[1]])).moved_count, 2); // Deduplicate.
    assert.equal((await move([ids[2]])).moved_count, 1); // Exactly at capacity.
    const allStored = (await snapshot()).filter(f => f.user_id === user && f.status === 'normal').map(f => f.id);
    assert.equal((await move(allStored, 'in-net')).moved_count, 3);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT status FROM public.caught WHERE id=$1', [ids[4]])).rows[0].status, 'in-net');
    await db.exec('SET ROLE anon');
    await assert.rejects(move([ids[0]]), /permission denied/);
  } finally {
    await db.close();
  }
});
