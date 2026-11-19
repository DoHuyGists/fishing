import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import ts from 'typescript';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const source = ts.transpileModule(await read('../src/stores/player-fishing-store.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const result = { success: true, caught: { id: 'fish-1', name: 'Fish', weight: 2, image: null,
  is_shiny: false, variant_type: 'NORMAL', star_rating: 1 } };
const payload = { sessionId: 'session-1', totalTicks: 1, inputs: [{ tick: 0, reeling: true }], claimedResult: 'won' };
const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};

function fixture({ timeout, storageUnavailable = false } = {}) {
  const auth = { user: { id: 'owner' }, sessionGeneration: 1, get userId() { return this.user.id; } };
  const data = new Map();
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem(key, value) { if (storageUnavailable) throw new Error('Storage unavailable'); data.set(key, value); },
    removeItem: key => data.delete(key),
  };
  const repository = { submitTensionChallenge: async () => result };
  const profile = { profile: { id: 'owner' }, error: '', fishingNetCapacity: 10, async fetchProfile() {} };
  const imports = {
    pinia: { defineStore }, '../i18n': { t: key => key },
    './auth': { useAuthStore: () => auth }, './player-user-profile-store': { useUserProfileStore: () => profile },
    './player-equipment-store': { useEquipmentStore: () => ({ error: '', async fetchEquipment() {} }) },
    './player-user-In-area-store': { useUserInAreaStore: () => ({ setCurrentUserInArea: async () => ({ status: 'enter', area_id: 'lake' }) }) },
    './player-day-phase-store': { useDayPhaseStore: () => ({ $reset() {}, setCurrentScenePhase() {} }) },
    '../data/supabaseFishingAreaRepository': { supabaseFishingAreaRepository: repository },
    '../data/supabaseEquipmentRepository': {}, '../data/supabaseFishRepository': {},
    '../data/supabaseUserInAreaRepository': {}, '../database/connection': {},
    '../data/fishingDepth': { buildDepthConfig: () => ({ maxMeters: 10 }) },
    '../data/tensionChallenge': { isTensionChallenge: value => value?.type === 'tension-challenge', createTensionFight: () => ({ tick: 0 }) },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'window', 'sessionStorage', source)(id => {
    assert(id in imports, `Unexpected import: ${id}`);
    return imports[id];
  }, module, module.exports, { setTimeout: (fn, ms) => setTimeout(fn, timeout ?? ms), clearTimeout }, storage);
  function fresh() {
    setActivePinia(createPinia());
    const store = module.exports.useFishingStore();
    Object.assign(store, { currentAreaId: 'lake', sessionReady: true, sessionId: 'session-1',
      castPhase: 'bite', tensionChallenge: { sessionId: 'session-1' }, tensionStartedAt: 1 });
    store.initializeFishingArea = async areaId => { store.currentAreaId = areaId; };
    return store;
  }
  return { store: fresh(), fresh, repository, auth, data };
}

test('lost response retains the exact replay across reload and deduplicates an already refreshed bag', async () => {
  const f = fixture();
  let submitted;
  f.repository.submitTensionChallenge = async replay => { submitted = structuredClone(replay); throw new TypeError('Failed to fetch'); };
  await f.store.submitTensionChallenge(payload);
  assert.deepEqual(submitted, payload);
  assert.equal(f.store.castPhase, 'unconfirmed');
  assert.equal(f.store.sessionId, payload.sessionId);
  assert.equal(f.store.canCast, false);
  assert.equal(await f.store.leaveFishingArea(), false);
  const store = f.fresh();
  await store.initializeSession('owner');
  assert.equal(store.sessionReady, true);
  assert.equal(store.castPhase, 'unconfirmed');
  assert.deepEqual(store.pendingResult.payload, payload);
  store.inventory = [{ id: result.caught.id }];
  let calls = 0;
  const response = deferred();
  f.repository.submitTensionChallenge = replay => { calls++; assert.deepEqual(replay, payload); return response.promise; };
  const retry = store.retryPendingResult();
  await store.retryPendingResult();
  assert.equal(calls, 1);
  response.resolve(result);
  await retry;
  assert.equal(store.castPhase, 'caught');
  assert.equal(store.inventory.length, 1);
  assert.equal(store.pendingResult, null);
  assert.equal(f.data.size, 0);
});

test('timeout after commit can recover without storage; a late response cannot settle the next attempt', async () => {
  const f = fixture({ timeout: 5, storageUnavailable: true });
  const response = deferred();
  f.repository.submitTensionChallenge = () => response.promise;
  await f.store.submitTensionChallenge(payload);
  assert.equal(f.store.castPhase, 'unconfirmed');
  response.resolve(result);
  await new Promise(setImmediate);
  assert.equal(f.store.castPhase, 'unconfirmed');
  f.repository.submitTensionChallenge = async () => result;
  await f.store.retryPendingResult();
  assert.equal(f.store.inventory.length, 1);
  assert.equal(f.store.pendingResult, null);
});

test('account changes and resets reject late responses and isolate persisted recovery', async () => {
  const f = fixture();
  const response = deferred();
  f.repository.submitTensionChallenge = () => response.promise;
  const request = f.store.submitTensionChallenge(payload);
  f.auth.user = { id: 'other' };
  f.auth.sessionGeneration++;
  f.store.resetSession();
  response.resolve(result);
  await request;
  assert.equal(f.store.inventory.length, 0);
  assert.equal(f.store.pendingResult, null);
  assert(f.data.has('fishing-result-pending:owner'));
  assert(!f.data.has('fishing-result-pending:other'));
  // A stale response is also ignored if the auth changes before the view resets.
  f.auth.user = { id: 'owner' };
  f.auth.sessionGeneration++;
  const store = f.fresh();
  const later = deferred();
  f.repository.submitTensionChallenge = () => later.promise;
  const next = store.submitTensionChallenge(payload);
  f.auth.sessionGeneration++;
  later.resolve(result);
  await next;
  assert.equal(store.inventory.length, 0);
  assert(store.pendingResult);
});

test('confirmed SQL rejection clears the replay; malformed responses retain it', async () => {
  const f = fixture();
  f.repository.submitTensionChallenge = async () => null;
  await f.store.submitTensionChallenge(payload);
  assert.equal(f.store.castPhase, 'unconfirmed');
  f.repository.submitTensionChallenge = async () => { throw Object.assign(new Error('Permission denied before RPC'), { code: '42501' }); };
  await f.store.retryPendingResult();
  assert.equal(f.store.castPhase, 'unconfirmed');
  assert(f.store.pendingResult);
  f.repository.submitTensionChallenge = async () => { throw Object.assign(new Error('Session expired'), { code: 'FISHING_RESULT_REJECTED' }); };
  await f.store.retryPendingResult();
  assert.equal(f.store.pendingResult, null);
  assert.equal(f.store.castPhase, 'lost');
  assert.equal(f.store.canCast, true);
  assert.equal(f.data.size, 0);
});

test('lost activation response recovers a committed failure, including after reload', async () => {
  const f = fixture();
  f.store.tensionStartedAt = null;
  f.store.advanceTensionFight = () => {};
  const response = deferred();
  f.repository.startTensionChallenge = () => response.promise;
  const activation = f.store.beginTensionChallenge();
  f.store.setTensionReeling(false);
  assert.equal(f.store.tensionReeling, false);
  response.resolve(null); // A broken/lost activation response must not discard the session.
  await activation;
  assert.equal(f.store.castPhase, 'unconfirmed');
  const store = f.fresh();
  await store.initializeSession('owner');
  f.repository.startTensionChallenge = async () => ({ resolution: { success: false, result: 'EXPIRED' } });
  await store.retryPendingResult();
  assert.equal(store.castPhase, 'lost');
  assert.equal(store.pendingResult, null);
  assert.equal(store.isStartingTensionChallenge, false);
  assert.equal(f.data.size, 0);
});

test('activation retry resumes the original server clock and preserves release input while waiting', async () => {
  const f = fixture();
  f.store.tensionStartedAt = null;
  f.store.advanceTensionFight = () => {};
  const response = deferred();
  f.repository.startTensionChallenge = () => response.promise;
  const request = f.store.beginTensionChallenge();
  f.store.setTensionReeling(true);
  f.store.setTensionReeling(false);
  const now = Date.now();
  response.resolve({ server_time_ms: now, challenge_data: { type: 'tension-challenge', sessionId: payload.sessionId,
    startedAt: now - 1000, activatedAt: now - 1000 } });
  await request;
  assert.equal(f.store.castPhase, 'bite');
  assert.equal(f.store.tensionStartedAt + f.store.serverClockOffset, now - 1000);
  assert.deepEqual(f.store.tensionInputs, []);
  assert.equal(f.store.pendingResult, null);
  assert.equal(f.store.isStartingTensionChallenge, false);
  assert.equal(f.data.size, 0);
});

test('SQL receipts protect ownership and replay successful, failed and expired results exactly once', async () => {
  const db = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111';
  const session = '22222222-2222-4222-8222-222222222222';
  const failed = '33333333-3333-4333-8333-333333333333';
  const expired = '44444444-4444-4444-8444-444444444444';
  const lateActivation = '55555555-5555-4555-8555-555555555555';
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('app.uid',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE fishing_sessions(id uuid PRIMARY KEY,user_id uuid,status text,challenge_data jsonb,
        bite_at timestamptz,expires_at timestamptz,species_id uuid);
      CREATE TABLE fishing_session_mechanics(session_id uuid PRIMARY KEY,failure_reason text);
      CREATE TABLE rewards(session_id uuid PRIMARY KEY,calls int DEFAULT 0);
      CREATE FUNCTION resolve_fishing_challenge(p_id uuid,p_success boolean,p_time int) RETURNS jsonb
      LANGUAGE plpgsql AS $$ BEGIN
        INSERT INTO rewards VALUES(p_id,1) ON CONFLICT(session_id) DO UPDATE SET calls=rewards.calls+1;
        UPDATE fishing_sessions SET status=CASE WHEN p_success THEN 'SUCCESS' ELSE 'FAILED' END WHERE id=p_id;
        RETURN jsonb_build_object('success',p_success,'caught',CASE WHEN p_success THEN jsonb_build_object('id',p_id) ELSE NULL END);
      END $$;
    `);
    const sql = await read('./supabase/rpc/fishing/submit_tension_challenge.sql');
    await db.exec(sql);
    await db.exec(sql); // Deployment is repeatable and preserves existing receipt storage.
    const now = Date.now() - 2000;
    const challenge = { type: 'tension-challenge', version: 1, sessionId: session, seed: 1,
      startedAt: now, activatedAt: now, expiresAt: now + 90000,
      config: { tickRate: 1, safeMin: 10, safeMax: 80, maxTension: 100, startTension: 50,
        startDistance: 1, reelRate: 0, releaseRate: 0, reelSpeed: 2, slackEscapeSeconds: 10,
        slackThresholdRatio: 0.2, slackDistanceRate: 0, fishPullMultiplier: 1, minimumStrength: 1 },
      fish: { baseStrength: 1, burstChance: 0, burstMin: 0, burstMax: 0, staminaDrain: 0,
        basePull: 0, pullAmplitude: 0, pullPeriodTicks: 10, burstMinTicks: 1, burstMaxTicks: 1 } };
    for (const id of [session, failed, expired, lateActivation]) {
      await db.query("INSERT INTO fishing_sessions VALUES($1,$2,'BITE',$3,clock_timestamp()-interval '2 seconds',clock_timestamp()+interval '1 minute',NULL)",
        [id, owner, { ...challenge, sessionId: id }]);
    }
    await db.query('INSERT INTO fishing_session_mechanics VALUES($1,\'NO_FISH\')', [failed]);
    await db.query("UPDATE fishing_sessions SET expires_at=clock_timestamp()-interval '10 seconds' WHERE id IN ($1,$2)", [expired, lateActivation]);
    const submit = id => db.query('SELECT submit_tension_challenge($1) AS response', [{ ...payload, sessionId: id }]).then(r => r.rows[0].response);
    const start = id => db.query('SELECT start_tension_challenge($1) AS response', [id]).then(r => r.rows[0].response);
    await assert.rejects(submit(session), error => /not authenticated/.test(error.message)
      && JSON.parse(error.detail).code === 'FISHING_RESULT_REJECTED');
    await db.query("SELECT set_config('app.uid',$1,false)", [owner]);
    await db.exec('SET ROLE authenticated');
    const [first, retry] = await Promise.all([submit(session), submit(session)]);
    assert.equal(first.success, true);
    assert.deepEqual(retry, first);
    await db.exec('RESET ROLE');
    await db.query("UPDATE fishing_sessions SET expires_at=clock_timestamp()-interval '1 day' WHERE id=$1", [session]);
    await db.exec('SET ROLE authenticated');
    assert.deepEqual(await submit(session), first);
    assert.deepEqual((await start(session)).resolution, first);
    const failure = (await start(failed)).resolution;
    assert.equal(failure.success, false);
    assert.deepEqual((await start(failed)).resolution, failure);
    assert.deepEqual(await submit(failed), failure);
    const expiry = await submit(expired);
    assert.deepEqual(await submit(expired), expiry);
    const late = (await start(lateActivation)).resolution;
    assert.deepEqual((await start(lateActivation)).resolution, late);
    await assert.rejects(db.query('SELECT * FROM fishing_result_receipts'), /permission denied/);
    await assert.rejects(db.query('DELETE FROM fishing_result_receipts'), /permission denied/);
    await db.query("SELECT set_config('app.uid',$1,false)", ['66666666-6666-4666-8666-666666666666']);
    await assert.rejects(submit(session), /unauthorized/);
    await assert.rejects(start(session), /unauthorized/);
    await db.exec('RESET ROLE; SET ROLE anon');
    await assert.rejects(submit(session), /permission denied/);
    await db.exec('RESET ROLE');
    assert.deepEqual((await db.query('SELECT calls FROM rewards')).rows.map(r => r.calls), [1, 1, 1, 1]);
    await db.exec(sql);
    await db.query("SELECT set_config('app.uid',$1,false)", [owner]);
    await db.exec('SET ROLE authenticated');
    assert.deepEqual(await submit(session), first);
  } finally { await db.close(); }
});
