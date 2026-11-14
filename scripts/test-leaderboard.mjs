import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { createPinia, defineStore, setActivePinia } from 'pinia';

const repository = {};
const dependencies = {
  pinia: { defineStore },
  '../i18n': { t: key => key },
  '../data/supabaseLeaderboardRepository': { supabaseLeaderboardRepository: repository },
};
async function load(path) {
  const source = await readFile(new URL('../' + path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    assert.ok(id in dependencies, `Unexpected dependency: ${id}`);
    return dependencies[id];
  }, module, module.exports);
  return module.exports;
}
dependencies['../types/model/leaderboard'] = await load('src/types/model/leaderboard.ts');
const { useLeaderboardStore } = await load('src/stores/leaderboard.ts');
const entry = (id, score, total_caught, bestScore = null) => ({
  id, score, total_caught, display_name: id,
  best_fish: bestScore === null ? null : { name: 'Fish', weight: 2, rarity: 'RARE', score: bestScore },
});
beforeEach(() => {
  setActivePinia(createPinia());
  repository.fetchByUser = async () => null;
  repository.countHigher = async () => 0;
});

test('each real criterion uses its own values and personal rank', async () => {
  const store = useLeaderboardStore();
  const player = entry('player', 900, 12, 450);
  assert.deepEqual(store.categories.map(category => category.key), ['score', 'total_caught', 'best_fish']);
  repository.fetchByUser = async id => { assert.equal(id, 'player'); return player; };
  for (const [criterion, value] of [['score', 900], ['total_caught', 12], ['best_fish', 450]]) {
    store.activeTab = criterion;
    repository.fetchTop = async (page, key) => {
      assert.equal(page, 1); assert.equal(key, criterion);
      return { items: [player], total: 1 };
    };
    repository.countHigher = async (metric, key) => {
      assert.equal(metric, value); assert.equal(key, criterion); return 4;
    };
    await store.fetchLeaderboard('player', 1);
    const board = store.boards[0];
    assert.equal(board.entries[0].value, value);
    assert.equal(board.entries[0].userId, 'player');
    assert.equal(board.myValue, value);
    assert.equal(board.myRank, 5);
  }
});

test('ties crossing page boundaries retain shared global ranks', async () => {
  const store = useLeaderboardStore();
  store.activeTab = 'total_caught';
  repository.fetchTop = async () => ({ items: [entry('a', 0, 50), entry('b', 0, 50), entry('c', 0, 40)], total: 23 });
  repository.countHigher = async () => 8;
  await store.fetchLeaderboard(null, 2);
  assert.deepEqual(store.boards[0].entries.map(row => row.rank), [9, 9, 13]);
  assert.equal(store.boards[0].leaders.length, 0);
  assert.equal(store.boards[0].remaining.length, 3);
});

test('a player without a best fish has no personal best-fish rank', async () => {
  const store = useLeaderboardStore();
  store.activeTab = 'best_fish';
  repository.fetchTop = async () => ({ items: [], total: 0 });
  repository.fetchByUser = async () => entry('player', 0, null);
  repository.countHigher = async () => { throw new Error('Must not rank a missing fish'); };
  await store.fetchLeaderboard('player');
  assert.equal(store.myRank, null);
  assert.equal(store.error, '');
});

test('a delayed response cannot overwrite the selected criterion', async () => {
  const store = useLeaderboardStore();
  let resolveOld;
  repository.fetchTop = (_page, criterion) => criterion === 'score'
    ? new Promise(resolve => { resolveOld = resolve; })
    : Promise.resolve({ items: [entry('new', 0, 25)], total: 1 });
  const old = store.fetchLeaderboard(null, 1);
  store.activeTab = 'total_caught';
  await store.fetchLeaderboard(null, 1);
  resolveOld({ items: [entry('old', 999, 1)], total: 1 });
  await old;
  assert.equal(store.entries[0].id, 'new');
  assert.equal(store.boards[0].entries[0].value, 25);
  assert.equal(store.loading, false);
});
