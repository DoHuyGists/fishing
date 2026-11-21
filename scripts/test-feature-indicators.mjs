import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as vue from 'vue';
import { createPinia, setActivePinia, defineStore } from 'pinia';
import { PGlite } from '@electric-sql/pglite';
import { createKeyedRefreshTask } from '../src/utils/refreshTask.ts';
import { startVisibleRefresh } from '../src/utils/visibleRefresh.ts';
import { createMutationRefreshFetch, setFeatureIndicatorRefreshHandler } from '../src/database/mutationRefresh.ts';

const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
const snapshot = (rewardCount, nextChangeAt = null) => ({
  serverTime: '2026-11-21T00:00:00Z',
  indicators: { attendance: { rewardCount, attentionCount: 0, nextChangeAt } },
});

function browserHarness() {
  const names = ['document', 'window', 'navigator', 'setTimeout', 'clearTimeout'];
  const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const originalNow = Date.now, originalRandom = Math.random;
  let now = 100_000, timerId = 0;
  const timers = new Map();
  const browser = {
    document: Object.assign(new EventTarget(), { visibilityState: 'visible' }),
    window: new EventTarget(), navigator: { onLine: true },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    performance: { now: () => now },
    async advance(ms) {
      now += ms;
      const due = [...timers].filter(([, timer]) => timer.at <= now);
      for (const [id, timer] of due) { timers.delete(id); timer.callback(); }
      await flush();
    },
    restore() {
      for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
      Date.now = originalNow; Math.random = originalRandom;
    },
    timers,
  };
  for (const name of names) Object.defineProperty(globalThis, name, { value: browser[name], configurable: true, writable: true });
  Date.now = () => now;
  Math.random = () => 0;
  return browser;
}

test('indicators reconcile mutations, protect sessions and resume time-based rewards', async t => {
  const browser = browserHarness();
  const auth = vue.reactive({ user: { id: 'a' }, sessionGeneration: 1 });
  const features = vue.reactive({ disabled: [], canOpen(key) { return !this.disabled.includes(key); } });
  const notifications = vue.reactive({ ownerId: 'a', unreadCount: 2 });
  const team = vue.reactive({ ownerId: 'a', inviteTotal: 3 });
  const repository = {};
  const dependencies = {
    vue, pinia: { defineStore }, './auth': { useAuthStore: () => auth },
    './player-feature-availability-store': { useFeatureAvailabilityStore: () => features },
    './player-notification-store': { useNotificationStore: () => notifications },
    './player-team-store': { useTeamStore: () => team },
    '../data/supabaseFeatureIndicatorRepository': { supabaseFeatureIndicatorRepository: repository },
    '../utils/refreshTask': { createKeyedRefreshTask }, '../utils/visibleRefresh': { startVisibleRefresh },
    '../types/model/featureIndicator': { indicatorFeatures: ['attendance', 'mission', 'badge', 'dispatch', 'friend'] },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/stores/player-feature-indicator-store.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, require: name => { assert.ok(name in dependencies, name); return dependencies[name]; },
    ...browser, Date, Error, Promise,
  });
  setActivePinia(createPinia());
  const store = exports.useFeatureIndicatorStore();
  try {
    await t.test('unloaded data stays quiet; concurrent mutations coalesce into one fresh read', async () => {
      const initial = deferred(), fresh = deferred();
      let calls = 0;
      repository.fetchSummary = () => ++calls === 1 ? initial.promise : fresh.promise;
      assert.equal(store.hasAttention('attendance'), false);
      store.start();
      await flush();
      for (let i = 0; i < 20; i++) store.requestRefresh();
      await browser.advance(150);
      assert.equal(calls, 1);
      initial.resolve(snapshot(0));
      await flush();
      assert.equal(calls, 2);
      fresh.resolve(snapshot(1));
      await flush();
      assert.equal(store.hasAttention('attendance'), true);
      assert.equal(store.hasAttention('notifications'), true);
      assert.equal(store.hasAttention('team'), true);
    });

    await t.test('errors retain a good snapshot; disabled features never display a dot', async () => {
      repository.fetchSummary = async () => { throw Error('offline'); };
      await store.refresh(true);
      assert.equal(store.hasAttention('attendance'), true);
      assert.equal(store.error, 'offline');
      features.disabled = ['attendance'];
      assert.equal(store.hasAttention('attendance'), false);
      features.disabled = [];
    });

    await t.test('a reward deadline crossed in a hidden tab is refreshed on return', async () => {
      let calls = 0;
      repository.fetchSummary = async () => {
        calls++;
        return calls === 1 ? snapshot(0, '2026-11-21T00:00:05Z') : snapshot(1);
      };
      await store.refresh(true);
      browser.document.visibilityState = 'hidden';
      browser.document.dispatchEvent(new Event('visibilitychange'));
      await browser.advance(5_200);
      await browser.advance(150);
      assert.equal(calls, 1);
      browser.document.visibilityState = 'visible';
      browser.document.dispatchEvent(new Event('visibilitychange'));
      browser.window.dispatchEvent(new Event('focus'));
      await browser.advance(150);
      assert.equal(calls, 2);
      assert.equal(store.hasAttention('attendance'), true);
    });

    await t.test('cleanup cancels timers and late responses cannot populate another account', async () => {
      const late = deferred();
      repository.fetchSummary = () => late.promise;
      const read = store.refresh(true);
      await flush();
      store.resetSession();
      auth.user = { id: 'b' }; auth.sessionGeneration++;
      late.resolve(snapshot(99));
      await read;
      assert.equal(store.hasAttention('attendance'), false);
      assert.equal(store.ownerId, '');
      assert.equal(Object.keys(store.indicators).length, 0);
      assert.equal(browser.timers.size, 0);
      assert.equal(store.loading, false);
    });
  } finally { store.resetSession(); browser.restore(); }
});

test('attendance keeps claim results when an older read returns and discards another session', async () => {
  const auth = vue.reactive({ user: { id: 'a' }, sessionGeneration: 1 });
  const repository = {};
  let currencyRefreshes = 0;
  const dependencies = {
    pinia: { defineStore }, '../i18n': { t: key => key },
    '../data/supabaseDailyRewardRepository': { supabaseDailyRewardRepository: {} },
    '../data/supabaseCurrencyRepository': { supabaseCurrencyRepository: repository },
    './auth': { useAuthStore: () => auth },
    './player-currency-store': { useCurrencyStore: () => ({ fetchCurrency: async () => { currencyRefreshes++; } }) },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/stores/player-attendance-store.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, require: name => { assert.ok(name in dependencies, name); return dependencies[name]; }, Date, Error,
  });
  setActivePinia(createPinia());
  const store = exports.useAttendanceStore();
  const stale = deferred();
  repository.getNextDailyRewardAt = () => stale.promise;
  const loading = store.fetchStatus();
  repository.claimDailyReward = async () => ({ success: true,
    next_claim_daily_reward_at: '2026-11-22T00:00:00Z', item: { name: 'Reward', icon: 'R', quantity: 2 } });
  assert.equal(await store.claimDailyReward(), true);
  stale.resolve(null);
  await loading;
  assert.equal(store.nextClaimAt, '2026-11-22T00:00:00Z');
  assert.equal(store.dailyReward.reward.amount, 2);
  assert.equal(currencyRefreshes, 1);
  const late = deferred();
  repository.claimDailyReward = () => late.promise;
  const claim = store.claimDailyReward();
  assert.equal(await store.claimDailyReward(), false);
  store.$reset();
  auth.user = { id: 'b' }; auth.sessionGeneration++;
  late.resolve({ success: true, item: { name: 'Old account reward' } });
  assert.equal(await claim, false);
  assert.equal(store.nextClaimAt, null);
  assert.equal(store.dailyReward, null);
  assert.equal(store.isClaimingDailyReward, false);
  assert.equal(currencyRefreshes, 1);
});

test('only successful relevant mutations request indicator reconciliation, including wrapped actions', async () => {
  let generation = 1, calls = 0;
  setFeatureIndicatorRefreshHandler(() => {
    const captured = generation;
    return () => { if (captured === generation) calls++; };
  });
  let response = Response.json({ success: true });
  const fetcher = createMutationRefreshFetch('https://example.supabase.co', async () => response.clone());
  const base = 'https://example.supabase.co/rest/v1/rpc/';
  try {
    await fetcher(base + 'claim_daily_mission_reward', { method: 'POST' });
    await fetcher(base + 'respond_friend_request', { method: 'POST' });
    await fetcher(base + 'execute_game_catalog_action', { method: 'POST', body: JSON.stringify({ p_action: 'cast_rod' }) });
    assert.equal(calls, 3);
    await fetcher(base + 'get_my_feature_indicators', { method: 'POST' });
    await fetcher(base + 'execute_game_catalog_action', { method: 'POST', body: JSON.stringify({ p_action: 'purchase_item' }) });
    response = Response.json({ success: false });
    await fetcher(base + 'claim_daily_reward', { method: 'POST' });
    response = Response.json({}, { status: 403 });
    await fetcher(base + 'claim_daily_reward', { method: 'POST' });
    assert.equal(calls, 3);
    const late = deferred();
    const slowFetch = createMutationRefreshFetch('https://example.supabase.co', () => late.promise);
    const request = slowFetch(base + 'claim_badge_reward', { method: 'POST' });
    generation++;
    late.resolve(Response.json({ success: true }));
    await request;
    assert.equal(calls, 3);
  } finally { setFeatureIndicatorRefreshHandler(undefined); }
});

test('SQL summary respects ownership, claimability, future deadlines and feature switches', async () => {
  const db = new PGlite();
  const owner = '00000000-0000-0000-0000-000000000001';
  const other = '00000000-0000-0000-0000-000000000002';
  const read = async (keys = ['attendance', 'mission', 'badge', 'dispatch', 'friend']) =>
    (await db.query('SELECT public.get_my_feature_indicators($1::text[]) AS result', [keys])).rows[0].result;
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('test.uid', true), '')::uuid
      $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE public.feature_flags(feature_key text PRIMARY KEY, enabled boolean);
      INSERT INTO public.feature_flags VALUES ('attendance',true),('mission',true),('badge',true),('dispatch',true),('friend',true);
      CREATE FUNCTION public.feature_is_enabled(k text) RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT enabled FROM public.feature_flags WHERE feature_key=k
      $$;
      CREATE TABLE public.user_flag(user_id uuid, next_claim_daily_reward_at timestamptz);
      CREATE TABLE public.dispatch_runs(user_id uuid, status text, ends_at timestamptz);
      CREATE TABLE public.user_friends(user_id uuid, friend_id uuid, status text);
      CREATE TABLE public.reward_fixture(user_id uuid, kind text, data jsonb);
      CREATE FUNCTION public.get_daily_missions() RETURNS jsonb LANGUAGE sql AS $$
        SELECT jsonb_build_object('rewards',coalesce(jsonb_agg(data),'[]'::jsonb))
        FROM public.reward_fixture WHERE user_id=auth.uid() AND kind='mission'
      $$;
      CREATE FUNCTION public.get_user_badges_status() RETURNS jsonb LANGUAGE sql AS $$
        SELECT coalesce(jsonb_agg(data),'[]'::jsonb) FROM public.reward_fixture WHERE user_id=auth.uid() AND kind='badge'
      $$;
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
      INSERT INTO public.user_flag VALUES ('${owner}', now()+interval '1 hour');
      INSERT INTO public.dispatch_runs VALUES
        ('${owner}','running',now()-interval '1 minute'),
        ('${owner}','claimed',now()-interval '1 minute'),
        ('${owner}','running',now()+interval '5 minutes'),
        ('${other}','running',now()-interval '1 minute');
      INSERT INTO public.user_friends VALUES
        ('${other}','${owner}','PENDING'),('${owner}','${other}','PENDING'),('${other}','${owner}','ACCEPTED');
      INSERT INTO public.reward_fixture VALUES
        ('${owner}','mission','{"can_claim":true}'),('${owner}','mission','{"can_claim":false}'),
        ('${owner}','badge','{"can_claim":true}'),('${other}','badge','{"can_claim":true}');
      SELECT set_config('test.uid','${owner}',false);
    `);
    await db.exec(readFileSync('scripts/supabase/migrations/20261121_feature_indicators.sql', 'utf8'));
    await db.exec('SET ROLE authenticated');
    const result = await read();
    assert.equal(result.indicators.attendance.rewardCount, 0);
    assert.ok(Date.parse(result.indicators.attendance.nextChangeAt) > Date.parse(result.serverTime));
    assert.equal(result.indicators.mission.rewardCount, 1);
    assert.equal(result.indicators.badge.rewardCount, 1);
    assert.equal(result.indicators.dispatch.rewardCount, 1);
    assert.ok(Date.parse(result.indicators.dispatch.nextChangeAt) > Date.parse(result.serverTime));
    assert.equal(result.indicators.friend.attentionCount, 1);
    assert.deepEqual(Object.keys((await read(['badge'])).indicators), ['badge']);
    await db.exec("RESET ROLE; UPDATE public.feature_flags SET enabled=false WHERE feature_key='badge'; SET ROLE authenticated");
    assert.equal((await read()).indicators.badge, undefined);
    await db.exec(`SELECT set_config('test.uid','${other}',false)`);
    assert.equal((await read()).indicators.mission.rewardCount, 0);
    assert.equal((await read()).indicators.attendance.rewardCount, 1);
    await db.exec("SELECT set_config('test.uid','',false)");
    await assert.rejects(read(), /Authentication required/);
    await db.exec('SET ROLE anon');
    await assert.rejects(read(), /permission denied/);
  } finally { await db.close(); }
});
