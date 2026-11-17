import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const item = '33333333-3333-4333-8333-333333333333';
const missing = '44444444-4444-4444-8444-444444444444';

test('DB-only item grants preserve inventory data and deny API roles', async () => {
  const db = new PGlite();
  const query = async (sql, args) => (await db.query(sql, args)).rows;
  const grant = async (itemId = item, userId = user) =>
    (await query('SELECT public.grant_inventory_item($1, $2) AS id', [itemId, userId]))[0].id;
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
      INSERT INTO auth.users VALUES ('${user}'), ('${other}');
      INSERT INTO public.items VALUES (
        '${item}', 'Mồi câu 🐟', '/bait.png', 'fish', 'bait', 5,
        'Thông tin vật phẩm', 'fishing', 'use_bait', 'stack',
        '{"luck_bonus":2,"id":"untrusted","quantity":999}', false
      );
    `);
    const sql = await readFile(new URL('./supabase/rpc/inventory/grant_inventory_item.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec(sql);

    const id = await grant();
    const row = (await query('SELECT * FROM public.user_inventory WHERE id=$1', [id]))[0];
    assert.equal(row.user_id, user);
    assert.equal(row.rpc, 'use_bait');
    assert.deepEqual(row.data, {
      id: item, name: 'Mồi câu 🐟', image: '/bait.png', icon: 'fish',
      category: 'bait', quantity: 5, information: 'Thông tin vật phẩm',
      classification: 'fishing', luck_bonus: 2,
    });
    await query("UPDATE public.user_inventory SET data=data || '{\"custom\":true}' WHERE id=$1", [id]);
    assert.equal(await grant(), id);
    const stacked = (await query('SELECT data FROM public.user_inventory WHERE id=$1', [id]))[0].data;
    assert.equal(stacked.quantity, 10);
    assert.equal(stacked.custom, true);
    assert.notEqual(await grant(item, other), id);

    await assert.rejects(query('SELECT public.grant_inventory_item($1)', [item]), /required/);
    await db.exec(`SET test.uid='${user}'`);
    assert.equal((await query('SELECT public.grant_inventory_item($1) AS id', [item]))[0].id, id);
    assert.equal(await grant(item, null), id);
    assert.equal((await query('SELECT data FROM public.user_inventory WHERE id=$1', [id]))[0].data.quantity, 20);
    const explicit = await grant(item, other);
    assert.equal((await query('SELECT user_id FROM public.user_inventory WHERE id=$1', [explicit]))[0].user_id, other);
    await db.exec("SET test.uid=''");

    await db.exec("UPDATE public.items SET storage_type='single', quantity=NULL, data=NULL");
    const single = await grant();
    assert.notEqual(await grant(), single);
    assert.equal((await query('SELECT data FROM public.user_inventory WHERE id=$1', [single]))[0].data.quantity, 1);

    const before = await query('SELECT * FROM public.user_inventory ORDER BY id');
    await assert.rejects(grant(null), /required/);
    await assert.rejects(grant(item, null), /required/);
    await assert.rejects(grant(missing), /Item not found/);
    await assert.rejects(grant(item, missing), /User not found/);
    await db.exec('UPDATE public.items SET "isDisabled"=true');
    await assert.rejects(grant(), /disabled/);
    await db.exec('UPDATE public.items SET "isDisabled"=false, quantity=0');
    await assert.rejects(grant(), /greater than zero/);
    await db.exec('UPDATE public.items SET quantity=-1');
    await assert.rejects(grant(), /greater than zero/);
    assert.deepEqual(await query('SELECT * FROM public.user_inventory ORDER BY id'), before);

    for (const role of ['anon', 'authenticated', 'service_role']) {
      const privileges = await query('SELECT has_function_privilege($1, $2, $3) AS allowed',
        [role, 'public.grant_inventory_item(uuid,uuid)', 'EXECUTE']);
      assert.equal(privileges[0].allowed, false);
      await db.exec(`SET ROLE ${role}`);
      await assert.rejects(grant(), /permission denied for function/);
      await assert.rejects(query('SELECT public.grant_inventory_item($1)', [item]), /permission denied for function/);
      await db.exec('RESET ROLE');
    }
  } finally {
    await db.close();
  }
});
