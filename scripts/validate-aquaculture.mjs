// node --test scripts/validate-aquaculture.mjs
// Runs real Pinia actions with controlled repository responses; never connects to Supabase.
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { readonly, ref } from 'vue'
import * as mechanics from '../src/data/aquaculture.ts'
import { createUuid } from '../src/utils/uuid.ts'

const repository = {}, currencyRepo = {}, inventoryRepo = {}, profileRepo = {}, rulesRepo = {}, foodsRepo = {}, speciesRepo = {}, itemsRepo = {}
const database = {}
const auth = { user: { id: 'owner-1' } }, wallet = { cash: 10000, shells: 900 }, inventoryStore = { items: [] }, profileStore = { profile: null }
const storage = new Map()
globalThis.sessionStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) }
class AquacultureRpcError extends Error { constructor(message, uncertain) { super(message); this.uncertain = uncertain } }
const imports = {
  vue: { readonly, ref },
  pinia: { defineStore }, './auth': { useAuthStore: () => auth }, './currency': { useCurrencyStore: () => wallet },
  './inventory': { useInventoryStore: () => inventoryStore }, './userProfile': { useUserProfileStore: () => profileStore },
  '../data/supabaseAquacultureRepository': { AquacultureRpcError, supabaseAquacultureRepository: repository },
  '../data/supabaseCurrencyRepository': { supabaseCurrencyRepository: currencyRepo },
  '../data/supabaseUserInventoryRepository': { supabaseUserInventoryRepository: inventoryRepo },
  '../data/supabaseUserProfileRepository': { supabaseUserProfileRepository: profileRepo },
  '../data/aquaculture': mechanics, '../utils/uuid': { createUuid },
  '../database/connection': { __esModule: true, default: database },
  '../../../data/supabaseAquacultureAdminRepository': { supabaseAquacultureRulesAdminRepository: rulesRepo, supabaseAquacultureFoodsAdminRepository: foodsRepo },
  '../../../data/supabaseSpeciesRepository': { supabaseSpeciesRepository: speciesRepo },
  '../../../data/supabaseItemRepository': { supabaseItemRepository: itemsRepo },
}
async function load(path) {
  const source = await readFile(new URL('../' + path, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => { assert(id in imports, 'Unexpected dependency: ' + id); return imports[id] }, module, module.exports)
  return module.exports
}
const { useToast } = await load('src/composables/useToast.ts')
imports['../composables/useToast'] = { useToast }
const { useAquacultureStore } = await load('src/stores/aquaculture.ts')
const rulesModule = await load('src/components/admin/aquaculture-species-management/admin-aquaculture-species-store.ts')
imports['../aquaculture-species-management/admin-aquaculture-species-store'] = rulesModule
const { useAdminAquacultureFoodStore } = await load('src/components/admin/aquaculture-food-management/admin-aquaculture-food-store.ts')
const { useAdminAquacultureSpeciesStore } = rulesModule
const { supabaseFishRepository } = await load('src/data/supabaseFishRepository.ts')
const { supabaseAquacultureRepository: actualRepository } = await load('src/data/supabaseAquacultureRepository.ts')
const rule = { species_id: 'carp', enabled: true, rules_version: 1, capacity_per_fish: 5, grow_seconds: 21600, seed_cash: 100,
  seed_weight_kg: .05, adult_weight_kg: 1.2, sale_cash_per_kg: 150, rare_chance: .01, advanced_rare_bonus: .02, rare_weight_multiplier: 1.5, feed_cooldown_seconds: 3600 }
const time = Date.now()
function batch(id = 'batch-1', mode = 'advanced', status = 'growing') {
  return { id, pond_id: 'pond-1', species_id: 'carp', mode, status, initial_fish_count: 3, quality_score: .2,
    started_at: new Date(time - 3600000).toISOString(), ready_at: new Date(time + 18000000).toISOString(),
    feed_available_at: new Date(time - 1000).toISOString(), rules_snapshot: structuredClone(rule) }
}
function fish(id, status = 'ready', special = false, batchId = 'batch-1') {
  return { id, batch_id: batchId, species_id: 'carp', capacity: 5, status, weight_kg: 1.2345, star_rating: 3, is_super_special: special, is_shiny: special }
}
function fixture() {
  return { pond_slot: 1, server_time: new Date().toISOString(), species: [{ ...rule, can_stock: true }], ponds: [{
    id: 'pond-1', name: 'Ao 1', slot_number: 1, level: 1, capacity: 100, used_capacity: 15, available_capacity: 84,
    care_available_at: new Date(time - 1000).toISOString(), batches: [batch()], fish: [fish('fish-1'), fish('fish-2', 'ready', true), fish('fish-3', 'growing')],
  }] }
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
let snapshot, executeCalls, fetchCalls
beforeEach(() => {
  const toast = useToast()
  toast.toasts.value.forEach(item => toast.dismiss(item.id))
  setActivePinia(createPinia()); storage.clear(); auth.user = { id: 'owner-1' }; wallet.cash = 10000; wallet.shells = 900
  snapshot = fixture(); executeCalls = []; fetchCalls = 0
  repository.fetchFarm = async () => { fetchCalls++; return structuredClone(snapshot) }
  repository.fetchCatalog = async () => ({ species: [{ id: 'carp', name: 'Cá chép', image: '/fish/VN/Carp.png' }], foods: [{
    species_id: 'carp', item_id: 'food-1', enabled: true, capacity_units_per_item: 10, quality_gain: .08, item: { id: 'food-1', name: 'Cám', isDisabled: false },
  }] })
  repository.fetchRecords = async () => []
  repository.fetchStoredFishCount = async () => 2
  repository.execute = async (...args) => { executeCalls.push(args); return {} }
  currencyRepo.fetchMyCurrency = async () => ({ cash: 10000, shells: 900 })
  inventoryRepo.fetchUserInventory = async () => [{ id: 'inventory-1', data: { id: 'food-1', quantity: 4 } }]
  profileRepo.fetchUserProfile = async () => ({ species_storage_capacity: 5, pond_slot: 1 })
  rulesRepo.fetchAll = async () => [{ ...rule, id: 'carp' }]
  speciesRepo.fetchAll = async () => [{ id: 'carp', name: 'Cá chép' }]
  itemsRepo.fetchAll = async () => [{ id: 'food-1', name: 'Cám', isDisabled: false }]
  foodsRepo.fetchAll = async () => []
})
async function ready() { const store = useAquacultureStore(); await store.initialize(auth.user.id); return store }

test('capacity is strict, honors existing occupancy, affordable seed quantity and discovery', async () => {
  assert.equal(mechanics.maxStockQuantity({ capacity: 100, used_capacity: 0 }, rule, 10000), 19)
  assert.equal(mechanics.maxStockQuantity({ capacity: 100, used_capacity: 95 }, rule, 10000), 0)
  const store = await ready()
  assert.equal(store.maxStock('carp'), 16)
  wallet.cash = 250; assert.equal(store.maxStock('carp'), 2)
  store.farm.species[0].can_stock = false
  assert.equal(store.maxStock('carp'), 0)
  assert.equal(await store.stock('carp', 1, 'simple'), false); assert.equal(executeCalls.length, 0)
})
test('feeding uses a real inventory ID, rounds capacity up, excludes disabled foods and simple mode', async () => {
  const store = await ready()
  assert.equal(store.foodOptions[0].needed, 2); assert.equal(store.foodOptions[0].owned, 4)
  assert.equal(store.canFeed, true)
  await store.feed('inventory-1')
  assert.deepEqual(executeCalls[0].slice(0, 2), ['feed_aquaculture_batch', { p_batch_id: 'batch-1', p_inventory_id: 'inventory-1' }])
  store.activeBatch.mode = 'simple'; assert.equal(store.canFeed, false)
  store.catalog.foods[0].item.isDisabled = true; assert.deepEqual(store.foodOptions, [])
})
test('bulk selection protects special fish, growth is never finalized by the browser, prices round per fish', async () => {
  const store = await ready()
  store.selectOrdinaryReadyFish(); assert.deepEqual(store.selectedFishIds, ['fish-1'])
  store.toggleFish('fish-2'); assert.equal(store.selectionCash, 370)
  store.toggleFish('fish-3'); assert.equal(store.selectionReady, false)
  store.now = time + 86400000
  assert.equal(mechanics.batchProgress(store.activeBatch, store.now), 100)
  assert.equal(store.activeBatch.status, 'growing'); assert.equal(store.canFeed, false)
  assert.equal(store.storageAvailable, 3)
})
test('mutations serialize and array requests are canonical; success reloads authoritative state', async () => {
  const store = await ready(), rpc = deferred()
  repository.execute = async (...args) => { executeCalls.push(args); return rpc.promise }
  const action = store.actOnFish('transfer', ['fish-2', 'fish-1'])
  assert.equal(store.busy, true)
  assert.equal(await store.buyPond(), false)
  assert.deepEqual(executeCalls[0][1], { p_fish_ids: ['fish-1', 'fish-2'] })
  snapshot.ponds[0].fish = [snapshot.ponds[0].fish[2]]
  rpc.resolve({ transferred: [{ fish_id: 'fish-1', caught_id: 'caught-1' }] })
  assert.equal(await action, true); assert.equal(store.activePond.fish.length, 1)
  assert.equal(store.pending, null); assert.equal(store.canMutate, true)
})
test('lost response retains exactly the same request and survives a page/session store reset', async () => {
  const store = await ready()
  repository.execute = async (...args) => { executeCalls.push(args); throw new AquacultureRpcError('Network error', true) }
  assert.equal(await store.buyPond(), false)
  assert.equal(useToast().toasts.value.at(-1).variant, 'error')
  assert.match(useToast().toasts.value.at(-1).message, /Thử lại thao tác/)
  const original = structuredClone(executeCalls[0]); assert.equal(store.canMutate, false)
  store.resetSession('owner-1'); await store.refresh(true)
  assert.equal(store.pending.requestId, original[2])
  repository.execute = async (...args) => { executeCalls.push(args); return {} }
  assert.equal(await store.retryPending(), true)
  assert.equal(useToast().toasts.value.at(-1).variant, 'success')
  assert.deepEqual(executeCalls[1], original); assert.equal(storage.size, 0)
})
test('definitive rejection clears pending, while refresh failure after success never retries a committed action', async () => {
  const store = await ready()
  repository.execute = async () => { throw new AquacultureRpcError('Insufficient or invalid wallet balance', false) }
  assert.equal(await store.buyPond(), false); assert.equal(store.pending, null); assert.equal(store.busy, false)
  repository.execute = async () => { executeCalls.push('success'); return {} }
  repository.fetchFarm = async () => { throw new Error('Offline') }
  assert.equal(await store.buyPond(), true); assert.equal(store.pending, null)
  assert.equal(store.needsRefresh, true); assert.match(store.error, /thành công/)
  assert.deepEqual(useToast().toasts.value.slice(-2).map(item => item.variant), ['success', 'error'])
  assert.equal(await store.retryPending(), false); assert.equal(executeCalls.length, 1)
})
test('repeated background failures show one toast until recovery, and later failures notify again', async () => {
  const store = await ready()
  const fetchFarm = repository.fetchFarm
  repository.fetchFarm = async () => { throw new Error('Offline') }
  assert.equal(await store.refresh(), false)
  assert.equal(await store.refresh(), false)
  assert.equal(useToast().toasts.value.length, 1)
  assert.equal(store.needsRefresh, true)
  repository.fetchFarm = fetchFarm
  assert.equal(await store.refresh(), true)
  repository.fetchFarm = async () => { throw new Error('Offline') }
  assert.equal(await store.refresh(), false)
  assert.equal(useToast().toasts.value.length, 2)
})

test('responses for an old account cannot overwrite the new account or its loading state', async () => {
  const store = useAquacultureStore(), old = deferred()
  repository.fetchFarm = () => old.promise
  const first = store.initialize('owner-1')
  auth.user = { id: 'owner-2' }
  repository.fetchFarm = async () => ({ ...fixture(), ponds: [{ ...fixture().ponds[0], id: 'pond-2' }] })
  await store.initialize('owner-2')
  old.resolve(fixture()); await first
  assert.equal(store.ownerId, 'owner-2'); assert.equal(store.activePond.id, 'pond-2'); assert.equal(store.loading, false)
})
test('selection cannot leak into another batch or pond; server removal prunes selected IDs', async () => {
  const store = await ready()
  store.toggleFish('fish-1'); snapshot.ponds[0].fish.shift(); await store.refresh()
  assert.deepEqual(store.selectedFishIds, [])
  store.toggleFish('fish-2'); store.selectBatch('another-batch'); assert.deepEqual(store.selectedFishIds, [])
  store.selectPond('missing'); assert.equal(store.activePond, null); assert.deepEqual(store.pagedFish, [])
})
test('admin rejects invalid economic settings, snapshots versions, and preserves species key on edit', async () => {
  const store = useAdminAquacultureSpeciesStore(); await store.fetchAll()
  let saved
  rulesRepo.update = async (...args) => { saved = args; return { ...args[1], id: args[0], rules_version: args[2] + 1 } }
  await assert.rejects(store.save({ ...rule, adult_weight_kg: .01 }, 'carp'), /trưởng thành/)
  await assert.rejects(store.save({ ...rule, rare_chance: .99 }, 'carp'), /100%/)
  await assert.rejects(store.save({ ...rule, grow_seconds: 60 }, 'carp'), /grow_seconds/)
  await store.save({ ...rule, species_id: 'tampered' }, 'carp')
  assert.equal(saved[1].species_id, 'carp'); assert.equal(saved[2], 1); assert.equal(store.items[0].rules_version, 2)
})
test('admin food edits target both composite keys and validate coverage and quality', async () => {
  const store = useAdminAquacultureFoodStore(); await store.fetchAll()
  const row = { id: 'carp:food-1', species_id: 'carp', item_id: 'food-1', enabled: true, capacity_units_per_item: 20, quality_gain: .08 }
  store.items = [row]
  let saved
  foodsRepo.update = async payload => { saved = payload; return { ...payload, id: 'carp:food-1' } }
  await assert.rejects(store.save({ ...row, capacity_units_per_item: 0 }, row.id), /capacity_units/)
  await store.save({ ...row, species_id: 'tampered', item_id: 'tampered' }, row.id)
  assert.equal(saved.species_id, 'carp'); assert.equal(saved.item_id, 'food-1')
})

test('home storage includes farm fish missing from the old RPC, keeps fishing origin, and deduplicates IDs', async () => {
  const farmFish = { id: 'farm-fish', user_id: 'owner-1', species_id: 'carp', status: 'normal', weight: '1.2', species: { id: 'carp', name: 'Cá chép' } }
  const caughtFish = { ...farmFish, id: 'caught-fish', origin: { id: 'lake', name: 'Hồ', is_available: true } }
  const filters = []
  database.rpc = async () => ({ data: [caughtFish], error: null })
  database.from = table => {
    assert.equal(table, 'caught')
    const chain = {
      select: () => chain, eq: (...args) => { filters.push(args); return chain }, is: (...args) => { filters.push(args); return chain },
      order: () => chain, range: async () => ({ data: [farmFish, caughtFish], error: null }),
    }
    return chain
  }
  const fish = await supabaseFishRepository.fetchAllCaughtFishes('owner-1')
  assert.equal(fish.length, 2); assert.equal(fish[0].origin, null); assert.equal(fish[0].weight, 1.2)
  assert.equal(fish[1].origin.id, 'lake')
  assert.deepEqual(filters, [['user_id', 'owner-1'], ['status', 'normal'], ['area_id', null]])
})
test('actual repository sends the receipt ID and distinguishes network ambiguity from a database rejection', async () => {
  let sent
  database.rpc = async (...args) => { sent = args; return { data: null, error: { message: 'Failed to fetch', code: '' } } }
  await assert.rejects(actualRepository.execute('purchase_pond_slot', {}, 'receipt'), error => error.uncertain === true)
  assert.deepEqual(sent, ['purchase_pond_slot', { p_request_id: 'receipt' }])
  database.rpc = async () => ({ error: { message: 'Insufficient balance', code: 'P0001' } })
  await assert.rejects(actualRepository.execute('purchase_pond_slot', {}, 'receipt'), error => error.uncertain === false)
})
