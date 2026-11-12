import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { createPinia, setActivePinia } from 'pinia';

const require = createRequire(import.meta.url);
const catalog = JSON.parse(fs.readFileSync('src/data/featureCatalog.json', 'utf8'));
const sql = fs.readFileSync('scripts/supabase/migrations/20261112_feature_flags.sql', 'utf8');
assert.deepEqual(JSON.parse(sql.match(/\$catalog\$([\s\S]*?)\$catalog\$/)[1]), catalog, 'Client and server endpoint rules must match');
assert.equal(new Set(catalog.map(row => row.key)).size, catalog.length);
const menu = fs.readFileSync('src/components/player/world-map/FeatureTable.vue', 'utf8');
for (const match of menu.matchAll(/modal: '([^']+)'/g)) assert.ok(catalog.some(row => row.key === match[1]), `Missing flag for ${match[1]}`);
for (const locale of ['vi', 'en']) {
  const messages = JSON.parse(fs.readFileSync(`src/locales/${locale}.json`, 'utf8'));
  for (const feature of catalog) assert.ok(feature.labelKey.split('.').reduce((value, key) => value?.[key], messages), feature.labelKey);
}

const stored = new Map();
const storage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
function load(path, dependencies = {}) {
  const { outputText } = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, require: name => dependencies[name] ?? require(name),
    URL, Request, Response, Headers, Date, Error, Promise, console,
    setInterval: () => 1, clearInterval: () => {}, localStorage: storage,
  }, { filename: path });
  return exports;
}
const rules = load('src/data/featureAvailability.ts', { './featureCatalog.json': catalog });
const keysFor = (path, method = 'GET') => Array.from(rules.requestFeatures(new URL(`https://game.supabase.co${path}`), method));
for (const feature of catalog) {
  for (const rpc of feature.rpcs) {
    for (const method of ['GET', 'POST']) assert.ok(keysFor(`/rest/v1/rpc/${rpc}`, method).includes(feature.key));
  }
  for (const table of feature.tables) assert.ok(keysFor(`/rest/v1/${table}?select=*`).includes(feature.key));
  for (const table of feature.writeTables) {
    assert.ok(!keysFor(`/rest/v1/${table}`).includes(feature.key));
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.ok(keysFor(`/rest/v1/${table}`, method).includes(feature.key));
  }
  for (const endpoint of feature.functions) assert.ok(keysFor(`/functions/v1/${endpoint}`, 'POST').includes(feature.key));
  for (const bucket of feature.storageBuckets) assert.ok(keysFor(`/storage/v1/object/${bucket}/test.png`, 'POST').includes(feature.key));
}
for (const path of ['/rest/v1/feature_flags', '/rest/v1/user_profile', '/rest/v1/currency', '/rest/v1/items',
  '/rest/v1/user_inventory', '/rest/v1/caught_diary', '/rest/v1/rpc/get_caught_in_home', '/rest/v1/rpc/get_area_species_diary',
  '/rest/v1/rpc/user_leave_area', '/rest/v1/rpc/user_complete_fishing',
  '/rest/v1/rpc/cast_rod', '/auth/v1/token']) assert.deepEqual(keysFor(path), [], `Shared data/recovery must stay available: ${path}`);
assert.deepEqual(keysFor('/rest/v1/rpc/user_enter_area', 'POST').sort(), ['enter-area', 'world-map']);
assert.deepEqual(keysFor('/rest/v1/rpc/purchase_item', 'OPTIONS'), []);
assert.deepEqual(keysFor('/storage/v1/object/sign/player-profile-avatars', 'POST'), [], 'Reading avatar URLs must stay available');
assert.deepEqual(Array.from(rules.modalFeatures('prepare')), ['world-map', 'enter-area']);

const gate = load('src/database/featureRequestGate.ts', { '../data/featureAvailability': rules });
let networkCalls = 0;
let lastHeaders;
const transport = async (_input, init) => { networkCalls++; lastHeaders = new Headers(init?.headers); return Response.json({ ok: true }); };
const guardedFetch = gate.createFeatureFetch('https://game.supabase.co', transport);
const purchaseUrl = 'https://game.supabase.co/rest/v1/rpc/purchase_item';
assert.equal((await guardedFetch(purchaseUrl, { method: 'POST' })).status, 403, 'Uninitialized gate must deny');
assert.equal(networkCalls, 0);
gate.setFeatureRequestGuard(async features => features.includes('shop') ? { message: 'Đang sửa cửa hàng' } : null, () => 'en');
const blocked = await guardedFetch(new Request(purchaseUrl, { method: 'POST' }));
assert.equal(blocked.status, 403);
assert.equal((await blocked.json()).message, 'Đang sửa cửa hàng');
assert.equal(networkCalls, 0, 'Disabled requests must never reach the network');
await guardedFetch('https://game.supabase.co/rest/v1/feature_flags');
await guardedFetch('https://game.supabase.co/auth/v1/token', { method: 'POST' });
await guardedFetch('https://external.example/rest/v1/rpc/purchase_item', { method: 'POST' });
assert.equal(networkCalls, 3);
gate.setFeatureRequestGuard(async () => null, () => 'en');
await guardedFetch(new Request(purchaseUrl, { method: 'POST', headers: { Authorization: 'Bearer test' } }));
assert.equal(networkCalls, 4);
assert.equal(lastHeaders.get('Accept-Language'), 'en');
assert.equal(lastHeaders.get('Authorization'), 'Bearer test');
let serverDenied = '';
gate.setFeatureRequestGuard(async () => null, () => 'vi', key => { serverDenied = key; });
const staleFetch = gate.createFeatureFetch('https://game.supabase.co', async () => Response.json({
  code: 'PT403', message: 'Maintenance', details: 'FEATURE_DISABLED:shop',
}, { status: 403 }));
const serverResponse = await staleFetch(purchaseUrl, { method: 'POST' });
assert.equal(serverDenied, 'shop', 'Server-side rejections should refresh stale flags');
assert.equal((await serverResponse.json()).details, 'FEATURE_DISABLED:shop', 'Original errors must stay readable');

let fetchCalls = 0;
let subscriptions = 0;
let unsubscribed = 0;
let onChange;
let fetchRows;
const rows = () => catalog.map(feature => ({ feature_key: feature.key, enabled: true, message_vi: '', message_en: '', updated_at: '2026-11-12T00:00:00Z', updated_by: null }));
const repository = {
  fetchAll: async () => { fetchCalls++; return fetchRows(); },
  subscribe: callback => { onChange = callback; subscriptions++; return {}; },
  unsubscribe: async () => { unsubscribed++; },
};
const notices = [];
const locale = { value: 'vi' };
const informationModule = load('src/stores/informationModal.ts');
const featureModule = load('src/stores/featureAvailability.ts', {
  './informationModal': informationModule,
  '../i18n': { i18n: { global: { locale } }, t: key => key },
  '../data/featureAvailability': rules,
  '../data/supabaseFeatureFlagRepository': { supabaseFeatureFlagRepository: repository },
  '../composables/useToast': { useToast: () => ({ warning: message => notices.push(message) }) },
});
setActivePinia(createPinia());
const features = featureModule.useFeatureAvailabilityStore();
assert.equal(features.isAvailable('shop'), false);
fetchRows = async () => { throw new Error('offline'); };
await features.load();
assert.equal(features.ready, false);
assert.equal(features.isAvailable('shop'), false);
assert.equal(features.reason('shop'), 'FeatureAvailability.loadError');
fetchRows = async () => rows().slice(1);
await features.load(true);
assert.equal(features.ready, false, 'Missing flag rows must not silently enable features');
fetchRows = async () => rows();
await features.start();
await features.start();
assert.equal(subscriptions, 1);
assert.equal(features.isAvailable('shop'), true);
const disabledRows = rows();
Object.assign(disabledRows.find(row => row.feature_key === 'shop'), { enabled: false, message_vi: 'Đang sửa cửa hàng', message_en: 'Shop repair' });
fetchRows = async () => disabledRows;
await features.load(true);
assert.equal(features.isAvailable('shop'), false);
assert.equal(features.canOpen('shop'), false);
assert.equal(features.reason('shop'), 'Đang sửa cửa hàng');
features.showDetails('shop');
assert.equal(informationModule.useInformationModalStore().content.description, 'Đang sửa cửa hàng');
assert.ok(informationModule.useInformationModalStore().content.name.includes('FeatureAvailability.maintenanceBadge'));
locale.value = 'en';
assert.equal(features.reason('shop'), 'Shop repair');
features.showDetails('shop');
assert.equal(informationModule.useInformationModalStore().content.description, 'Shop repair');
features.showDetails('world-map');
assert.equal(informationModule.useInformationModalStore().content.description, 'FeatureAvailability.maintenance');
informationModule.useInformationModalStore().close();
features.notify('shop'); features.notify('shop');
assert.equal(notices.length, 1, 'Repeated rejections should not flood toasts');
assert.equal((await features.checkRequests(['shop'])).code, 'FEATURE_DISABLED');
assert.equal(await features.checkRequests(['market']), null);
fetchRows = async () => { throw new Error('offline'); };
await features.load(true);
assert.equal(features.ready, true);
assert.equal(features.isAvailable('shop'), false, 'Offline mode must preserve known disabled flags');

// A Realtime event during an in-flight snapshot must trigger another snapshot.
let resolveSnapshot;
fetchRows = () => new Promise(resolve => { resolveSnapshot = resolve; });
const before = fetchCalls;
const initial = features.load(true);
onChange();
fetchRows = async () => disabledRows;
resolveSnapshot(rows());
await initial;
assert.equal(fetchCalls - before, 2);
assert.equal(features.isAvailable('shop'), false);

// A response from a previous login must not repopulate the store after reset.
fetchRows = () => new Promise(resolve => { resolveSnapshot = resolve; });
const old = features.load(true);
features.stop();
resolveSnapshot(rows());
await old;
assert.equal(features.ready, false);
assert.equal(Object.keys(features.flags).length, 0);
assert.equal(unsubscribed, 1);
fetchRows = async () => rows();
await features.load(true);

stored.set('fishing.modalOpening', 'shop');
const modalModule = load('src/stores/modal.ts', {
  './featureAvailability': featureModule, '../data/featureAvailability': rules,
});
const modals = modalModule.useModalStore();
assert.equal(modals.isOpening('shop'), true);
features.flags.shop.enabled = false;
assert.equal(modals.isOpening('shop'), false, 'Restored disabled modals must not render');
assert.equal(modals.open('shop'), false);
modals.close();
assert.equal(stored.has('fishing.modalOpening'), false);
features.flags['world-map'].enabled = false;
assert.equal(modals.open('prepare'), false);
features.flags['world-map'].enabled = true;
features.flags['enter-area'].enabled = false;
assert.equal(modals.open('prepare'), false);
features.flags['enter-area'].enabled = true;
modals.open('prepare');
assert.equal(modals.isOpening('prepare'), true);
features.stop();

// Admin writes preserve booleans and reject stale snapshots/concurrent saves.
const adminModule = load('src/components/admin/feature-management/admin-feature-store.ts', {
  '../../../data/featureAvailability': rules,
  '../../../data/supabaseFeatureFlagRepository': { supabaseFeatureFlagRepository: repository },
  '../../../stores/featureAvailability': featureModule,
  '../../../i18n': { t: key => key },
});
const admin = adminModule.useAdminFeatureStore();
fetchRows = async () => rows();
await admin.fetchAll();
assert.equal(admin.items.length, 27);
await assert.rejects(admin.save({ enabled: true }, 'unknown'));
await assert.rejects(admin.save({ enabled: 'invalid' }, 'shop'));
repository.update = async () => null;
await assert.rejects(admin.save({ enabled: 'false' }, 'shop'), /phiên khác/);
assert.equal(admin.saving, false);
assert.equal(admin.flags.find(row => row.feature_key === 'shop').enabled, true);
let finishUpdate;
let savedPayload;
let expectedVersion;
repository.update = async (_key, payload, version) => {
  savedPayload = payload; expectedVersion = version;
  return new Promise(resolve => { finishUpdate = resolve; });
};
const save = admin.save({ enabled: 'false', message_vi: 'Đang bảo trì', message_en: 'Maintenance' }, 'shop');
assert.equal(admin.saving, true);
await assert.rejects(admin.save({ enabled: true }, 'shop'), /Đang lưu/);
assert.equal(savedPayload.enabled, false);
assert.equal(expectedVersion, '2026-11-12T00:00:00Z');
const updated = { ...rows().find(row => row.feature_key === 'shop'), ...savedPayload, updated_at: '2026-11-12T00:01:00Z' };
fetchRows = async () => rows().map(row => row.feature_key === 'shop' ? updated : row);
finishUpdate(updated);
await save;
assert.equal(admin.saving, false);
assert.equal(admin.flags.find(row => row.feature_key === 'shop').enabled, false);
assert.equal(features.isAvailable('shop'), false);
features.stop();

const areaRepository = load('src/data/supabaseUserInAreaRepository.ts', {
  '../database/connection': { rpc: async () => ({ error: { message: 'Entry under maintenance' } }) },
}).supabaseUserInAreaRepository;
await assert.rejects(areaRepository.setUserEnterArea('test-area'), /Entry under maintenance/, 'Rejected entry must not look successful');

const changed = ['src/data/featureCatalog.json', 'src/data/featureAvailability.ts', 'src/stores/featureAvailability.ts',
  'src/stores/informationModal.ts', 'src/components/shared/InformationModal.vue',
  'src/components/player/world-map/FeatureTable.vue', 'src/components/player/world-map/InteractWorldMap.vue',
  'src/database/featureRequestGate.ts', 'src/data/supabaseFeatureFlagRepository.ts',
  'src/components/admin/feature-management/admin-feature-store.ts', 'src/components/admin/feature-management/FeatureManagement.vue',
  'scripts/supabase/migrations/20261112_feature_flags.sql', 'src/i18n/locales/vi.json', 'src/i18n/locales/en.json'];
for (const file of changed) {
  const content = fs.readFileSync(file, 'utf8');
  assert.notEqual(content.charCodeAt(0), 0xfeff, `${file}: BOM`);
  assert.ok(!/\uFFFD|\u00c3[\u0080-\u00bf]|\u00c4\u2018|\u00f0\u0178|\u00e2\u203a/.test(content), `${file}: possible encoding corruption`);
}
console.log(`Validated ${catalog.length} feature flags: endpoint parity, network rejection, shared data, locales, reconnect races, session reset, subscriptions, restored modals, admin conflicts, entry errors and UTF-8.`);
