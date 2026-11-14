import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('dispatch transactions enforce ownership, time, snapshots, refunds and idempotency', async () => {
  const db = new PGlite();
  const owner = randomUUID(), other = randomUUID(), npc = randomUUID(), job = randomUUID();
  const rows = async (sql, args) => (await db.query(sql, args)).rows;
  const scalar = async (sql, args) => Object.values((await rows(sql, args))[0])[0];
  const requests = new Map();
  const act = async (kind, target, jobId = null, receipt = randomUUID()) => {
    const input = { kind, target, jobId };
    let versions = [null, null];
    if (['buy','start','repeat'].includes(kind)) {
      const state = await scalar('SELECT public.get_dispatch_state()');
      const run = state.runs.find(r => r.id === target);
      const owned = state.owned.find(o => o.id === (run?.owned_npc_id ?? target));
      versions = [state.npcs.find(n => n.id === (kind === 'buy' ? target : owned?.npc_id))?.updated_at ?? null,
        state.jobs.find(j => j.id === (run?.job_id ?? jobId))?.updated_at ?? null];
    }
    if (JSON.stringify(requests.get(receipt)?.input) === JSON.stringify(input)) versions = requests.get(receipt).versions;
    requests.set(receipt, { input, versions });
    return scalar('SELECT public.dispatch_action($1,$2,$3,$4,$5,$6)', [receipt, kind, target, jobId, ...versions]);
  };
  const wallet = () => rows('SELECT cash,shells,tickets FROM public.currency WHERE user_id=$1', [owner]).then(r => r[0]);
  const finishTime = id => db.query("UPDATE public.dispatch_runs SET started_at=clock_timestamp()-interval '2 minutes',ends_at=clock_timestamp()-interval '1 minute' WHERE id=$1", [id]);
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA feature_control;
      CREATE TABLE auth.users(id UUID PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::UUID $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE public.user_profile(id UUID PRIMARY KEY REFERENCES auth.users(id));
      CREATE TABLE public.currency(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID UNIQUE REFERENCES auth.users(id),cash NUMERIC,shells NUMERIC,tickets NUMERIC);
      CREATE TABLE public.feature_flags(feature_key TEXT PRIMARY KEY,enabled BOOLEAN DEFAULT TRUE);
      CREATE TABLE feature_control.request_rules(feature_key TEXT,path TEXT,writes_only BOOLEAN,PRIMARY KEY(feature_key,path));
      CREATE FUNCTION public.feature_flags_is_admin() RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.admin',true),'false')='true' $$;
      CREATE FUNCTION public.feature_is_enabled(k TEXT) RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT enabled FROM public.feature_flags WHERE feature_key=k $$;
    `);
    await db.exec(await readFile(new URL('./supabase/migrations/20261114_dispatch.sql', import.meta.url), 'utf8'));
    await db.query('INSERT INTO auth.users VALUES($1),($2)', [owner, other]);
    await db.query('INSERT INTO public.user_profile VALUES($1),($2)', [owner, other]);
    await db.query('INSERT INTO public.currency(user_id,cash,shells,tickets) VALUES($1,1000,100,0),($2,1000,100,0)', [owner, other]);
    await db.query(`INSERT INTO public.dispatch_npcs(id,code,name,purchase_shells,operating_cash,data,enabled)
      VALUES($1,'sailor','{"vi":"Thủy thủ","en":"Sailor"}',50,100,'{"stats":{"strength":10}}',true)`, [npc]);
    await db.query(`INSERT INTO public.dispatch_jobs(id,code,name,duration_seconds,data,rewards,enabled)
      VALUES($1,'explore','{"vi":"Khám phá","en":"Explore"}',60,'{"requirements":{"strength":5}}','{"cash":150,"shells":2,"tickets":1}',true)`, [job]);
    await db.query("SELECT set_config('test.uid',$1,false)", [owner]);
    await db.exec('SET ROLE authenticated');

    const receipt = randomUUID();
    const owned = (await act('buy', npc, null, receipt)).id;
    const ownState = () => scalar('SELECT public.get_dispatch_state()');
    assert.equal((await ownState()).owned.length, 1);
    assert.equal((await act('buy', npc, null, receipt)).id, owned);
    await assert.rejects(act('buy', npc), /DISPATCH_OWNED/);
    await assert.rejects(act('cancel', npc, null, receipt), /DISPATCH_INVALID/);
    await assert.rejects(rows('UPDATE public.dispatch_owned_npcs SET purchased_shells=0'), /permission denied/);
    assert.equal((await rows('UPDATE public.dispatch_npcs SET operating_cash=0 RETURNING id')).length, 0);

    const run = (await act('start', owned, job)).id;
    assert.equal((await ownState()).runs.length, 1);
    await assert.rejects(act('start', owned, job), /DISPATCH_NPC_BUSY/);
    await assert.rejects(act('claim', run), /DISPATCH_NOT_READY/);
    await assert.rejects(act('repeat', run), /DISPATCH_NOT_READY/);
    await db.query("SELECT set_config('test.uid',$1,false)", [other]);
    assert.equal((await ownState()).runs.length, 0);
    assert.equal((await rows('SELECT * FROM public.dispatch_runs')).length, 0);
    await assert.rejects(act('claim', run), /DISPATCH_RUN_UNAVAILABLE/);
    await assert.rejects(act('cancel', run), /DISPATCH_RUN_UNAVAILABLE/);
    await assert.rejects(act('start', owned, job), /DISPATCH_NPC_UNAVAILABLE/);
    await db.query("SELECT set_config('test.uid',$1,false)", [owner]);

    await db.exec('RESET ROLE');
    assert.deepEqual(await wallet(), { cash: '900', shells: '50', tickets: '0' });
    await finishTime(run);
    await db.query('UPDATE public.dispatch_jobs SET rewards=$2,duration_seconds=120 WHERE id=$1', [job, { cash: 9999 }]);
    await db.exec('SET ROLE authenticated');
    const repeatReceipt = randomUUID();
    const next = (await act('repeat', run, null, repeatReceipt)).id;
    assert.ok(next);
    assert.equal((await act('repeat', run, null, repeatReceipt)).id, next);
    assert.equal((await ownState()).runs.length, 1);
    assert.equal((await ownState()).runs[0].rewards.cash, 9999);
    assert.equal((await rows('SELECT * FROM public.dispatch_history')).length, 1);
    assert.equal((await rows('SELECT * FROM public.dispatch_history'))[0].rewards.cash, 150);
    await assert.rejects(act('claim', run), /DISPATCH_RUN_UNAVAILABLE/);
    await db.exec('RESET ROLE');
    assert.deepEqual(await wallet(), { cash: '950', shells: '52', tickets: '1' });

    // A failed repeat must roll back its claim, history and wallet delta together.
    await finishTime(next);
    await db.query('UPDATE public.currency SET cash=0 WHERE user_id=$1', [owner]);
    await db.query('UPDATE public.dispatch_npcs SET operating_cash=20000 WHERE id=$1', [npc]);
    await db.exec('SET ROLE authenticated');
    await assert.rejects(act('repeat', next), /DISPATCH_CASH/);
    assert.equal((await ownState()).runs[0].id, next);
    assert.equal((await rows('SELECT * FROM public.dispatch_history')).length, 1);
    await db.exec('RESET ROLE');
    assert.equal((await wallet()).cash, '0');
    await db.query('UPDATE public.dispatch_jobs SET enabled=false WHERE id=$1', [job]);
    await db.query('UPDATE public.dispatch_npcs SET enabled=false WHERE id=$1', [npc]);
    await db.exec('SET ROLE authenticated');
    await act('claim', next); // Existing runs remain claimable after catalog deactivation.
    assert.equal((await ownState()).runs.length, 0);
    await db.exec('RESET ROLE');
    assert.equal((await wallet()).cash, '9999');

    await db.query('UPDATE public.dispatch_npcs SET enabled=true,operating_cash=100 WHERE id=$1', [npc]);
    await db.query('UPDATE public.dispatch_jobs SET enabled=true WHERE id=$1', [job]);
    await db.exec('SET ROLE authenticated');
    const cancelled = (await act('start', owned, job)).id;
    const cancelReceipt = randomUUID();
    await act('cancel', cancelled, null, cancelReceipt);
    await act('cancel', cancelled, null, cancelReceipt);
    assert.equal((await ownState()).runs.length, 0);
    await assert.rejects(act('claim', cancelled), /DISPATCH_RUN_UNAVAILABLE/);
    const history = await rows('SELECT * FROM public.dispatch_history ORDER BY resolved_at');
    assert.equal(history.length, 3);
    assert.equal(history[2].outcome, 'cancelled');
    assert.deepEqual(history[2].rewards, {});
    await db.exec('RESET ROLE');
    assert.equal((await wallet()).cash, '9899', 'cancel does not refund or pay rewards');

    const oldVersion = (await scalar('SELECT public.get_dispatch_state()')).npcs[0].updated_at;
    await db.query('UPDATE public.dispatch_npcs SET operating_cash=101 WHERE id=$1', [npc]);
    const jobVersion = (await scalar('SELECT public.get_dispatch_state()')).jobs[0].updated_at;
    await db.exec('SET ROLE authenticated');
    await assert.rejects(scalar('SELECT public.dispatch_action($1,$2,$3,$4,$5,$6)',
      [randomUUID(), 'start', owned, job, oldVersion, jobVersion]), /DISPATCH_CATALOG_CHANGED/);
    await db.exec('RESET ROLE');
    assert.equal((await wallet()).cash, '9899', 'a stale quote cannot charge a higher price');

    await db.query(`UPDATE public.dispatch_jobs SET data='{"requirements":{"strength":20}}' WHERE id=$1`, [job]);
    await db.exec('SET ROLE authenticated');
    await assert.rejects(act('start', owned, job), /DISPATCH_REQUIREMENTS/);
    await db.exec('RESET ROLE');
    await assert.rejects(db.query(`UPDATE public.dispatch_jobs SET rewards='{"cash":-1}' WHERE id=$1`, [job]), /check constraint/);
    await assert.rejects(db.query(`UPDATE public.dispatch_jobs SET rewards='{"items":1}' WHERE id=$1`, [job]), /check constraint/);
    await assert.rejects(db.query(`UPDATE public.dispatch_npcs SET data='{"stats":{"strength":"999"}}' WHERE id=$1`, [npc]), /check constraint/);
    await db.query('UPDATE public.currency SET shells=0 WHERE user_id=$1', [other]);
    await db.query("SELECT set_config('test.uid',$1,false)", [other]);
    await db.exec('SET ROLE authenticated');
    await assert.rejects(act('buy', npc), /DISPATCH_SHELLS/);
    await db.exec('RESET ROLE');
    await db.query('UPDATE public.feature_flags SET enabled=false');
    await db.exec('SET ROLE authenticated');
    await assert.rejects(ownState(), /DISPATCH_DISABLED/);
    await db.exec("RESET ROLE; SET ROLE anon;");
    await assert.rejects(act('buy', npc), /permission denied/);
    await assert.rejects(rows('SELECT * FROM public.dispatch_history'), /permission denied/);
  } finally { await db.close(); }
});
