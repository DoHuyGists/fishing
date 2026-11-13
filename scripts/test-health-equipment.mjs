import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { beforeEach, test } from 'node:test';
import * as pinia from 'pinia';
import ts from 'typescript';
import { reactive } from 'vue';
import * as equipment from '../src/data/healthEquipment.ts';

const auth = reactive({ user: { id: 'owner' }, sessionGeneration: 1 });
const inventory = reactive({ items: [], async setUserInventory() {} });
let rows, failSave;
const copy = value => JSON.parse(JSON.stringify(value));
const makeSet = (id, used = false) => ({ id, user_id: 'owner', is_used: used, ...Object.fromEntries(equipment.healthSlots.map(slot => [slot, []])) });
const repository = {
  async fetchSets() { return copy(rows); },
  async createSet() { const set = makeSet('new'); rows.push(set); return copy(set); },
  async saveSet(set) { if (failSave) throw new Error('offline'); rows = rows.map(row => row.id === set.id ? copy(set) : row); },
  async chooseSet(id) { for (const set of rows) set.is_used = set.id === id; },
};
const imports = {
  pinia, '../data/healthEquipment': equipment,
  '../data/supabaseBodyEquipmentRepository': { supabaseBodyEquipmentRepository: repository },
  './inventory': { useInventoryStore: () => inventory },
  './auth': { useAuthStore: () => auth }, '../i18n': { t: key => key },
};
const source = await readFile(new URL('../src/stores/health.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(id => { assert.ok(id in imports); return imports[id]; }, module, module.exports);
const { useHealthStore } = module.exports;
const row = (id, slot, bonuses, extra = {}) => ({ id, userId: 'owner', data: { name: id, category: slot, health_bonuses: bonuses, ...extra } });

beforeEach(() => {
  pinia.setActivePinia(pinia.createPinia()); auth.user = { id: 'owner' }; auth.sessionGeneration = 1;
  rows = [makeSet('one', true), makeSet('two')]; failSave = false;
  inventory.items = [row('hat', 'head', { morale: 15 }), row('helmet', 'head', { vitality: 250 }), row('vest', 'torso', { vitality: 10 })];
  inventory.setUserInventory = async () => {};
});

test('zero base; only saved active set contributes, including totals above 100', async () => {
  const store = useHealthStore(); await store.loadInventory();
  assert.ok(store.stats.every(stat => stat.value === 0));
  store.selectedSetId = 'one'; store.selectedSlot = 'head';
  store.equip('hat'); store.equip('hat'); store.equip('helmet');
  store.selectedSlot = 'torso'; store.equip('vest');
  assert.equal(store.sets[0].head.length, 2); assert.equal(store.bonuses.vitality, 0);
  await store.saveSet(store.sets[0]); assert.equal(store.bonuses.vitality, 260); assert.equal(store.bonuses.morale, 15);
  await store.chooseSet('two'); assert.ok(store.stats.every(stat => stat.value === 0));
  await store.chooseSet('one'); assert.equal(store.bonuses.vitality, 260);
  store.unequip(store.sets[0], 'head', 'helmet'); assert.equal(store.bonuses.vitality, 260);
  assert.equal(store.containsInventory(new Set(['helmet'])), true);
  await store.saveSet(store.sets[0]); assert.equal(store.bonuses.vitality, 10);
  assert.equal(store.containsInventory(new Set(['helmet'])), false);
});

test('failed save keeps committed totals, and creating sets preserves existing drafts', async () => {
  const store = useHealthStore(); await store.loadInventory();
  store.selectedSetId = 'one'; store.selectedSlot = 'head'; store.equip('hat');
  failSave = true; await assert.rejects(store.saveSet(store.sets[0]));
  assert.equal(store.bonuses.morale, 0); assert.equal(store.isDirty(store.sets[0]), true);
  await store.createSet(); assert.equal(store.sets.length, 3); assert.equal(store.sets[0].head.length, 1);
});

test('ownership, quantity and selected slot are required', async () => {
  inventory.items.push({ ...row('foreign', 'head', { morale: 100 }), userId: 'someone' }, row('empty', 'head', { morale: 99 }, { quantity: 0 }));
  const store = useHealthStore(); await store.loadInventory();
  store.equip('hat'); assert.equal(store.equippedItems.length, 0);
  store.selectedSetId = 'one'; store.selectedSlot = 'head';
  store.equip('vest'); store.equip('foreign'); store.equip('empty'); assert.equal(store.equippedItems.length, 0);
  store.equip('hat'); await store.saveSet(store.sets[0]); assert.equal(store.bonuses.morale, 15);
  auth.user = { id: 'next' }; auth.sessionGeneration++;
  assert.equal(store.ownedItems.length, 0); assert.equal(store.bonuses.morale, 0);
});

test('late requests cannot overwrite a newer session', async () => {
  const store = useHealthStore(); let finish;
  inventory.setUserInventory = () => new Promise(resolve => { finish = resolve; });
  const oldLoad = store.loadInventory(); auth.user = { id: 'next' }; auth.sessionGeneration++;
  inventory.setUserInventory = async () => { throw new Error('offline'); };
  await store.loadInventory(); finish(); await oldLoad;
  assert.equal(store.owner, 'next'); assert.equal(store.error, 'Health.inventoryError'); assert.equal(store.loading, false);
  assert.deepEqual(store.sets, []);
});

test('malformed effects are excluded without capping legitimate stats', () => {
  const item = equipment.healthEquipment(row('bad', 'head', { vitality: Infinity, morale: '20', energy: -10, hydration: 500 }, { quantity: 'invalid' }));
  assert.deepEqual(item.bonuses, { hydration: 500 }); assert.equal(item.quantity, 0);
});
