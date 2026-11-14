import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { createPinia, setActivePinia, defineStore } from 'pinia';

const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
const state = label => ({ server_time: new Date().toISOString(),
  npcs: [{ id: 'npc', enabled: true, purchase_shells: 20, operating_cash: 100, data: { stats: { strength: 10 } }, updated_at: '2026-11-14T00:00:00Z' }],
  jobs: [{ id: label, enabled: true, data: { requirements: { strength: 5 } }, updated_at: '2026-11-14T01:00:00Z' }],
  owned: [{ id: 'owned', npc_id: 'npc' }], runs: [],
});

test('dispatch state handles lost responses, stale reads and account switches', async t => {
  const storage = new Map();
  const sessionStorage = {
    getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key),
  };
  const repository = {};
  const auth = { user: null, sessionGeneration: 0, applySession(session) { this.user = session.user; this.sessionGeneration++; } };
  function load(path, dependencies = {}) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports, require: name => {
      if (!(name in dependencies)) throw new Error('Unexpected dependency: ' + name);
      return dependencies[name];
    }, sessionStorage, Date, Error, Promise, JSON, Object, performance }, { filename: path });
    return exports;
  }
  const { RepositoryError } = load('src/data/repositoryError.ts');
  const { dispatchEligible } = load('src/data/dispatch.ts', { '../i18n': {} });
  const { useDispatchStore } = load('src/stores/dispatch.ts', {
    pinia: { defineStore }, '../i18n': { t: key => key }, '../data/dispatch': { dispatchEligible },
    '../data/supabaseDispatchRepository': { supabaseDispatchRepository: repository },
    '../data/repositoryError': { RepositoryError }, '../utils/uuid': { createUuid: randomUUID },
    './auth': { useAuthStore: () => auth }, '../composables/useToast': { useToast: () => ({ success() {} }) },
  });
    function setup() {
      setActivePinia(createPinia()); storage.clear();
      auth.applySession({ user: { id: 'a' } });
      const store = useDispatchStore();
      repository.fetchState = async () => state('job');
      repository.execute = async () => {};
      return { auth, store };
    }
    await t.test('selection works in both directions and eligibility comes from NPC stats', async () => {
      const { store } = setup(); await store.initialize('a');
      store.selectJob('job'); assert.equal(store.tab, 'npcs');
      store.selectNpc('npc'); assert.equal(store.tab, 'jobs'); assert.equal(store.canAssign, true);
      store.snapshot.jobs[0].data.requirements.strength = 11;
      assert.equal(store.canAssign, false);
    });
    await t.test('lost mutation responses survive reopening and reuse the exact request', async () => {
      const { store } = setup(); await store.initialize('a');
      const calls = [];
      repository.execute = async request => { calls.push(structuredClone({ ...request })); throw new RepositoryError({ message: 'network', code: '' }); };
      store.ask('start', 'owned', 'job'); await store.confirm();
      const receipt = store.pending.requestId;
      assert.ok(storage.get('dispatch-pending:a'), 'uncertain request must be persisted before reopening');
      assert.equal(store.locked, true); assert.equal(store.confirmation, null);
      store.ask('buy', 'npc'); assert.equal(store.confirmation, null);
      await store.initialize('a');
      assert.equal(store.pending.requestId, receipt);
      repository.execute = async request => { calls.push({ ...request }); };
      await store.retryPending();
      assert.deepEqual(calls[0], calls[1]);
      assert.equal(calls[0].npcVersion, '2026-11-14T00:00:00Z');
      assert.equal(calls[0].jobVersion, '2026-11-14T01:00:00Z');
      assert.equal(store.pending, null); assert.equal(store.tab, 'runs'); assert.equal(storage.size, 0);
    });
    await t.test('a committed action with a failed refresh cannot be charged again', async () => {
      const { store } = setup(); await store.initialize('a');
      let charges = 0;
      repository.execute = async () => { charges++; };
      repository.fetchState = async () => { throw new Error('network'); };
      store.ask('buy', 'npc'); await store.confirm();
      assert.equal(charges, 1); assert.equal(store.pending, null);
      assert.equal(store.needsRefresh, true); assert.equal(store.locked, true);
      await store.retryPending(); assert.equal(charges, 1);
      repository.fetchState = async () => state('fresh'); await store.refresh();
      assert.equal(store.locked, false);
    });
    await t.test('remounting the same account rejects an older in-flight snapshot', async () => {
      const { store } = setup();
      const old = deferred(); repository.fetchState = () => old.promise;
      const initializing = store.initialize('a');
      repository.fetchState = async () => state('latest'); await store.initialize('a');
      old.resolve(state('old')); await initializing;
      assert.equal(store.jobs[0].id, 'latest'); assert.equal(store.loading, false);
    });
    await t.test('late mutations and history cannot paint another account', async () => {
      const { auth, store } = setup(); await store.initialize('a');
      const action = deferred(), history = deferred();
      repository.execute = () => action.promise;
      repository.fetchHistory = () => history.promise;
      store.ask('buy', 'npc'); const buying = store.confirm();
      const readingHistory = store.fetchHistory();
      auth.applySession({ user: { id: 'b' } });
      await store.initialize('b');
      action.resolve(); history.resolve({ items: [{ id: 'private-a' }], total: 1 });
      await Promise.all([buying, readingHistory]);
      assert.equal(store.ownerId, 'b'); assert.equal(store.tab, 'npcs');
      assert.equal(store.pending, null); assert.equal(store.history.length, 0);
    });
});
