// Run with: node --test scripts/validate-fishing-session.mjs
// Exercise real Pinia actions with deferred repository responses; no network access.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { beforeEach, test } from 'node:test';
import ts from 'typescript';
import { createPinia, defineStore, setActivePinia } from 'pinia';

const fishRepo = {}, areaRepo = {}, equipmentRepo = {}, membershipRepo = {}, zoneRepo = {};
const imports = {
  pinia: { defineStore },
  './auth': { useAuthStore: () => ({ userId: 'user-1' }) },
  '../data/supabaseFishRepository': { supabaseFishRepository: fishRepo },
  '../data/supabaseFishingAreaRepository': { supabaseFishingAreaRepository: areaRepo },
  '../data/supabaseEquipmentRepository': { supabaseEquipmentRepository: equipmentRepo },
  '../data/supabaseUserInAreaRepository': { supabaseUserInAreaRepository: membershipRepo },
  '../data/supabaseZoneRepository': { supabaseZoneRepository: zoneRepo },
  '../database/connection': { default: { from: () => { throw new Error('Unexpected database access'); } } },
  '../data/fishingDepth': await import('../src/data/fishingDepth.ts'),
  '../data/tensionChallenge': await import('../src/data/tensionChallenge.ts'),
  '../data/equipmentCatalog': await import('../src/data/equipmentCatalog.ts'),
};
const storeNames = ['dayPhase', 'userInArea', 'equipment', 'fishing', 'weather'];
for (const name of storeNames) imports[`./${name}`] = {};
for (const name of storeNames) {
  const source = await readFile(new URL(`../src/stores/${name}.ts`, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'window', output)(
    (id) => { assert(id in imports, `Unexpected import: ${id}`); return imports[id]; },
    module, module.exports, { setTimeout, clearTimeout },
  );
  Object.assign(imports[`./${name}`], module.exports);
}
const { useFishingStore } = imports['./fishing'];
const { useEquipmentStore } = imports['./equipment'];
const { useDayPhaseStore } = imports['./dayPhase'];
const { useUserInAreaStore } = imports['./userInArea'];
const { useWeatherStore } = imports['./weather'];
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = () => new Promise(setImmediate);
const membership = { area_id: 'lake-1', status: 'enter', user_id: 'user-1' };
const lake = { id: 'lake-1', scenePath: '/lake-1', fishingBoundary: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }], maxDepth: 20 };
const variants = () => Object.fromEntries(['rod', 'line', 'reel', 'hook', 'bait'].map((tool) => [tool, [{ id: `${tool}-selected`, is_used: true, quantity: 10 }]]));
const fish = { id: 'fish-1', weight: 2, variant_type: 'NORMAL', species: { name: 'Test fish' } };
let calls;

beforeEach(() => {
  setActivePinia(createPinia());
  calls = { leave: 0, complete: 0 };
  membershipRepo.getCurrentUserArea = async () => ({ ...membership });
  membershipRepo.fetchUsersInArea = async () => [];
  membershipRepo.setUserLeaveArea = async () => { calls.leave++; };
  fishRepo.fetchFishingInventory = async () => [];
  fishRepo.completeFishing = async () => { calls.complete++; };
  fishRepo.deleteCaughtFish = async () => {};
  areaRepo.fetchOneAreas = async () => ({ ...lake });
  equipmentRepo.fetchEquipment = async () => variants();
  zoneRepo.unsubscribe = async () => {};
  zoneRepo.subscribeToZone = () => ({});
});

test('entry waits for equipment, lake and bag, then enables depth with the correct scene', async () => {
  const store = useFishingStore();
  const equipment = deferred(), area = deferred(), bag = deferred();
  equipmentRepo.fetchEquipment = () => equipment.promise;
  areaRepo.fetchOneAreas = () => area.promise;
  fishRepo.fetchFishingInventory = () => bag.promise;
  const setup = store.initializeSession('user-1');
  await tick();
  assert.equal(store.sessionReady, false);
  assert.equal(store.canCast, false);
  equipment.resolve(variants());
  await tick();
  area.resolve(lake);
  await tick();
  assert.equal(store.sessionReady, false);
  bag.resolve([fish]);
  await setup;
  assert.equal(store.sessionReady, true);
  assert.equal(store.canAdjustLakeDepth, true);
  store.openDepthAdjuster();
  assert.equal(store.depthAdjusterOpen, true);
  assert.equal(store.equipmentLoadout.rod, 'rod-selected');
  assert.equal(store.inventory.length, 1);
  assert.match(useDayPhaseStore().currentScenePhace, /^\/lake-1\/(dawn|day|dusk|night)\.png$/);
});

test('reset clears session state and ignores responses from a previous visit to the same lake', async () => {
  const store = useFishingStore();
  store.currentAreaId = lake.id;
  store.bagOpen = store.playersOpen = store.depthAdjusterOpen = store.catchDialogOpen = true;
  store.appliedDepthMeters = 10;
  const bag = deferred(), area = deferred(), diary = deferred(), preview = deferred();
  fishRepo.fetchFishingInventory = () => bag.promise;
  areaRepo.fetchOneAreas = () => area.promise;
  fishRepo.fetchAreaSpeciesDiary = () => diary.promise;
  fishRepo.previewFishByDepth = () => preview.promise;
  const pending = [store.fetchCaughtFishes(lake.id), store.fetchCurrentArea(lake.id), store.fetchAreaSpeciesDiary(), store.fetchDepthPreview(10)];
  store.resetSession();
  store.currentAreaId = lake.id;
  bag.resolve([fish]); area.resolve(lake); diary.resolve({ fishes: [fish] }); preview.resolve({ fishes: [fish] });
  await Promise.all(pending);
  assert.deepEqual(store.inventory, []);
  assert.deepEqual(store.currentArea, {});
  assert.equal(store.areaSpeciesDiary, null);
  assert.equal(store.depthPreview, null);
  assert.equal(store.appliedDepthMeters, 0);
  for (const field of ['bagOpen', 'playersOpen', 'depthAdjusterOpen', 'catchDialogOpen', 'sessionReady']) assert.equal(store[field], false, field);
  assert.equal(useDayPhaseStore().currentScenePhace, '');
});

test('failed setup exposes an error and retries all required data', async () => {
  const store = useFishingStore();
  equipmentRepo.fetchEquipment = async () => { throw new Error('Equipment unavailable'); };
  await store.initializeSession('user-1');
  assert.equal(store.sessionReady, false);
  assert.match(store.sessionError, /Equipment unavailable/);
  equipmentRepo.fetchEquipment = async () => variants();
  await store.initializeSession('user-1');
  assert.equal(store.sessionError, '');
  assert.equal(store.sessionReady, true);
});

test('depth adjustment does not require a water polygon that the depth dialog never uses', async () => {
  const store = useFishingStore();
  areaRepo.fetchOneAreas = async () => ({ ...lake, fishingBoundary: [] });
  await store.initializeSession('user-1');
  store.openDepthAdjuster();
  assert.equal(store.depthAdjusterOpen, true);
});

test('exit checks the server bag even when the local catch counter is empty after reload', async () => {
  const store = useFishingStore();
  fishRepo.fetchFishingInventory = async () => [fish];
  assert.equal(await store.leaveFishingArea(), true);
  assert.deepEqual(calls, { leave: 1, complete: 0 });
  assert.equal(store.hasLeftArea, true);
  assert.equal(await store.leaveFishingArea(), true);
  assert.equal(calls.leave, 1);
});

test('exit completes fishing when every fish has been released, despite stale local data', async () => {
  const store = useFishingStore();
  store.inventory = [{ id: 'stale-fish' }];
  assert.equal(await store.leaveFishingArea(), true);
  assert.deepEqual(calls, { leave: 0, complete: 1 });
});

test('failed bag reads and failed exit RPCs keep the session and allow retry', async () => {
  const store = useFishingStore();
  fishRepo.fetchFishingInventory = async () => { throw new Error('Bag unavailable'); };
  assert.equal(await store.leaveFishingArea(), false);
  assert.match(store.leaveAreaError, /Bag unavailable/);
  assert.deepEqual(calls, { leave: 0, complete: 0 });
  fishRepo.fetchFishingInventory = async () => [fish];
  membershipRepo.setUserLeaveArea = async () => { throw new Error('Exit unavailable'); };
  assert.equal(await store.leaveFishingArea(), false);
  assert.match(store.leaveAreaError, /Exit unavailable/);
  assert.equal(store.hasLeftArea, false);
  assert.equal(store.isLeavingArea, false);
  membershipRepo.setUserLeaveArea = async () => { calls.leave++; };
  assert.equal(await store.leaveFishingArea(), true);
});

test('duplicate exits are blocked and gameplay cannot change the bag during exit', async () => {
  const store = useFishingStore();
  store.sessionReady = true;
  const bag = deferred();
  fishRepo.fetchFishingInventory = () => bag.promise;
  const leaving = store.leaveFishingArea();
  await tick();
  assert.equal(store.canCast, false);
  assert.equal(store.canAdjustDepth, false);
  assert.equal(await store.leaveFishingArea(), false);
  bag.resolve([]);
  assert.equal(await leaving, true);
  assert.equal(calls.complete, 1);
});

test('exit waits for catch submission or fish release to finish', async () => {
  const store = useFishingStore();
  store.castPhase = 'submitting';
  assert.equal(await store.leaveFishingArea(), false);
  store.castPhase = 'idle';
  const release = deferred();
  fishRepo.deleteCaughtFish = () => release.promise;
  const releasing = store.releaseFish('fish-1');
  assert.equal(await store.leaveFishingArea(), false);
  release.resolve();
  await releasing;
  assert.equal(await store.leaveFishingArea(), true);
});

test('concurrent equipment callers both await data, and reset rejects stale results', async () => {
  const equipment = useEquipmentStore();
  const data = deferred();
  let reads = 0;
  equipmentRepo.fetchEquipment = () => { reads++; return data.promise; };
  const first = equipment.fetchEquipment('user-1');
  const second = equipment.fetchEquipment('user-1');
  assert.equal(reads, 1);
  equipment.reset();
  useFishingStore().resetSession();
  data.resolve(variants());
  await Promise.all([first, second]);
  assert.equal(equipment.loaded, false);
  assert.equal(equipment.loading, false);
  assert.equal(useFishingStore().equipmentLoadout.rod, 'rod-bamboo');
  equipmentRepo.fetchEquipment = async () => variants();
  await equipment.fetchEquipment('user-1');
  useFishingStore().resetSession();
  await equipment.fetchEquipment('user-1');
  assert.equal(useFishingStore().equipmentLoadout.rod, 'rod-selected');
});

test('membership responses arriving out of order cannot restore a previous area', async () => {
  const store = useUserInAreaStore(), old = deferred();
  membershipRepo.getCurrentUserArea = () => old.promise;
  const pending = store.setCurrentUserInArea('user-1');
  membershipRepo.getCurrentUserArea = async () => ({ ...membership, status: null });
  await store.setCurrentUserInArea('user-1');
  old.resolve(membership);
  await pending;
  assert.equal(store.userInArea.status, null);
});

test('weather reset prevents a late load from restoring data or subscribing after exit', async () => {
  const store = useWeatherStore(), zone = deferred();
  let subscriptions = 0;
  zoneRepo.fetchZoneByAreaId = () => zone.promise;
  zoneRepo.subscribeToZone = () => { subscriptions++; return {}; };
  const loading = store.init('lake-1');
  await tick();
  await store.reset();
  zone.resolve({ id: 'old-zone' });
  await loading;
  assert.equal(store.zone, null);
  assert.equal(store.loading, false);
  assert.equal(subscriptions, 0);
});
