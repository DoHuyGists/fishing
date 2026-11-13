import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import ts from 'typescript';

test('fishing net capacity blocks casts and release restores space', async () => {
  setActivePinia(createPinia());
  const useProfile = defineStore('profile-test', {
    state: () => ({ fishingNetCapacity: 2, profile: { id: 'user-1' }, error: '' }),
    actions: { async fetchProfile() {} },
  });
  let casts = 0;
  const imports = {
    pinia: { defineStore },
    '../i18n': { t: key => key },
    './auth': { useAuthStore: () => ({ userId: 'user-1' }) },
    './userProfile': { useUserProfileStore: useProfile },
    './equipment': { useEquipmentStore: () => ({ error: '', fetchEquipment: async () => {} }) },
    './userInArea': { useUserInAreaStore: () => ({ setCurrentUserInArea: async () => ({ status: 'enter', area_id: 'lake-1' }) }) },
    './dayPhase': { useDayPhaseStore: () => ({ $reset() {}, setCurrentScenePhase() {} }) },
    '../data/supabaseFishRepository': { supabaseFishRepository: { deleteCaughtFish: async () => {} } },
    '../data/supabaseFishingAreaRepository': { supabaseFishingAreaRepository: { castRod: async () => { casts++; } } },
    '../data/supabaseEquipmentRepository': {},
    '../data/supabaseUserInAreaRepository': {},
    '../database/connection': {},
    '../data/fishingDepth': { buildDepthConfig: () => ({ maxMeters: 10 }) },
    '../data/tensionChallenge': {},
  };
  const source = await readFile(new URL('../src/stores/fishing.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(id => {
    assert(id in imports, `Unexpected import: ${id}`);
    return imports[id];
  }, module, module.exports);
  const store = module.exports.useFishingStore();
  const profile = useProfile();
  store.sessionReady = true;
  store.currentAreaId = 'lake-1';
  store.inventory = [{ id: 'one' }, { id: 'two' }];
  assert.equal(store.canCast, false);
  await store.castTo(10, 10);
  assert.equal(casts, 0);
  assert.equal(store.castMessage, 'FishingBag.capacity_reached');

  await store.releaseFish('one');
  assert.equal(store.canCast, true);
  assert.equal(store.castMessage, 'fishing.cham_mat_ho_de_cau_tiep');
  profile.fishingNetCapacity = 0;
  assert.equal(store.canCast, false);
  profile.fishingNetCapacity = 1;
  assert.equal(store.canCast, false);
  profile.fishingNetCapacity = 3;
  assert.equal(store.canCast, true);
  store.inventory.push({ id: 'three' }, { id: 'four' }, { id: 'five' });
  assert.equal(store.canCast, false);

  let resolveProfile;
  profile.fetchProfile = () => new Promise(resolve => { resolveProfile = resolve; });
  store.initializeFishingArea = async () => {};
  const setup = store.initializeSession('user-1');
  await Promise.resolve();
  assert.equal(store.sessionReady, false);
  resolveProfile();
  await setup;
  assert.equal(store.sessionReady, true);

  profile.fetchProfile = async () => { profile.error = 'Profile unavailable'; };
  await store.initializeSession('user-1');
  assert.equal(store.sessionReady, false);
  assert.equal(store.sessionError, 'Profile unavailable');
});
