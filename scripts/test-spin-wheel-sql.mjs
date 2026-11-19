import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const user = '11111111-1111-4111-8111-111111111111';
const item = '22222222-2222-4222-8222-222222222222';
const season = '33333333-3333-4333-8333-333333333333';

test('seasonal spins grant catalog inventory atomically through the DB-only helper', async () => {
  const db = new PGlite();
  const read = path => readFile(new URL(path, import.meta.url), 'utf8');
  const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0];
  const spin = () => scalar('SELECT public.spin_wheel()');
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('test.uid', true), '')::uuid
      $$;
      CREATE TABLE public.items(
        id uuid PRIMARY KEY, name text, image text, icon text, category text,
        quantity bigint, information text, classification text, rpc text,
        storage_type text, data jsonb, "isDisabled" boolean
      );
      CREATE TABLE public.user_inventory(
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES auth.users(id), rpc text, data jsonb
      );
      CREATE TABLE public.currency(user_id uuid PRIMARY KEY, tickets bigint, cash bigint);
      INSERT INTO auth.users VALUES ('${user}');
      INSERT INTO public.currency VALUES ('${user}', 5, 100);
      INSERT INTO public.items VALUES (
        '${item}', 'Catalog bait', '/bait.png', 'fish', 'bait', 5,
        'Item information', 'fishing', 'use_bait', 'stack',
        '{"catch_rate":0.8,"luck_bonus":2}', false
      );
    `);
    await db.exec(await read('./supabase/migrations/spin_wheel_seasons.sql'));
    await db.exec(await read('./supabase/rpc/inventory/grant_inventory_item.sql'));
    const sql = await read('./supabase/rpc/spining-wheel/spin-wheel.sql');
    await db.exec(sql);
    await db.exec(sql);
    await assert.rejects(spin(), /Not authenticated/);
    await db.exec(`SET test.uid='${user}'; SET ROLE authenticated;`);
    await assert.rejects(spin(), /Ch\u01b0a c\u00f3 m\u00f9a/);
    await db.exec('RESET ROLE');
    await db.exec(`
      INSERT INTO public.spin_wheel_seasons(id, name, starts_at, ends_at, is_active)
      VALUES ('${season}', 'Current season', now()-interval '1 day', now()+interval '1 day', true);
      SET ROLE authenticated;
    `);
    await assert.rejects(spin(), /ph\u1ea7n th\u01b0\u1edfng kh\u1ea3 d\u1ee5ng/);
    await db.exec(`RESET ROLE; INSERT INTO public.spin_wheel_rewards VALUES ('${season}', '${item}', 0); SET ROLE authenticated;`);

    const first = await spin();
    assert.equal(first.item_id, item);
    assert.equal(first.season.id, season);
    assert.deepEqual(first.rewards.map(reward => reward.id), [item]);
    assert.equal(first.cost, 1);
    assert.equal(first.remaining_tickets, 4);
    assert.equal(first.data.catch_rate, 0.8);
    assert.equal(first.data.quantity, 5);
    assert.equal(first.data.classification, 'fishing');
    const second = await spin();
    assert.equal(second.inventory_id, first.inventory_id);
    assert.equal(second.data.quantity, 10);
    // The caller can spin, but cannot call the free-grant helper directly.
    await assert.rejects(scalar(`SELECT public.grant_inventory_item('${item}', '${user}')`), /permission denied/);
    await db.exec('RESET ROLE');
    assert.equal(await scalar('SELECT count(*) FROM public.user_inventory'), 1);
    assert.equal(await scalar('SELECT rpc FROM public.user_inventory'), 'use_bait');
    assert.equal(await scalar('SELECT cash FROM public.currency'), 100);

    await db.exec('UPDATE public.items SET quantity=0; SET ROLE authenticated;');
    await assert.rejects(spin(), /quantity must be greater than zero/);
    await db.exec('RESET ROLE');
    assert.equal(await scalar('SELECT tickets FROM public.currency'), 3);
    assert.equal(await scalar("SELECT (data->>'quantity')::int FROM public.user_inventory"), 10);

    await db.exec('UPDATE public.items SET quantity=5; UPDATE public.currency SET tickets=0; SET ROLE authenticated;');
    await assert.rejects(spin(), /Kh\u00f4ng \u0111\u1ee7 v\u00e9/);
    await db.exec('RESET ROLE; UPDATE public.currency SET tickets=3; UPDATE public.items SET "isDisabled"=true; SET ROLE authenticated;');
    await assert.rejects(spin(), /ph\u1ea7n th\u01b0\u1edfng kh\u1ea3 d\u1ee5ng/);
    await db.exec('RESET ROLE; SET ROLE anon;');
    await assert.rejects(spin(), /permission denied/);
  } finally {
    await db.close();
  }
});
