import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { createPinia, defineStore, setActivePinia } from 'pinia';

const repository = {};
const archiveId = '1479943f-d8bc-48ca-b49f-80701df0de1b';
const currentId = '82dbaf73-3577-480c-8eb8-8584e4ef0a9a';
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
  repository.fetchSeasonBoard = async () => ({ items: [], total: 0, my_entry: null, season: null,
    current_season_id: null, previous_season_id: null, next_season_id: null, hall_of_fame: [], meta: [], server_time: new Date().toISOString() });
});

test('each real criterion uses its own values and personal rank', async () => {
  const store = useLeaderboardStore();
  const player = { ...entry('player', 900, 12, 450), spend: 1200 };
  assert.deepEqual(store.categories.map(category => category.key), ['score', 'total_caught', 'spend', 'best_fish']);
  repository.fetchByUser = async id => { assert.equal(id, 'player'); return player; };
  repository.fetchSeasonBoard = async () => ({ items: [{ ...player, rank: 5 }], total: 1, my_entry: { ...player, rank: 5 }, season: null });
  for (const [criterion, value] of [['score', 900], ['total_caught', 12], ['spend', 1200], ['best_fish', 450]]) {
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

test('Hall of Fame loads seasonal history and preserves season selection when switching tabs', async () => {
  const store = useLeaderboardStore();
  assert.deepEqual(store.tabs.map(tab => tab.key), ['score', 'total_caught', 'spend', 'best_fish', 'hall_of_fame']);
  const board = { items: [], total: 0, my_entry: null, season: { id: archiveId, finalized_at: '2026-11-15T00:00:00Z' },
    hall_of_fame: [{ rank: 1, user_id: 'winner', display_name: 'Winner', fish: { score: 100 } }] };
  const calls = [];
  repository.fetchSeasonBoard = async (page, seasonId) => { calls.push([page, seasonId]); return board; };
  repository.fetchTop = async () => { throw new Error('Hall of Fame must use seasonal data'); };
  store.activeTab = 'hall_of_fame';
  await store.selectSeason(archiveId);
  assert.deepEqual(store.seasonBoard.hall_of_fame, board.hall_of_fame);
  store.activeTab = 'best_fish';
  await store.fetchLeaderboard(null, 1);
  store.activeTab = 'hall_of_fame';
  await store.fetchLeaderboard(null, 1);
  assert.deepEqual(calls, [[1, archiveId], [1, archiveId], [1, archiveId]]);
  assert.equal(store.error, '');
  assert.equal(store.loading, false);
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

test('cash spending trigger accumulates only decreases, preserves achievements and rolls back atomically', async () => {
  const db = new PGlite();
  const uid = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const migration = await readFile(new URL('./supabase/migrations/20261116_leaderboard_spend.sql', import.meta.url), 'utf8');
  const rows = async () => (await db.query('SELECT * FROM leaderboard ORDER BY id')).rows;
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE TABLE leaderboard(id UUID PRIMARY KEY, score NUMERIC NOT NULL, total_caught BIGINT,
        best_fish JSONB, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL);
      CREATE TABLE currency(user_id UUID PRIMARY KEY, cash BIGINT NOT NULL, shells BIGINT DEFAULT 0);
      INSERT INTO leaderboard VALUES('${uid}',900,12,'{"score":450}',now(),now());
      INSERT INTO currency VALUES('${uid}',1000,10),('${other}',1000,10);
      GRANT SELECT, UPDATE ON currency TO authenticated;
    `);
    await db.exec(migration);
    assert.equal(Number((await rows())[0].spend), 0);
    await db.exec("SET ROLE authenticated; UPDATE currency SET cash=cash+100; UPDATE currency SET cash=cash; UPDATE currency SET shells=shells-1; RESET ROLE;");
    assert.equal((await rows()).length, 1);
    assert.equal(Number((await rows())[0].spend), 0);
    await db.exec('SET ROLE authenticated; UPDATE currency SET cash=cash-200; UPDATE currency SET cash=cash-50; RESET ROLE;');
    let board = await rows();
    assert.deepEqual(board.map(row => Number(row.spend)), [250, 250]);
    assert.equal(Number(board[0].score), 900);
    assert.equal(Number(board[0].total_caught), 12);
    assert.deepEqual(board[0].best_fish, { score: 450 });
    assert.equal(Number(board[1].score), 0);
    await db.exec('BEGIN; UPDATE currency SET cash=cash-100; ROLLBACK;');
    assert.deepEqual((await rows()).map(row => Number(row.spend)), [250, 250]);
    await db.exec(migration);
    await db.exec('UPDATE currency SET cash=cash-10;');
    assert.deepEqual((await rows()).map(row => Number(row.spend)), [260, 260]);
    await assert.rejects(db.exec("SET ROLE authenticated; UPDATE leaderboard SET spend=999;"), /permission denied/);
    await db.exec('RESET ROLE;');
  } finally {
    await db.close();
  }
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

test('seasonal equal scores retain distinct server ranks and selecting an archive resets the page', async () => {
  const store = useLeaderboardStore();
  store.activeTab = 'best_fish';
  store.page = 3;
  repository.fetchSeasonBoard = async (page, id) => {
    assert.equal(page, 1); assert.equal(id, archiveId);
    return { items: [{ ...entry('later', 0, 0, 10), rank: 1 }, { ...entry('earlier', 0, 0, 10), rank: 2 }],
      total: 2, my_entry: null, season: { id: archiveId, season_number: 2 }, hall_of_fame: [], meta: [] };
  };
  await store.selectSeason(archiveId);
  assert.deepEqual(store.boards[0].entries.map(e => e.rank), [1, 2]);
  assert.equal(store.page, 1);
  assert.equal(store.seasonBoard.season.id, archiveId);
});

test('a late seasonal response cannot overwrite a newer season selection', async () => {
  const store = useLeaderboardStore();
  store.activeTab = 'best_fish';
  let resolveOld;
  repository.fetchSeasonBoard = (_page, id) => id === null ? new Promise(resolve => { resolveOld = resolve; })
    : Promise.resolve({ items: [], total: 0, my_entry: null, season: { id } });
  const pending = store.fetchLeaderboard();
  await store.selectSeason(archiveId);
  resolveOld({ items: [], total: 0, my_entry: null, season: { id: currentId } });
  await pending;
  assert.equal(store.seasonBoard.season.id, archiveId);
});
