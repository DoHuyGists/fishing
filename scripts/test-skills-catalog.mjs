import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('catalog preparation preserves retained skills, rejects invested retirements and can rerun', async () => {
  const sql = await readFile(new URL('./supabase/seeds/prepare_skills_catalog.sql', import.meta.url), 'utf8');
  assert.ok(!sql.startsWith('\uFEFF'));
  const retained = ['xp_boost', 'fast_bite', 'shiny_hunter', 'rare_fish', 'big_fish',
    'escape_reduction', 'hook_mastery', 'rod_mastery', 'line_mastery',
    'bait_mastery', 'bait_saver', 'weather_mastery'];
  const retired = ['catch_rate', 'fishing_luck', 'variant_hunter', 'heavy_fish',
    'star_fish', 'cash_boost', 'deep_fishing', 'shallow_fishing'];
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE user_profile(id text);
      CREATE TABLE skills(id text PRIMARY KEY, code text UNIQUE, description text,
        effect_per_level jsonb, sort_order int, is_disabled boolean, max_level int,
        updated_at timestamptz);
      CREATE TABLE user_skills(user_id text, skill_id text REFERENCES skills(id), level int);
    `);
    for (const code of [...retained, ...retired]) {
      await db.query('INSERT INTO skills VALUES($1,$1,NULL,$2,1,false,10,NULL)', [code, {}]);
    }
    await db.exec("INSERT INTO user_skills VALUES('player','catch_rate',3),('player','xp_boost',2)");
    await assert.rejects(db.exec(sql), /player investments/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT count(*)::int n FROM skills')).rows[0].n, 20);
    await db.exec("DELETE FROM user_skills WHERE skill_id='catch_rate'");
    await db.exec(sql);
    assert.deepEqual((await db.query('SELECT code FROM skills ORDER BY sort_order')).rows.map(r => r.code), retained);
    assert.equal((await db.query('SELECT count(*)::int n FROM skills WHERE id=code AND max_level=10 AND NOT is_disabled')).rows[0].n, 12);
    assert.deepEqual((await db.query('SELECT * FROM user_skills')).rows, [{ user_id: 'player', skill_id: 'xp_boost', level: 2 }]);
    const steady = await db.query('SELECT code,description,effect_per_level,sort_order FROM skills ORDER BY sort_order');
    assert.equal(steady.rows[5].description, 'Tăng thời gian cho phép dây câu bị chùng trước khi cá thoát.');
    assert.deepEqual(steady.rows[5].effect_per_level, { slack_escape_time_bonus: 1 });
    assert.deepEqual(steady.rows[11].effect_per_level, { weather_penalty_reduction: 2 });
    await db.exec(sql);
    assert.deepEqual((await db.query('SELECT code,description,effect_per_level,sort_order FROM skills ORDER BY sort_order')).rows, steady.rows);
  } finally {
    await db.close();
  }
});
