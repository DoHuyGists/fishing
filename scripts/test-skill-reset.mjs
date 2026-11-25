import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('skill reset charges invested levels, refunds points and rejects invalid transactions', async () => {
  const db = new PGlite();
  const owner = '00000000-0000-0000-0000-000000000001';
  const other = '00000000-0000-0000-0000-000000000002';
  const skill = '00000000-0000-0000-0000-000000000003';
  const scalar = async (sql, args) => Object.values((await db.query(sql, args)).rows[0])[0];
  const reset = (level = 3) => scalar('SELECT public.reset_skill($1, $2)', [skill, level]);
  const state = () => scalar(`SELECT jsonb_build_object(
    'cash', (SELECT cash FROM currency WHERE user_id='${owner}'),
    'points', (SELECT skill_points FROM user_profile WHERE id='${owner}'),
    'levels', (SELECT level FROM user_skills WHERE user_id='${owner}' AND skill_id='${skill}'))`);
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth; CREATE SCHEMA feature_control;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
        SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
      CREATE FUNCTION public.feature_is_enabled(text) RETURNS boolean LANGUAGE sql AS $$
        SELECT coalesce(current_setting('test.enabled', true), 'true')::boolean $$;
      CREATE TABLE feature_control.request_rules(feature_key text, path text, writes_only boolean, PRIMARY KEY(feature_key,path));
      CREATE TABLE public.user_profile(id uuid PRIMARY KEY, skill_points integer);
      CREATE TABLE public.currency(user_id uuid PRIMARY KEY, cash numeric CHECK(cash >= 0));
      CREATE TABLE public.user_skills(user_id uuid, skill_id uuid, level integer CHECK(level > 0), PRIMARY KEY(user_id,skill_id));
      INSERT INTO user_profile VALUES('${owner}', 2),('${other}', 5);
      INSERT INTO currency VALUES('${owner}', 50000),('${other}', 90000);
      INSERT INTO user_skills VALUES('${owner}','${skill}',3),('${other}','${skill}',4);
    `);
    await db.exec(await readFile(new URL('./supabase/migrations/20261125_reset_skill.sql', import.meta.url), 'utf8'));
    await assert.rejects(reset(), /Authentication required/);
    await db.query("SELECT set_config('test.uid',$1,false)", [owner]);
    await db.exec('SET ROLE anon');
    await assert.rejects(reset(), /permission denied/);
    await db.exec('RESET ROLE');
    await assert.rejects(reset(4), /Skill level changed/);
    await assert.rejects(reset(null), /Skill level changed/);
    assert.deepEqual(await state(), { cash: 50000, points: 2, levels: 3 });
    await db.exec("SELECT set_config('test.enabled','false',false)");
    await assert.rejects(reset(), /Feature disabled/);
    await db.exec("SELECT set_config('test.enabled','true',false); UPDATE currency SET cash=29999 WHERE user_id='" + owner + "'");
    await assert.rejects(reset(), /Insufficient cash/);
    assert.deepEqual(await state(), { cash: 29999, points: 2, levels: 3 });
    await db.query('UPDATE currency SET cash=30000 WHERE user_id=$1', [owner]);
    // A later failure must roll the wallet debit back too.
    await db.exec(`ALTER TABLE user_profile ADD CONSTRAINT point_limit CHECK(id <> '${owner}' OR skill_points < 5)`);
    await assert.rejects(reset(), /point_limit/);
    assert.deepEqual(await state(), { cash: 30000, points: 2, levels: 3 });
    await db.exec('ALTER TABLE user_profile DROP CONSTRAINT point_limit');
    const result = await reset();
    assert.deepEqual(result, { success: true, skill_id: skill, refunded_points: 3, remaining_skill_points: 5, remaining_cash: 0 });
    assert.deepEqual(await state(), { cash: 0, points: 5, levels: null });
    await assert.rejects(reset(), /Skill has no invested points/);
    assert.equal(await scalar('SELECT level FROM user_skills WHERE user_id=$1', [other]), 4);
    assert.equal(await scalar('SELECT cash FROM currency WHERE user_id=$1', [other]), '90000');
  } finally {
    await db.close();
  }
});
