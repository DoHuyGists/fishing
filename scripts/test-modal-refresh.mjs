import test from 'node:test';
import assert from 'node:assert/strict';
import { effectScope } from 'vue';
import { createServer } from 'vite';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('modal refresh awaits work, catches failures and cleans up on disposal', async t => {
  const server = await createServer({ configFile: false, envDir: false,
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
  try {
    const { useModalRefresh } = await server.ssrLoadModule('/src/composables/useModalRefresh.ts');
    const fixture = (callback, invalidate = async () => {}) => {
      const scope = effectScope();
      const refresh = scope.run(() => useModalRefresh(() => callback, invalidate, () => 'Refresh failed'));
      return { scope, ...refresh };
    };
    await t.test('work exceeding five seconds stays locked; invalidation precedes the callback', async t => {
      t.mock.timers.enable({ apis: ['setInterval'] });
      const cache = deferred(), work = deferred();
      let calls = 0;
      const f = fixture(() => { calls++; return work.promise; }, () => cache.promise);
      try {
        const request = f.handleRefresh();
        assert.equal(calls, 0);
        await f.handleRefresh(); assert.equal(calls, 0);
        cache.resolve(); await Promise.resolve();
        assert.equal(calls, 1);
        t.mock.timers.tick(6000);
        assert.equal(f.refreshCooldown.value, 0);
        assert.equal(f.isRefreshing.value, true);
        assert.equal(f.refreshDisabled.value, true);
        await f.handleRefresh(); assert.equal(calls, 1);
        work.resolve(); await request;
        assert.equal(f.refreshDisabled.value, false);
      } finally { f.scope.stop(); }
    });
    await t.test('synchronous callbacks retain the cooldown and can retry afterward', async t => {
      t.mock.timers.enable({ apis: ['setInterval'] });
      let calls = 0;
      const f = fixture(() => { calls++; });
      try {
        await f.handleRefresh();
        assert.equal(f.isRefreshing.value, false);
        assert.equal(f.refreshDisabled.value, true);
        await f.handleRefresh(); assert.equal(calls, 1);
        t.mock.timers.tick(5000);
        await f.handleRefresh(); assert.equal(calls, 2);
      } finally { f.scope.stop(); }
    });
    await t.test('cache failures and callback throws/rejections settle without an unhandled rejection', async t => {
      t.mock.timers.enable({ apis: ['setInterval'] });
      let calls = 0;
      const f = fixture(() => { calls++; }, async () => { throw new Error('Cache failed'); });
      const sync = fixture(() => { throw new Error('Sync failed'); });
      const asyncFailure = fixture(async () => { throw null; });
      try {
        await f.handleRefresh();
        assert.equal(calls, 0);
        assert.equal(f.refreshError.value, 'Cache failed');
        assert.equal(f.isRefreshing.value, false);
        await sync.handleRefresh(); assert.equal(sync.refreshError.value, 'Sync failed');
        await asyncFailure.handleRefresh(); assert.equal(asyncFailure.refreshError.value, 'Refresh failed');
      } finally { f.scope.stop(); sync.scope.stop(); asyncFailure.scope.stop(); }
    });
    await t.test('closing during invalidation skips loading; late failures cannot affect another instance', async t => {
      t.mock.timers.enable({ apis: ['setInterval'] });
      const cache = deferred(), work = deferred();
      let calls = 0;
      const f = fixture(() => { calls++; }, () => cache.promise);
      const pending = f.handleRefresh(); f.scope.stop();
      t.mock.timers.tick(6000);
      assert.equal(f.refreshCooldown.value, 5); // Timer was cleared.
      cache.resolve(); await pending; assert.equal(calls, 0);
      const old = fixture(() => work.promise);
      const late = old.handleRefresh(); await Promise.resolve(); old.scope.stop();
      const next = fixture(() => {});
      try {
        work.reject(new Error('Closed instance')); await late;
        assert.equal(old.refreshError.value, '');
        assert.equal(next.refreshError.value, '');
        assert.equal(next.refreshDisabled.value, false);
      } finally { next.scope.stop(); }
    });
  } finally { await server.close(); }
});
