import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import ts from 'typescript';

test('cancel RPC enforces ownership, preserves results and unlocks cancelled sessions', async () => {
  const db = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111';
  const session = '22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
        SELECT nullif(current_setting('app.user_id', true), '')::uuid
      $$;
      CREATE TABLE public.fishing_sessions (
        id uuid PRIMARY KEY, user_id uuid, status text,
        challenge_data jsonb DEFAULT '{}', expires_at timestamptz
      );
      INSERT INTO fishing_sessions VALUES ('${session}', '${owner}', 'WAITING', '{}', now() + interval '1 hour');
    `);
    await db.exec(await readFile(new URL('./supabase/rpc/fishing/cancel_fishing_session.sql', import.meta.url), 'utf8'));
    const cancel = () => db.query('SELECT public.cancel_fishing_session($1)', [session]);
    const status = async () => (await db.query('SELECT status FROM fishing_sessions')).rows[0].status;
    await assert.rejects(cancel(), /not authenticated/);
    await db.query("SELECT set_config('app.user_id', $1, false)", ['33333333-3333-4333-8333-333333333333']);
    await assert.rejects(cancel(), /unauthorized/);
    assert.equal(await status(), 'WAITING');
    await db.query("SELECT set_config('app.user_id', $1, false)", [owner]);
    await db.exec('SET ROLE anon');
    await assert.rejects(cancel(), /permission denied/);
    await db.exec('RESET ROLE; SET ROLE authenticated');
    await cancel();
    await cancel(); // Lost-response retry under the actual client role.
    await db.exec('RESET ROLE');
    assert.equal(await status(), 'CANCELLED');
    const active = await db.query(`SELECT count(*)::int AS count FROM fishing_sessions
      WHERE user_id = $1 AND expires_at > clock_timestamp()
        AND (status IS NULL OR status NOT IN ('SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'))`, [owner]);
    assert.equal(active.rows[0].count, 0);
    await db.exec("UPDATE fishing_sessions SET status = 'BITE', challenge_data = '{\"activatedAt\":123}'");
    await assert.rejects(cancel(), /fight has started/);
    assert.equal(await status(), 'BITE');
    for (const terminal of ['SUCCESS', 'FAILED', 'EXPIRED']) {
      await db.query('UPDATE fishing_sessions SET status = $1', [terminal]);
      await cancel();
      assert.equal(await status(), terminal);
    }
    await db.exec("UPDATE fishing_sessions SET status = 'BITE', challenge_data = '{}'");
    await cancel();
    assert.equal(await status(), 'CANCELLED');
  } finally {
    await db.close();
  }
});

test('bait retrieval waits for cancellation, allows retries and ignores stale responses', async () => {
  setActivePinia(createPinia());
  let cancel;
  let calls = 0;
  const imports = {
    pinia: { defineStore },
    '../i18n': { t: key => key },
    './auth': { useAuthStore: () => ({ userId: 'user-1' }) },
    './userProfile': { useUserProfileStore: () => ({ fishingNetCapacity: 10 }) },
    './equipment': {}, './userInArea': {},
    './dayPhase': { useDayPhaseStore: () => ({ $reset() {} }) },
    '../data/supabaseFishRepository': {},
    '../data/supabaseFishingAreaRepository': { supabaseFishingAreaRepository: {
      cancelFishingSession: id => { assert.equal(id, 'session-1'); calls++; return cancel(); },
      fetchSessionChallenge: async () => { throw new Error('Session already cancelled'); },
    } },
    '../data/supabaseEquipmentRepository': {},
    '../data/supabaseUserInAreaRepository': {},
    '../database/connection': {},
    '../data/fishingDepth': {}, '../data/tensionChallenge': {},
  };
  const source = await readFile(new URL('../src/stores/fishing.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'window', output)(id => {
    assert(id in imports, `Unexpected import: ${id}`);
    return imports[id];
  }, module, module.exports, { setTimeout, clearTimeout });
  const store = module.exports.useFishingStore();
  store.sessionReady = true;
  store.sessionId = 'session-1';
  store.castPhase = 'waiting';
  let resolve;
  cancel = () => new Promise(yes => { resolve = yes; });
  let pending = store.reelInBait();
  assert.equal(store.sessionId, 'session-1');
  assert.equal(store.canCast, false);
  assert.equal(store.canReelIn, false);
  await store.reelInBait();
  assert.equal(calls, 1);
  await store.startChallengeForSession('session-1');
  assert.equal(store.sessionId, 'session-1');
  assert.equal(store.castPhase, 'waiting');
  // A BITE arriving while cancellation is pending cannot activate a fight.
  store.castPhase = 'bite';
  store.tensionChallenge = { expiresAt: 0 };
  store.setTensionReeling(true);
  store.advanceTensionFight();
  assert.equal(store.tensionReeling, false);
  assert.equal(await store.leaveFishingArea(), false);
  resolve();
  await pending;
  assert.equal(store.sessionId, null);
  assert.equal(store.castPhase, 'idle');
  assert.equal(store.isRetrievingBait, false);
  assert.equal(store.canCast, true);

  store.sessionId = 'session-1';
  store.castPhase = 'waiting';
  cancel = async () => { throw new Error('Network unavailable'); };
  await store.reelInBait();
  assert.equal(store.sessionId, 'session-1');
  assert.equal(store.castPhase, 'waiting');
  assert.equal(store.canReelIn, true);
  assert.equal(store.castMessage, 'fishing.khong_the_thu_moi_hay_thu_lai');
  cancel = async () => {};
  await store.reelInBait();
  assert.equal(store.sessionId, null);
  assert.equal(store.isRetrievingBait, false);
  store.sessionId = 'session-1';
  store.castPhase = 'waiting';
  cancel = () => new Promise(yes => { resolve = yes; });
  pending = store.reelInBait();
  store.resetSession();
  store.sessionId = 'new-session';
  store.castPhase = 'waiting';
  resolve();
  await pending;
  assert.equal(store.sessionId, 'new-session');
  assert.equal(store.castPhase, 'waiting');

  store.sessionId = 'session-1';
  store.isStartingTensionChallenge = true;
  assert.equal(store.canReelIn, false);
  store.isStartingTensionChallenge = false;
  store.castPhase = 'casting';
  store.isCasting = true;
  assert.equal(store.canReelIn, false);
});
