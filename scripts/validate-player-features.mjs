// node --test scripts/validate-player-features.mjs
// Executes actual Pinia actions with controlled repositories; no live database writes.
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { createPinia, defineStore, setActivePinia } from 'pinia'

const recipes = {}, market = {}, notifications = {}, authRepo = {}, feedback = {}, profiles = {}, avatars = {}
const wallet = { cash: 100, error: '', async fetchCurrency() {} }
const inventory = { items: [] }
const imports = {
  pinia: { defineStore },
  '../data/supabaseBlueprintRepository': { supabaseBlueprintRepository: recipes },
  '../data/supabaseItemRepository': { supabaseItemRepository: {} },
  './currency': { useCurrencyStore: () => wallet },
  './inventory': { useInventoryStore: () => inventory },
  '../data/supabaseMarketRepository': { supabaseMarketRepository: market },
  '../data/supabaseNotificationRepository': { supabaseNotificationRepository: notifications },
  '../data/supabaseAuthRepository': { supabaseAuthRepository: authRepo },
  '../data/supabaseUserProfileRepository': { supabaseUserProfileRepository: profiles },
  '../data/supabaseAvatarRepository': { supabaseAvatarRepository: avatars },
  '../data/supabaseFeedbackRepository': { supabaseFeedbackRepository: feedback },
  '../database/connection': { __esModule: true, default: {} },
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
const { useBlueprintStore } = await load('src/stores/blueprint.ts')
const { useMarketStore } = await load('src/stores/market.ts')
const { useNotificationStore } = await load('src/stores/notification.ts')
const { useAuthStore } = await load('src/stores/auth.ts')
const { useFeedbackStore } = await load('src/stores/feedback.ts')
const { useUserProfileStore } = await load('src/stores/userProfile.ts')
beforeEach(() => {
  setActivePinia(createPinia())
  wallet.cash = 100; wallet.error = ''; inventory.items = [{ data: { id: 'wood', quantity: 5 } }]
  recipes.craft = async () => ({ success: true })
  notifications.fetchNotifications = async () => ({ personal: [], system: [] })
})
function blueprint() {
  const store = useBlueprintStore()
  store.blueprints = [{ id: 'rod', goldCost: 50, resultQuantity: 1, resultItemId: 'rod-item', requiredMaterials: [{ item_id: 'wood', quantity: 2 }] }]
  return store
}
function deferred() {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}
test('craft rejects invalid counts and insufficient money without calling RPC', async () => {
  let calls = 0
  recipes.craft = async () => { calls++ }
  const store = blueprint()
  for (const count of [0, -1, 1.5, NaN, Infinity, 1001]) await assert.rejects(store.craft('rod', count))
  await assert.rejects(store.craft('rod', 3), /Không đủ tiền/)
  assert.equal(calls, 0)
  assert.equal(store.crafting, false)
})
test('craft aggregates repeated material requirements and prevents double submission', async () => {
  const store = blueprint()
  store.blueprints[0].requiredMaterials.push({ item_id: 'wood', quantity: 4 })
  await assert.rejects(store.craft('rod', 1), /nguyên liệu/)
  store.blueprints[0].requiredMaterials.pop()
  const pending = deferred()
  let calls = 0
  recipes.craft = async () => { calls++; return pending.promise }
  const first = store.craft('rod', 1)
  await assert.rejects(store.craft('rod', 1), /Đang chế tạo/)
  pending.resolve({ success: true })
  await first
  assert.equal(calls, 1)
  assert.equal(store.crafting, false)
})
test('wallet loading failure blocks crafting', async () => {
  const store = blueprint()
  wallet.error = 'offline'
  await assert.rejects(store.craft('rod', 1), /offline/)
  assert.equal(store.crafting, false)
})
test('market pagination keeps 20 rows and ignores a late response from the old page', async () => {
  const old = deferred()
  market.fetchHistory = async (_id, page) => page === 1 ? old.promise : Array.from({ length: 21 }, (_, i) => ({ id: `page2-${i}` }))
  const store = useMarketStore()
  const first = store.loadHistory('me', 1)
  await store.loadHistory('me', 2)
  old.resolve([{ id: 'stale' }]); await first
  assert.equal(store.historyPage, 2)
  assert.equal(store.history.length, 20)
  assert.equal(store.historyHasNext, true)
  assert.equal(store.history[0].id, 'page2-0')
})
test('market closing ignores an inflight listing refresh', async () => {
  const pending = deferred()
  market.fetchActiveListings = () => pending.promise
  const store = useMarketStore()
  const request = store.loadMarketListings()
  store.stopRealtime()
  pending.resolve([{ id: 'stale' }]); await request
  assert.equal(store.marketListings.length, 0)
})
test('unread badge restores personal and system unread counts and keeps failed reads unread', async () => {
  notifications.fetchNotifications = async () => ({ personal: [{ id: 'a', is_read: false }, { id: 'b', is_read: true }], system: [{ id: 's', is_read: false }] })
  const store = useNotificationStore()
  await store.loadNotifications('me')
  assert.equal(store.unreadCount, 2)
  notifications.markAsRead = async () => { throw new Error('offline') }
  await assert.rejects(store.markAsRead('system', store.system[0], 'me'), /offline/)
  assert.equal(store.unreadCount, 2)
})
test('notification responses cannot leak the previous user data into a new account', async () => {
  const old = deferred()
  notifications.fetchNotifications = id => id === 'old' ? old.promise : Promise.resolve({ personal: [], system: [] })
  const store = useNotificationStore()
  const first = store.loadNotifications('old')
  await store.loadNotifications('new')
  old.resolve({ personal: [{ id: 'old-private', is_read: false }], system: [] }); await first
  assert.equal(store.unreadCount, 0)
  assert.equal(store.ownerId, 'new')
})
test('password validation blocks invalid input and forwards current password', async () => {
  let payload
  authRepo.updatePassword = async (...args) => { payload = args }
  const store = useAuthStore()
  await assert.rejects(store.updatePassword('short', 'short'))
  await assert.rejects(store.updatePassword('longpassword', 'different'))
  assert.equal(payload, undefined)
  await store.updatePassword('longpassword', 'longpassword', 'old-password')
  assert.deepEqual(payload, ['longpassword', 'old-password'])
  assert.equal(store.passwordBusy, false)
})
test('feedback pagination ignores stale requests', async () => {
  const old = deferred()
  feedback.fetchMyErrors = async (_id, page) => page === 1 ? old.promise : [{ id: 'new', status: 'processing' }]
  const store = useFeedbackStore()
  const first = store.loadMyErrors('me', 1)
  await store.loadMyErrors('me', 2)
  old.resolve([{ id: 'old' }]); await first
  assert.equal(store.myErrors[0].id, 'new')
  assert.equal(store.page, 2)
})
test('editing the name preserves a stored avatar path instead of persisting its signed URL', async () => {
  let payload
  profiles.updateIdentity = async (...args) => { payload = args; return { id: 'me', avatar_path: 'me/image.png', avatar_url: 'https://signed' } }
  const store = useUserProfileStore()
  store.profile = { id: 'me', avatar_path: 'me/image.png', avatar_url: 'https://signed' }
  await store.updateIdentity('New Name', 'https://signed')
  assert.deepEqual(payload, ['New Name', null, 'me/image.png'])
})
test('failed identity update removes a newly uploaded avatar', async () => {
  let removed
  avatars.upload = async () => 'me/new.png'
  avatars.remove = async path => { removed = path }
  profiles.updateIdentity = async () => { throw new Error('failed') }
  const store = useUserProfileStore()
  store.profile = { id: 'me' }
  await assert.rejects(store.updateIdentity('Valid Name', null, {}), /failed/)
  assert.equal(removed, 'me/new.png')
})
test('changed text files remain valid UTF-8 without BOM or mojibake markers', async () => {
  const tracked = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' }).trim().split(/\r?\n/)
  const added = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split(/\r?\n/)
  for (const path of [...tracked, ...added].filter(path => /\.(vue|ts|mjs|sql|md)$/.test(path))) {
    const bytes = await readFile(new URL('../' + path.replaceAll('\\', '/'), import.meta.url))
    assert.notDeepEqual([...bytes.subarray(0, 3)], [239, 187, 191], `UTF-8 BOM: ${path}`)
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    assert(!/\u00c3[\u0080-\u00bf]|\u00c4\u2018|\u00f0\u0178|\ufffd/.test(text), `Mojibake: ${path}`)
  }
})
