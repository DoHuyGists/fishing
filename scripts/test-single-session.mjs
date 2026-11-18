import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = ts.transpileModule(await readFile(new URL('../src/data/supabaseSessionRepository.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture() {
  const channels = [];
  const removed = [];
  const calls = [];
  const timers = new Set();
  let response = { data: { active_session_id: 'owner' }, error: null };
  const query = {};
  for (const method of ['upsert', 'select', 'eq', 'abortSignal', 'maybeSingle']) {
    query[method] = (...args) => { calls.push([method, ...args]); return query; };
  }
  query.then = (resolve, reject) => Promise.resolve(response).then(resolve, reject);
  const supabase = {
    from(table) { calls.push(['from', table]); return query; },
    channel(name) {
      const channel = { name, on(_type, filter, callback) { this.filter = filter; this.change = callback; return this; },
        subscribe(callback) { this.status = callback; return this; } };
      channels.push(channel); return channel;
    },
    async removeChannel(channel) { removed.push(channel); },
  };
  const imports = { '../database/connection': { __esModule: true, default: supabase }, './repositoryError': { RepositoryError: Error } };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', source)(
    id => imports[id], module, module.exports,
    fn => { timers.add(fn); return fn; }, fn => timers.delete(fn));
  return { repository: module.exports.supabaseSessionRepository, channels, removed, calls, timers,
    respond(value) { response = value; } };
}

test('repository scopes claims and ownership reads to the account and forwards cancellation', async () => {
  const f = fixture();
  const signal = new AbortController().signal;
  await f.repository.claim('account', 'tab', signal);
  assert.deepEqual(f.calls[1].slice(0, 2), ['upsert', {
    user_id: 'account', active_session_id: 'tab', updated_at: f.calls[1][1].updated_at,
  }]);
  assert.deepEqual(f.calls[1][2], { onConflict: 'user_id' });
  assert.equal(f.calls[2][1], signal);
  assert.equal(await f.repository.fetchOwner('account', signal), 'owner');
  assert(f.calls.some(call => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'account'));
  f.respond({ data: null, error: null });
  assert.equal(await f.repository.fetchOwner('account', signal), null);
  f.respond({ data: null, error: { message: 'denied' } });
  await assert.rejects(f.repository.claim('account', 'tab', signal));
  await assert.rejects(f.repository.fetchOwner('account', signal));
});

test('subscription waits for readiness, reports reconnects and ignores callbacks after cleanup', async () => {
  const f = fixture();
  const connections = [];
  let changes = 0;
  const subscription = f.repository.listen('account', () => changes++, state => connections.push(state));
  let ready = false;
  subscription.ready.then(value => { ready = value; });
  await Promise.resolve(); assert.equal(ready, false);
  const channel = f.channels[0];
  assert.equal(channel.filter.filter, 'user_id=eq.account');
  channel.status('SUBSCRIBED'); assert.equal(await subscription.ready, true);
  channel.change(); channel.status('CHANNEL_ERROR'); channel.status('SUBSCRIBED');
  assert.deepEqual(connections, [true, false, true]);
  assert.equal(changes, 1);
  subscription.stop(); subscription.stop();
  channel.change(); channel.status('SUBSCRIBED');
  assert.equal(changes, 1); assert.equal(connections.length, 3);
  assert.equal(f.removed.length, 1); assert.equal(f.timers.size, 0);
});

test('cancellation, subscription errors and timeouts settle registration and permit cleanup', async () => {
  for (const status of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED', 'timeout', 'cancel']) {
    const f = fixture();
    const subscription = f.repository.listen('account', () => {}, () => {});
    if (status === 'cancel') {
      subscription.stop(); assert.equal(await subscription.ready, false);
    } else {
      const rejected = assert.rejects(subscription.ready);
      if (status === 'timeout') for (const timeout of f.timers) timeout();
      else f.channels[0].status(status);
      await rejected; subscription.stop();
    }
    assert.equal(f.removed.length, 1); assert.equal(f.timers.size, 0);
  }
});
