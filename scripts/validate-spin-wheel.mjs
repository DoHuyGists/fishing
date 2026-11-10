// node --test scripts/validate-spin-wheel.mjs
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { createPinia, defineStore, setActivePinia } from 'pinia'

const rpcCalls = []
let rpcResult
const supabase = { async rpc(...args) { rpcCalls.push(args); return rpcResult } }
const wallet = { cash: 15000, tickets: 2 }
const rewardsRepo = {}
const imports = {
  pinia: { defineStore },
  '../database/connection': { __esModule: true, default: supabase },
  '../data/supabaseSpinWheelRepository': { supabaseSpinWheelRepository: rewardsRepo },
  './currency': { useCurrencyStore: () => wallet },
}

async function load(path) {
  const source = await readFile(new URL('../' + path, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => {
    assert(id in imports, `Unexpected dependency: ${id}`)
    return imports[id]
  }, module, module.exports)
  return module.exports
}

const { supabaseUserInventoryRepository: inventoryRepo } = await load('src/data/supabaseUserInventoryRepository.ts')
imports['../data/supabaseUserInventoryRepository.ts'] = { supabaseUserInventoryRepository: inventoryRepo }
const { supabaseSpinWheelRepository: seasonsRepo } = await load('src/data/supabaseSpinWheelRepository.ts')
const { useSpinWheelStore } = await load('src/stores/spinWheel.ts')
const pool = (id) => ({
  season: { id, name: `Mùa ${id}`, starts_at: '2026-01-01', ends_at: '2027-01-01' },
  rewards: [{ id: `item-${id}`, name: 'Cần câu', category: 'rod', image: null, information: 'Thông tin vật phẩm' }],
})

beforeEach(() => {
  setActivePinia(createPinia())
  rpcCalls.length = 0
  wallet.cash = 15000
  wallet.tickets = 2
  rpcResult = { data: { ...pool('new'), item_id: 'item-new', remaining_tickets: 1, cost: 1 }, error: null }
  rewardsRepo.fetchRewards = async () => pool('old')
})

test('repositories call seasonal RPC and spin without a client reward array', async () => {
  await seasonsRepo.fetchRewards()
  await inventoryRepo.claimRandomItem()
  assert.deepEqual(rpcCalls, [['get_spin_wheel_rewards'], ['spin_wheel']])
})

test('season rewards retain information and a single reward is supported', async () => {
  const store = useSpinWheelStore()
  await store.setReward()
  assert.equal(store.season.id, 'old')
  assert.equal(store.rewardList.length, 1)
  assert.equal(store.rewardList[0].information, 'Thông tin vật phẩm')
  assert.equal(store.loading, false)
})

test('no active season clears stale rewards', async () => {
  const store = useSpinWheelStore()
  await store.setReward()
  rewardsRepo.fetchRewards = async () => ({ season: null, rewards: [] })
  await store.setReward()
  assert.equal(store.season, null)
  assert.deepEqual(store.rewardList, [])
})

test('load failure clears old rewards and can be retried', async () => {
  const store = useSpinWheelStore()
  await store.setReward()
  rewardsRepo.fetchRewards = async () => { throw new Error('offline') }
  await store.setReward()
  assert.equal(store.error, 'offline')
  assert.equal(store.season, null)
  assert.deepEqual(store.rewardList, [])
  assert.equal(store.loading, false)
  rewardsRepo.fetchRewards = async () => pool('new')
  await store.setReward()
  assert.equal(store.error, '')
  assert.equal(store.season.id, 'new')
})

test('spin applies server reward snapshot across a season change and updates only tickets', async () => {
  const store = useSpinWheelStore()
  await store.setReward()
  const id = await store.claimRandomItem()
  assert.equal(id, 'item-new')
  assert.equal(store.season.id, 'new')
  assert.equal(store.rewardList.findIndex(item => item.id === id), 0)
  assert.equal(wallet.tickets, 1)
  assert.equal(wallet.cash, 15000)
  assert.equal(store.claiming, false)
})

test('rejected spin preserves wallet and releases the request lock', async () => {
  const store = useSpinWheelStore()
  rpcResult = { data: null, error: { message: 'Không đủ vé' } }
  await assert.rejects(store.claimRandomItem(), /Không đủ vé/)
  assert.equal(wallet.tickets, 2)
  assert.equal(wallet.cash, 15000)
  assert.equal(store.claiming, false)
})

test('duplicate spin requests cannot spend an additional ticket', async () => {
  let resolve
  const pending = new Promise(r => { resolve = r })
  const original = inventoryRepo.claimRandomItem
  inventoryRepo.claimRandomItem = () => pending
  try {
    const store = useSpinWheelStore()
    const first = store.claimRandomItem()
    await assert.rejects(store.claimRandomItem(), /Đang xử lý/)
    resolve(rpcResult.data)
    await first
    assert.equal(wallet.tickets, 1)
    assert.equal(store.claiming, false)
  } finally {
    inventoryRepo.claimRandomItem = original
  }
})
