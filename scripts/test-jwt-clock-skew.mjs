import test from 'node:test';
import assert from 'node:assert/strict';
import { createJwtClockSkewFetch } from '../src/database/jwtClockSkewFetch.ts';
import { createMutationRefreshFetch, setMutationRefreshHandler } from '../src/database/mutationRefresh.ts';

const base = 'https://example.supabase.co';
const futureJwt = () => Response.json({ code: 'PGRST303', message: 'JWT issued at future', details: null, hint: null }, { status: 401 });

function fastRetries(t) {
  const delays = [];
  const nativeTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    delays.push(delay);
    return nativeTimeout(callback, 0, ...args);
  });
  return delays;
}

test('restored-tab area lookup recovers using the original URL and authorization', async t => {
  const delays = fastRetries(t);
  const url = `${base}/rest/v1/user_in_area?select=*&user_id=eq.player`;
  const rejected = futureJwt();
  const success = Response.json({ user_id: 'player', status: 'enter' });
  const requests = [];
  const fetcher = createJwtClockSkewFetch(base, async request => {
    requests.push(request);
    return requests.length === 1 ? rejected : success;
  });
  const response = await fetcher(url, { headers: { Authorization: 'Bearer restored-token', apikey: 'public-key', Accept: 'application/vnd.pgrst.object+json' }, credentials: 'include' });
  assert.equal(response, success);
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.url, url);
    assert.equal(request.method, 'GET');
    assert.equal(request.headers.get('Authorization'), 'Bearer restored-token');
    assert.equal(request.headers.get('apikey'), 'public-key');
    assert.equal(request.headers.get('Accept'), 'application/vnd.pgrst.object+json');
    assert.equal(request.credentials, 'include');
  }
  assert.deepEqual(delays, [500]);
  assert.equal(rejected.bodyUsed, false);
  assert.equal((await response.json()).status, 'enter');
});

test('RPC bodies can be replayed after authentication rejection and notify once after success', async t => {
  fastRetries(t);
  let notifications = 0;
  setMutationRefreshHandler(() => () => { notifications++; });
  t.after(() => setMutationRefreshHandler(undefined));
  for (const asRequest of [false, true]) {
    const bodies = [];
    const url = `${base}/rest/v1/rpc/user_enter_area`;
    const body = JSON.stringify({ p_area_id: 'area' });
    const init = { method: 'POST', headers: { Authorization: 'Bearer original-token', 'Content-Type': 'application/json' }, body };
    const success = Response.json({ success: true });
    const fetcher = createMutationRefreshFetch(base, createJwtClockSkewFetch(base, async request => {
      bodies.push(await request.text());
      assert.equal(request.headers.get('Authorization'), 'Bearer original-token');
      return bodies.length === 1 ? futureJwt() : success;
    }));
    const before = notifications;
    const response = await (asRequest ? fetcher(new Request(url, init)) : fetcher(url, init));
    assert.equal(response, success);
    assert.deepEqual(bodies, [body, body]);
    assert.equal(notifications, before + 1);
  }
});

test('persistent clock skew stops after three retries and preserves the final error', async t => {
  const delays = fastRetries(t);
  let calls = 0, last;
  const fetcher = createJwtClockSkewFetch(base, async () => { calls++; last = futureJwt(); return last; });
  const response = await fetcher(`${base}/rest/v1/user_in_area`);
  assert.equal(calls, 4);
  assert.deepEqual(delays, [500, 1000, 2000]);
  assert.equal(response, last);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, 'PGRST303');
});

test('other authentication, business, server and malformed errors are returned without replay', async t => {
  const delays = fastRetries(t);
  for (const original of [
    Response.json({ code: 'PGRST303', message: 'JWT expired' }, { status: 401 }),
    Response.json({ code: 'PGRST301', message: 'JWT issued at future' }, { status: 401 }),
    Response.json({ code: 'PGRST303', message: 'JWT issued at future' }, { status: 403 }),
    Response.json({ code: 'PGRST303', message: 'JWT issued at future' }, { status: 503 }),
    Response.json({ success: false, message: 'JWT issued at future' }),
    new Response('upstream error', { status: 401 }),
    Response.json(null, { status: 401 }),
    new Response(null, { status: 204 }),
  ]) {
    let calls = 0;
    const fetcher = createJwtClockSkewFetch(base, async () => { calls++; return original; });
    const response = await fetcher(`${base}/rest/v1/rpc/purchase_item`, { method: 'POST', body: '{}' });
    assert.equal(response, original);
    assert.equal(response.bodyUsed, false);
    assert.equal(calls, 1);
  }
  assert.deepEqual(delays, []);
});

test('network failures with uncertain mutation outcomes are never replayed', async t => {
  const delays = fastRetries(t);
  const failure = new TypeError('Connection lost after commit');
  let calls = 0;
  const fetcher = createJwtClockSkewFetch(base, async () => { calls++; throw failure; });
  await assert.rejects(fetcher(`${base}/rest/v1/rpc/purchase_item`, { method: 'POST', body: '{}' }), error => error === failure);
  assert.equal(calls, 1);
  assert.deepEqual(delays, []);
});

test('auth refresh, storage and other origins bypass recovery', async t => {
  const delays = fastRetries(t);
  for (const url of [`${base}/auth/v1/token`, `${base}/storage/v1/object/file`, 'https://elsewhere.test/rest/v1/user_in_area']) {
    let calls = 0;
    const rejected = futureJwt();
    const init = { method: 'POST', body: '{}' };
    const fetcher = createJwtClockSkewFetch(base, async (input, options) => {
      calls++;
      assert.equal(input, url);
      assert.equal(options, init);
      return rejected;
    });
    assert.equal(await fetcher(url, init), rejected);
    assert.equal(calls, 1);
  }
  assert.deepEqual(delays, []);
});

test('cancellation during backoff clears the wait and prevents a replay', async t => {
  const controller = new AbortController();
  const failure = new DOMException('Navigation cancelled', 'AbortError');
  let calls = 0;
  const nativeTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const timer = nativeTimeout(callback, delay, ...args);
    queueMicrotask(() => controller.abort(failure));
    return timer;
  });
  const clear = t.mock.method(globalThis, 'clearTimeout');
  const fetcher = createJwtClockSkewFetch(base, async () => { calls++; return futureJwt(); });
  await assert.rejects(fetcher(new Request(`${base}/rest/v1/user_in_area`, { signal: controller.signal })), error => error === failure);
  assert.equal(calls, 1);
  assert.equal(clear.mock.callCount(), 1);
  await assert.rejects(fetcher(`${base}/rest/v1/user_in_area`, { signal: controller.signal }), error => error === failure);
  assert.equal(calls, 1);
});
