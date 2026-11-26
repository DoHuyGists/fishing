import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import { computed, reactive, ref } from 'vue';

const tools = ['rod', 'line', 'reel', 'hook', 'bait'];
const area = id => ({ id, title: `Lake ${id}`, countryId: 'country', survivalMode: id === 'b' });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

function fixture() {
  setActivePinia(createPinia());
  const calls = [];
  const auth = reactive({ userId: 'player', sessionGeneration: 1 });
  const inventory = reactive({ equipmentSets: [], async setEquipmentSet() {
    this.equipmentSets = [{ id: 'set', isUsed: true, ...Object.fromEntries(tools.map(tool =>
      [tool, [{ id: tool, is_used: true }]])) }];
  } });
  const health = reactive({ loading: false, busy: false, loadInventory: async () => {} });
  const world = reactive({ selectedArea: {}, targetArea(value) { this.selectedArea = value; } });
  const catalog = { get: async () => [area('a'), area('b')] };
  const features = reactive({ enabled: true, canOpen() { return this.enabled; } });
  const membership = reactive({ canEnterFishingArea: true, setCurrentUserInArea: async () => {} });
  const transition = reactive({ visible: false, async coverScreen() { this.visible = true; }, hide() { this.visible = false; } });
  const turns = { fetchStatus: async () => {}, consumeTurn: async () => { calls.push('consume'); } };
  const repository = { setUserEnterArea: async id => { calls.push(id); } };
  const dependencies = {
    vue: { computed, ref }, pinia: { defineStore }, '../i18n': { t: key => key },
    '../data/equipmentCatalog': { equipmentCategories: tools.map(id => ({ id, name: id })) },
    '../data/supabaseEquipmentRepository': { supabaseEquipmentRepository: {} },
    '../data/supabaseUserInAreaRepository': { supabaseUserInAreaRepository: repository },
    './auth': { useAuthStore: () => auth },
    './player-inventory-store': { useInventoryStore: () => inventory },
    './player-health-store': { useHealthStore: () => health },
    './player-diary-store': { useDiaryStore: () => ({ loadDiscoveredAreaSpecies: async id => { calls.push(`diary:${id}`); } }) },
    './player-user-turns-store': { useUserTurnsStore: () => turns },
    './player-user-In-area-store': { useUserInAreaStore: () => membership },
    './player-world-map-store': { useWorldStore: () => world },
    './player-game-catalog-store': { useGameCatalogStore: () => catalog },
    './player-feature-availability-store': { useFeatureAvailabilityStore: () => features },
    './player-fishing-transition-store': { useFishingTransitionStore: () => transition },
    './player-modal-store': { useModalStore: () => ({ isModalOpening: false }) },
  };
  const exports = {};
  const path = 'src/stores/player-prepare-store.ts';
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, console, Error }, { filename: path });
  return { prepare: exports.usePrepareStore(), auth, world, catalog, health, features, membership, transition, turns, repository, calls };
}

test('a fresh page reconstructs the destination from its URL area ID without consuming a turn', async () => {
  const { prepare, world, calls } = fixture();
  world.selectedArea = area('a');
  await prepare.loadData('b');
  assert.equal(prepare.area.id, 'b');
  assert.equal(world.selectedArea.id, 'b');
  assert.equal(prepare.area.survivalMode, true);
  assert.equal(prepare.canProceed, true);
  assert.deepEqual(calls, ['diary:b']);
});

test('missing and unavailable destinations clear old state and block entry', async () => {
  const { prepare, world, calls } = fixture();
  await prepare.loadData('a');
  for (const id of ['', 'missing']) {
    await prepare.loadData(id);
    assert.equal(prepare.area, null);
    assert.equal(world.selectedArea.id, undefined);
    assert.equal(prepare.error, 'PrepareModal.areaNotFound');
    assert.equal(await prepare.enterArea(), false);
  }
  assert.deepEqual(calls, ['diary:a']);
});

test('changing routes and leaving while loading cannot restore the previous destination', async () => {
  const { prepare, world, catalog } = fixture();
  const old = deferred();
  catalog.get = () => old.promise;
  const pending = prepare.loadData('a');
  catalog.get = async () => [area('b')];
  await prepare.loadData('b');
  old.resolve([area('a')]);
  await pending;
  assert.equal(world.selectedArea.id, 'b');
  assert.equal(prepare.area.id, 'b');
  const cancelled = deferred();
  catalog.get = () => cancelled.promise;
  const abandoned = prepare.loadData('a');
  prepare.cancelLoad();
  cancelled.resolve([area('a')]);
  await abandoned;
  assert.equal(prepare.area, null);
  assert.equal(prepare.canProceed, false);
});

test('entry gates cover maintenance, pending catches and equipment changes', async () => {
  const { prepare, features, membership, health, calls } = fixture();
  await prepare.loadData('a');
  features.enabled = false;
  assert.equal(await prepare.enterArea(), false);
  features.enabled = true;
  membership.canEnterFishingArea = false;
  assert.equal(await prepare.enterArea(), false);
  membership.canEnterFishingArea = true;
  health.busy = true;
  assert.equal(await prepare.enterArea(), false);
  health.busy = false;
  prepare.switchingSet = true;
  assert.equal(await prepare.enterArea(), false);
  assert.deepEqual(calls, ['diary:a']);
});

test('confirmation uses the restored destination once and recovers after an entry error', async () => {
  const { prepare, repository, transition, calls } = fixture();
  await prepare.loadData('b');
  repository.setUserEnterArea = async () => { throw new Error('entry failed'); };
  await assert.rejects(prepare.enterArea(), /entry failed/);
  assert.equal(transition.visible, false);
  assert.equal(prepare.entering, false);
  assert.equal(prepare.area.id, 'b');
  repository.setUserEnterArea = async id => { calls.push(id); };
  const first = prepare.enterArea();
  assert.equal(await prepare.enterArea(), false);
  assert.equal(await first, true);
  assert.deepEqual(calls, ['diary:b', 'consume', 'consume', 'b']);
});
