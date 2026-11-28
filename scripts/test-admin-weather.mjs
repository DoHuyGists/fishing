import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('weather updates distinguish successful writes, RLS-filtered rows and database errors', async t => {
  const server = await createServer({
    configFile: false, envDir: false, appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://weather-test.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
    },
  });
  try {
    const { default: supabase } = await server.ssrLoadModule('/src/database/connection.ts');
    const { supabaseWeatherRepository: repo } = await server.ssrLoadModule('/src/data/supabaseWeatherRepository.ts');
    const payload = { code: 'RAIN', name: 'Mưa', rarityTier: 'COMMON', extremeWeight: 1.5,
      durationMin: 15, durationMax: 30, image: null };
    const calls = [];
    let result;
    const query = {
      update(value) { calls.push(['update', value]); return this; },
      eq(column, value) { calls.push(['eq', column, value]); return this; },
      select(value) { calls.push(['select', value]); return this; },
      async maybeSingle() { return result; },
    };
    t.mock.method(supabase, 'from', table => { assert.equal(table, 'weathers'); return query; });

    await t.test('returns the saved row and maps fields using the selected id', async () => {
      result = { data: { id: 'weather-id', code: 'RAIN', name: 'Mưa', rarity_tier: 'COMMON',
        extreme_weight: 1.5, duration_min: 15, duration_max: 30, image: null, created_at: '2026-11-28' }, error: null };
      const saved = await repo.update('weather-id', payload);
      assert.deepEqual(saved, { id: 'weather-id', ...payload, createdAt: '2026-11-28' });
      assert.deepEqual(calls, [
        ['update', { code: 'RAIN', name: 'Mưa', rarity_tier: 'COMMON', extreme_weight: 1.5,
          duration_min: 15, duration_max: 30, image: null }],
        ['eq', 'id', 'weather-id'], ['select', '*'],
      ]);
    });
    await t.test('zero updated rows fail explicitly instead of reporting success', async () => {
      result = { data: null, error: null };
      await assert.rejects(repo.update('weather-id', payload), /không có quyền cập nhật.*RLS/);
    });
    await t.test('database errors retain their original message', async () => {
      result = { data: null, error: { code: '23505', message: 'duplicate weather code' } };
      await assert.rejects(repo.update('weather-id', payload), /duplicate weather code/);
    });
  } finally {
    await server.close();
  }
});
