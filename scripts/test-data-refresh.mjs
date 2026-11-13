import test from 'node:test';
import assert from 'node:assert/strict';
import { createRefreshTask, createKeyedRefreshTask } from '../src/utils/refreshTask.ts';
import { startVisibleRefresh } from '../src/utils/visibleRefresh.ts';
import { createMutationRefreshFetch, setMutationRefreshHandler } from '../src/database/mutationRefresh.ts';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test('concurrent reads share a request; mutation bursts reconcile once afterwards', async () => {
  const run = createRefreshTask();
  const first = deferred();
  const trailing = deferred();
  let calls = 0;
  const a = run(() => { calls++; return first.promise; });
  const b = run(() => { throw Error('duplicate read'); });
  await flush();
  for (let i = 0; i < 20; i++) run(() => { calls++; return trailing.promise; }, true);
  assert.equal(calls, 1);
  first.resolve('old');
  await flush();
  assert.equal(calls, 2);
  trailing.resolve('fresh');
  assert.deepEqual(await Promise.all([a, b]), ['fresh', 'fresh']);
  assert.equal(await run(async () => 'next'), 'next');
});

test('a failed read still runs a queued reconciliation; retries recover', async () => {
  const run = createRefreshTask();
  const first = deferred();
  const a = run(() => first.promise);
  await flush();
  const b = run(async () => 'recovered', true);
  first.reject(Error('offline'));
  assert.deepEqual(await Promise.all([a, b]), ['recovered', 'recovered']);
  await assert.rejects(run(() => { throw Error('synchronous failure'); }), /synchronous failure/);
  assert.equal(await run(async () => 42), 42);
});

test('read coalescing isolates owners, sessions and pages', async () => {
  const run = createKeyedRefreshTask();
  const old = deferred();
  const a = run('user-a:1:page1', () => old.promise);
  const b = run('user-b:2:page1', async () => 'b');
  const c = run('user-a:3:page1', async () => 'new login');
  assert.equal(await b, 'b');
  assert.equal(await c, 'new login');
  old.resolve('old');
  assert.equal(await a, 'old');
  assert.equal(await run('user-a:1:page1', async () => 'new read'), 'new read');
});

test('mutation refresh preserves responses and excludes reads, denials and business failures', async () => {
  let notifications = 0;
  const captures = [];
  let response;
  setMutationRefreshHandler(keys => { captures.push(keys); return () => { notifications++; }; });
  const transport = async () => response;
  const fetcher = createMutationRefreshFetch('https://example.supabase.co', transport);
  const url = 'https://example.supabase.co/rest/v1/rpc/claim_daily_reward';
  response = Response.json({ success: true, reward: 'fish' });
  const result = await fetcher(url, { method: 'POST' });
  assert.equal(result, response);
  assert.deepEqual(await result.json(), { success: true, reward: 'fish' });
  assert.equal(notifications, 1);
  assert.deepEqual(captures[0], ['currency', 'profile', 'countries']);
  for (const [input, method, value] of [
    [url, 'GET', Response.json({ success: true })],
    [url, 'POST', Response.json({ success: false })],
    [url, 'POST', Response.json({ message: 'maintenance' }, { status: 403 })],
    [url.replace('example.supabase.co', 'elsewhere.test'), 'POST', Response.json({ success: true })],
    [url.replace('claim_daily_reward', 'get_my_currency'), 'POST', Response.json({ cash: 5 })],
  ]) { response = value; await fetcher(input, { method }); }
  assert.equal(notifications, 1);
  response = new Response(null, { status: 204 });
  await fetcher(new Request(url, { method: 'POST' }));
  assert.equal(notifications, 2);
  setMutationRefreshHandler(undefined);
});

test('a late mutation cannot refresh a different login', async () => {
  let generation = 1;
  let notifications = 0;
  setMutationRefreshHandler(() => {
    const captured = generation;
    return () => { if (captured === generation) notifications++; };
  });
  const pending = deferred();
  const fetcher = createMutationRefreshFetch('https://example.supabase.co', () => pending.promise);
  const request = fetcher('https://example.supabase.co/rest/v1/rpc/submit_tension_challenge', { method: 'POST' });
  generation++;
  pending.resolve(Response.json({ success: true }));
  await request;
  assert.equal(notifications, 0);
  setMutationRefreshHandler(undefined);
});

function browserHarness() {
  const names = ['document', 'window', 'navigator', 'setTimeout', 'clearTimeout'];
  const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const originalNow = Date.now, originalRandom = Math.random;
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const window = new EventTarget();
  const navigator = { onLine: true };
  let now = 100_000, id = 0;
  const timers = new Map();
  const replacements = {
    document, window, navigator,
    setTimeout: (callback, delay) => { const key = ++id; timers.set(key, { callback, at: now + delay }); return key; },
    clearTimeout: key => timers.delete(key),
  };
  for (const name of names) Object.defineProperty(globalThis, name, { value: replacements[name], configurable: true, writable: true });
  Date.now = () => now;
  Math.random = () => 0;
  return {
    document, window, navigator, timers,
    async advance(ms) {
      now += ms;
      const due = [...timers.entries()].filter(([, value]) => value.at <= now);
      for (const [key, value] of due) { timers.delete(key); value.callback(); }
      await flush();
    },
    restore() {
      for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
      Date.now = originalNow; Math.random = originalRandom;
    },
  };
}

test('polling pauses hidden/offline, coalesces focus events and cleans up in flight', async () => {
  const browser = browserHarness();
  try {
    let calls = 0;
    browser.document.visibilityState = 'hidden';
    const stop = startVisibleRefresh(async () => { calls++; }, 1_000);
    await browser.advance(10_000);
    assert.equal(calls, 0);
    browser.document.visibilityState = 'visible';
    browser.document.dispatchEvent(new Event('visibilitychange'));
    browser.window.dispatchEvent(new Event('focus'));
    browser.window.dispatchEvent(new Event('online'));
    await flush();
    assert.equal(calls, 1);
    assert.equal(browser.timers.size, 1);
    browser.navigator.onLine = false;
    browser.window.dispatchEvent(new Event('offline'));
    await browser.advance(5_000);
    assert.equal(calls, 1);
    browser.navigator.onLine = true;
    browser.window.dispatchEvent(new Event('online'));
    await flush();
    assert.equal(calls, 2);
    stop();
    await browser.advance(60_000);
    assert.equal(calls, 2);
    assert.equal(browser.timers.size, 0);

    const pending = deferred();
    const stopPending = startVisibleRefresh(() => pending.promise, 1_000);
    stopPending(); pending.resolve(); await flush();
    assert.equal(browser.timers.size, 0);
  } finally { browser.restore(); }
});

test('polling never overlaps a slow request and backs off after failures', async () => {
  const browser = browserHarness();
  try {
    let calls = 0;
    const pending = deferred();
    const stop = startVisibleRefresh(async () => {
      calls++;
      if (calls === 1) await pending.promise;
      else if (calls === 2) throw Error('network failure');
    }, 1_000);
    await browser.advance(10_000);
    browser.window.dispatchEvent(new Event('focus'));
    assert.equal(calls, 1);
    pending.resolve(); await flush();
    await browser.advance(1_000);
    assert.equal(calls, 2);
    await browser.advance(1_000);
    assert.equal(calls, 2);
    await browser.advance(1_000);
    assert.equal(calls, 3);
    stop();
  } finally { browser.restore(); }
});
