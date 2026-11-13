import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { resolve, promise }; };
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function memoryStorage() {
  const entries = new Map(), generations = new Map(); let reads = 0;
  const token = (scope, domain) => ({ generation: generations.get(scope + domain) ?? '', scopeGeneration: generations.get(scope) ?? '' });
  return {
    entries, get reads() { return reads; },
    async read(scope, domain, key) { reads++; return { entry: structuredClone(entries.get(key)), token: token(scope, domain) }; },
    async write(entry) { if (JSON.stringify(token(entry.scope, entry.domain)) !== JSON.stringify({ generation: entry.generation, scopeGeneration: entry.scopeGeneration })) return false; entries.set(entry.key, structuredClone(entry)); return true; },
    async invalidate(scope, domains) {
      for (const domain of domains ?? ['']) generations.set(scope + domain, String(Number(generations.get(scope + domain) ?? 0) + 1));
      for (const [key, entry] of entries) if (entry.scope === scope && (!domains || domains.includes(entry.domain))) entries.delete(key);
    },
  };
}

test('game cache freshness, concurrency, recovery and invalidation', async t => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
  try {
    const { createGameCache, CacheContextChangedError } = await server.ssrLoadModule('/src/utils/gameCache.ts');
    const { RepositoryError } = await server.ssrLoadModule('/src/data/repositoryError.ts');
    let clock = 1000;
    const base = { scope: 'project:user:a', domain: 'species', policy: { ttl: 100, maxAge: 1000 }, validate: data => Array.isArray(data) && data.every(x => typeof x === 'string') };
    const make = (storage, options = {}) => createGameCache(storage, { now: () => clock, random: () => 0, timeoutMs: 20, ...options });

    await t.test('ten callers share hydration/network; RAM hits never touch disk; reload preserves original expiry', async () => {
      clock = 1000; const storage = memoryStorage(); const cache = make(storage), read = deferred(); let calls = 0;
      const options = { ...base, load: async () => { calls++; return read.promise; } };
      const pending = Array.from({ length: 10 }, () => cache.read(options));
      await flush(); assert.equal(calls, 1); assert.equal(storage.reads, 1);
      read.resolve({ data: [], revision: '1' });
      const values = await Promise.all(pending); assert.equal(values.length, 10); assert.deepEqual(values[0].data, []);
      const diskReads = storage.reads; clock = 1050;
      await cache.read(options); assert.equal(storage.reads, diskReads); assert.equal(calls, 1);
      const reloaded = make(storage); await reloaded.read(options); assert.equal(calls, 1);
      assert.equal([...storage.entries.values()][0].expiresAt, 1100);
      clock = 1100; await reloaded.read(options); assert.equal(calls, 2);
    });
    await t.test('hung network returns bounded stale, persists cooldown, and retries after cooldown', async () => {
      clock = 1000; const storage = memoryStorage(); const cache = make(storage); let calls = 0;
      await cache.read({ ...base, load: async () => ({ data: ['old'] }) });
      clock = 1101;
      const broken = { ...base, load: async () => { calls++; return new Promise(() => {}); } };
      assert.equal((await cache.read(broken)).state, 'stale');
      const fetchedAt = [...storage.entries.values()][0].fetchedAt;
      await make(storage).read(broken); assert.equal(calls, 1); assert.equal(fetchedAt, 1000);
      clock = 2101;
      await assert.rejects(make(storage).read(broken)); assert.equal(calls, 1);
      clock = 16_102;
      assert.deepEqual((await cache.read({ ...base, load: async () => ({ data: ['new'] }) })).data, ['new']);
    });
    await t.test('cold failures preserve cooldown even without payload; pending clears after failure', async () => {
      clock = 1000; const storage = memoryStorage(); let calls = 0;
      const options = { ...base, load: async () => { calls++; throw new RepositoryError({ message: 'upstream down', status: 503 }); } };
      await assert.rejects(make(storage).read(options));
      await assert.rejects(make(storage).read(options)); assert.equal(calls, 1);
      clock = 16_001; await assert.rejects(make(storage).read(options)); assert.equal(calls, 2);
    });
    await t.test('rate-limit retry-after overrides the default backoff across reloads', async () => {
      clock = 1000; const storage = memoryStorage(); let calls = 0;
      const options = { ...base, load: async () => { calls++; throw new RepositoryError({ message: 'rate limited', status: 429, details: JSON.stringify({ retryAfterMs: 60_000 }) }); } };
      await assert.rejects(make(storage).read(options));
      clock = 30_000; await assert.rejects(make(storage).read(options)); assert.equal(calls, 1);
      clock = 61_001; await assert.rejects(make(storage).read(options)); assert.equal(calls, 2);
    });
    await t.test('permission and schema errors never fall back; version invalidation disables stale', async () => {
      clock = 1000; const storage = memoryStorage(); const cache = make(storage);
      await cache.read({ ...base, load: async () => ({ data: ['old'], revision: '1' }) }); clock = 1101;
      await assert.rejects(cache.read({ ...base, load: async () => { throw new RepositoryError({ message: 'denied', code: '42501', status: 403 }); } }));
      assert.equal(storage.entries.size, 0);
      await cache.read({ ...base, load: async () => ({ data: ['new'], revision: '2' }) }); clock = 1202;
      await cache.invalidate(base.scope, ['species']);
      await assert.rejects(cache.read({ ...base, load: async () => { throw new TypeError('Failed to fetch'); } }));
      clock = 50_000;
      await assert.rejects(cache.read({ ...base, load: async () => ({ data: [1] }) }));
    });
    await t.test('invalidation during a read discards the old result and coalesces one trailing read', async () => {
      clock = 1000; const storage = memoryStorage(); const cache = make(storage), old = deferred(); let calls = 0;
      const options = { ...base, load: async () => ++calls === 1 ? old.promise : { data: ['current'], revision: '2' } };
      const first = cache.read(options); await flush(); await cache.invalidate(base.scope, ['species']);
      const others = Array.from({ length: 9 }, () => cache.read(options));
      old.resolve({ data: ['obsolete'], revision: '1' });
      const values = await Promise.all([first, ...others]);
      assert.equal(calls, 2); assert.ok(values.every(value => value.data[0] === 'current'));
      assert.equal([...storage.entries.values()][0].data[0], 'current');
    });
    await t.test('keys isolate owners/parameters; old login responses never persist', async () => {
      clock = 1000; const storage = memoryStorage(); const cache = make(storage), old = deferred(); let active = true;
      const pending = cache.read({ ...base, current: () => active, load: () => old.promise }); await flush(); active = false;
      await cache.read({ ...base, scope: 'project:user:b', parameter: 'page2', load: async () => ({ data: ['b'] }) });
      old.resolve({ data: ['a'] }); await assert.rejects(pending, CacheContextChangedError);
      assert.equal(storage.entries.size, 1); assert.equal([...storage.entries.values()][0].scope, 'project:user:b');
    });
    await t.test('another tab invalidating during network prevents a stale IndexedDB write', async () => {
      clock = 1000; const storage = memoryStorage(), old = deferred(); let calls = 0;
      const cache = make(storage), other = make(storage);
      const pending = cache.read({ ...base, load: async () => ++calls === 1 ? old.promise : { data: ['current'] } }); await flush();
      await other.invalidate(base.scope, ['species']); old.resolve({ data: ['old'] });
      assert.deepEqual((await pending).data, ['current']); assert.equal(calls, 2);
    });
    await t.test('known revision rejects an otherwise fresh persisted entry before displaying it', async () => {
      clock = 1000; const storage = memoryStorage();
      await make(storage).read({ ...base, load: async () => ({ data: ['old'], revision: '1' }) });
      const shown = [];
      const value = await make(storage, { onResult: (_, result) => shown.push(result.data[0]) }).read({ ...base, expectedRevision: '2', load: async () => ({ data: ['new'], revision: '2' }) });
      assert.equal(value.revision, '2'); assert.deepEqual(shown, ['new']);
    });
    await t.test('failed storage invalidation cannot resurrect a rejected snapshot in the current runtime', async () => {
      clock = 1000; const storage = memoryStorage(); const cache = make(storage);
      await cache.read({ ...base, load: async () => ({ data: ['old'], revision: '1' }) });
      storage.invalidate = async () => {}; // storage temporarily rejects writes
      await cache.invalidate(base.scope, ['species']);
      await assert.rejects(cache.read({ ...base, load: async () => { throw new TypeError('Network unavailable'); } }));
    });
    await t.test('storage becoming unavailable after a read never retries a successful network request', async () => {
      clock = 1000; const storage = memoryStorage(); const cache = make(storage); let calls = 0;
      const value = await cache.read({ ...base, load: async () => {
        calls++; storage.read = async () => ({ available: false, token: { generation: '', scopeGeneration: '' } });
        storage.write = async () => false;
        return { data: ['network success'] };
      } });
      assert.equal(value.data[0], 'network success'); assert.equal(calls, 1);
    });
  } finally { await server.close(); }
});
