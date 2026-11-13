import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const hat = '33333333-3333-4333-8333-333333333333', vest = '44444444-4444-4444-8444-444444444444';
test('body equipment migration and RPCs run on PostgreSQL', async () => {
  const db = new PGlite();
  const query = async (sql, args) => (await db.query(sql, args)).rows;
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE public.user_inventory(id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, data jsonb);
      INSERT INTO auth.users VALUES ('${owner}'), ('${other}');
      INSERT INTO public.user_inventory VALUES
        ('${hat}', '${owner}', '{"category":"head","health_bonuses":{"morale":200},"quantity":1}'),
        ('${vest}', '${owner}', '{"category":"torso","quantity":1}');
    `);
    const migration = await readFile(new URL('./supabase/migrations/20261113_user_body_equipments.sql', import.meta.url), 'utf8');
    const rpc = await readFile(new URL('./supabase/rpc/equipment/save_body_equipment_set.sql', import.meta.url), 'utf8');
    await db.exec(migration); await db.exec(rpc); await db.exec(migration); await db.exec(rpc);
    await db.exec(`SET test.uid='${owner}'; SET ROLE authenticated;`);
    const one = (await query('SELECT * FROM public.create_body_equipment_set()'))[0];
    const two = (await query('SELECT * FROM public.create_body_equipment_set()'))[0];
    assert.equal(one.is_used, true); assert.equal(two.is_used, false);
    const save = (id, head = [], torso = []) => query("SELECT public.save_body_equipment_set($1,$2,$3,'[]','[]','[]','[]')", [id, JSON.stringify(head), JSON.stringify(torso)]);
    {
      await save(one.id, [{ inventory_id: hat, health_bonuses: { morale: 9999 } }], [{ inventory_id: vest }]);
      const saved = (await query('SELECT * FROM public.user_body_equipments WHERE id=$1', [one.id]))[0];
      assert.deepEqual(saved.head, [{ inventory_id: hat }]); assert.equal(saved.is_used, true);
      await query('SELECT public.switch_body_equipment($1)', [two.id]);
      assert.equal((await query('SELECT count(*)::int AS n FROM public.user_body_equipments WHERE is_used'))[0].n, 1);
    }
    {
      await assert.rejects(save(one.id, {}), /phải là một mảng/);
      await assert.rejects(save(one.id, [{ inventory_id: 'invalid' }]), /không hợp lệ/);
      await assert.rejects(save(one.id, [{ inventory_id: hat }, { inventory_id: hat }]), /trùng/);
      await assert.rejects(save(one.id, [{ inventory_id: vest }]), /không phù hợp/);
      assert.deepEqual((await query('SELECT head FROM public.user_body_equipments WHERE id=$1', [one.id]))[0].head, [{ inventory_id: hat }]);
    }
    {
      await db.exec(`SET test.uid='${other}';`);
      assert.equal((await query('SELECT * FROM public.user_body_equipments')).length, 0);
      await assert.rejects(save(one.id, [{ inventory_id: hat }]), /Không tìm thấy/);
      await assert.rejects(query('SELECT public.switch_body_equipment($1)', [one.id]), /Không tìm thấy/);
      const foreign = (await query('SELECT * FROM public.create_body_equipment_set()'))[0];
      await assert.rejects(save(foreign.id, [{ inventory_id: hat }]), /không nằm trong kho/);
      await assert.rejects(query('UPDATE public.user_body_equipments SET is_used=false'), /permission denied/);
      await db.exec(`SET test.uid='${owner}';`);
    }
    {
      await db.exec(`RESET ROLE; UPDATE public.user_inventory SET data=jsonb_set(data,'{quantity}','0') WHERE id='${hat}'; SET ROLE authenticated;`);
      await assert.rejects(save(one.id, [{ inventory_id: hat }]), /hết số lượng/);
      await db.exec('RESET ROLE');
      await assert.rejects(query('DELETE FROM public.user_inventory WHERE id=$1', [vest]), /gỡ vật phẩm/);
      await save(one.id);
      await query('DELETE FROM public.user_inventory WHERE id=$1', [vest]);
      assert.equal((await query('SELECT * FROM public.user_inventory WHERE id=$1', [vest])).length, 0);
    }
    {
      await db.exec(`SET test.uid=''; SET ROLE anon;`);
      await assert.rejects(query('SELECT * FROM public.create_body_equipment_set()'), /permission denied/);
      await db.exec(`RESET ROLE; SET test.uid='${owner}'; UPDATE public.user_inventory SET data=jsonb_set(data,'{quantity}','1') WHERE id='${hat}';`);
      await save(one.id, [{ inventory_id: hat }]);
      await query('DELETE FROM auth.users WHERE id=$1', [owner]);
      assert.equal((await query('SELECT * FROM public.user_body_equipments WHERE user_id=$1', [owner])).length, 0);
    }
  } finally { await db.close(); }
});
