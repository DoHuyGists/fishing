import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const executablePath = process.env.CACHE_TEST_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(path => existsSync(path));
if (!executablePath) throw new Error('Set CACHE_TEST_BROWSER to an installed Chromium/Edge executable.');
const server = await createServer({ configFile: false, envDir: false, server: { host: '127.0.0.1', port: 0, hmr: false }, appType: 'custom',
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://cache-test.supabase.co'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'), 'import.meta.env.VITE_GAME_CATALOG_VERSIONED': JSON.stringify('true') },
  plugins: [{ name: 'cache-test-page', configureServer(instance) { instance.middlewares.use('/__cache_test', (_req, res) => { res.setHeader('Content-Type','text/html'); res.end('<!doctype html><title>IndexedDB cache test</title>'); }); },
    resolveId(id) { if (id === '/__cache_fixture.ts') return id; },
    load(id) { if (id === '/__cache_fixture.ts') return `
      import { createPinia, setActivePinia } from 'pinia';
      import { useAuthStore } from '/src/stores/auth.ts';
      import { useGameCatalogStore } from '/src/stores/gameCatalog.ts';
      import { useCountryStore } from '/src/stores/country.ts';
      import { useFeatureAvailabilityStore } from '/src/stores/featureAvailability.ts';
      import { catalogPolicies } from '/src/data/gameCachePolicies.ts';
      import { supabaseGameCatalogRepository as repository } from '/src/data/supabaseGameCatalogRepository.ts';
      import { useReadCacheStore } from '/src/stores/readCache.ts';
      import { createReadCacheFetch, setReadCacheHandler } from '/src/database/readCacheRequests.ts';
      export async function setup() {
        setActivePinia(createPinia());
        const auth = useAuthStore(); auth.applySession({ user: { id: 'browser-a' } });
        useFeatureAvailabilityStore().checkRequests = async () => null;
        window.catalogCalls = 0; window.countryName = 'initial';
        repository.versions = async () => Object.fromEntries(Object.keys(catalogPolicies).map(domain => [domain, '1']));
        repository.snapshot = async () => { window.catalogCalls++; return { data: [{ id: 'country', code: 'VN', name: window.countryName, location: null }], revision: '1' }; };
        window.catalog = useGameCatalogStore(); window.country = useCountryStore(); window.auth = auth;
        window.catalog.activate(['countries']);
        await window.country.fetchCountries();
      }
      export function setupReads() {
        setActivePinia(createPinia());
        window.readAuth = useAuthStore(); window.readAuth.applySession({ user: { id: 'read-browser' } });
        useFeatureAvailabilityStore().checkRequests = async () => null;
        window.readCache = useReadCacheStore(); window.readCalls = { tutorials: 0, caught: 0 };
        setReadCacheHandler(() => window.readCache.capture());
        window.readFetch = createReadCacheFetch('https://cache-test.supabase.co', async (input, init) => {
          if (['PATCH','DELETE'].includes(init?.method)) return new Response(null, { status: 204 });
          const domain = String(input).includes('/tutorials') ? 'tutorials' : 'caught';
          window.readCalls[domain]++;
          return Response.json([{ id: domain, version: window.readCalls[domain] }]);
        });
        window.readTutorials = () => window.readFetch('https://cache-test.supabase.co/rest/v1/tutorials?select=*');
        window.readCaught = () => window.readFetch('https://cache-test.supabase.co/rest/v1/rpc/get_caught_in_home', { method: 'POST', body: '{}' });
      }
    `; },
  }],
});
let browser;
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext();
  const timestamp = Date.now();
  await context.addInitScript(value => { window.cacheTestBase = value; }, timestamp);
  await context.route(/supabase\./, route => route.abort());
  const page = await context.newPage();
  await page.goto(origin + '__cache_test');
  const bootstrap = async target => target.evaluate(async () => {
    const { IndexedDbCacheRepository } = await import('/src/data/indexedDbCacheRepository.ts');
    const { createGameCache } = await import('/src/utils/gameCache.ts');
    window.disk = new IndexedDbCacheRepository();
    window.clock = window.cacheTestBase; window.calls = 0;
    window.cache = createGameCache(window.disk, { now: () => window.clock, timeoutMs: 30, random: () => 0 });
    window.options = { scope: 'browser-test:user:a', domain: 'species', policy: { ttl: 60_000, maxAge: 600_000 }, validate: Array.isArray,
      load: async () => { window.calls++; return { data: ['saved'], revision: '1' }; } };
  });
  await bootstrap(page);
  const first = await page.evaluate(async () => {
    const rows = await Promise.all(Array.from({ length: 10 }, () => window.cache.read(window.options)));
    return { calls: window.calls, result: rows[0] };
  });
  assert.equal(first.calls, 1);
  await page.reload(); await bootstrap(page);
  const reload = await page.evaluate(async () => ({ result: await window.cache.read(window.options), calls: window.calls }));
  assert.equal(reload.calls, 0); assert.equal(reload.result.fetchedAt, timestamp);

  const other = await context.newPage(); await other.goto(origin + '__cache_test'); await bootstrap(other);
  await other.evaluate(() => window.cache.invalidate('browser-test:user:a', ['species']));
  const protectedWrite = await page.evaluate(async () => {
    const key = window.cache.keyOf(window.options.scope, window.options.domain);
    const fresh = await window.disk.read(window.options.scope, window.options.domain, key);
    const obsolete = { ...fresh.token, generation: '', key, scope: window.options.scope, domain: window.options.domain, schemaVersion: 1,
      data: ['obsolete'], fetchedAt: window.cacheTestBase, expiresAt: window.cacheTestBase + 60_000, staleUntil: window.cacheTestBase + 600_000, retryAt: 0, failureCount: 0, accessedAt: window.cacheTestBase };
    return window.disk.write(obsolete);
  });
  assert.equal(protectedWrite, false);
  // A real cross-tab invalidate notification tells the RAM cache to forget.
  await page.evaluate(() => window.cache.forget('browser-test:user:a', ['species']));
  assert.equal(await page.evaluate(async () => { await window.cache.read(window.options); return window.calls; }), 1);

  const stale = await page.evaluate(async () => {
    window.clock = window.cacheTestBase + 60_001;
    return window.cache.read({ ...window.options, load: () => new Promise(() => {}) });
  });
  assert.equal(stale.state, 'stale');
  await page.reload(); await bootstrap(page);
  const cooldown = await page.evaluate(async () => { window.clock = window.cacheTestBase + 60_002; return { value: await window.cache.read(window.options), calls: window.calls }; });
  assert.equal(cooldown.calls, 0); assert.equal(cooldown.value.state, 'stale');

  const corrupt = await page.evaluate(async () => {
    await window.cache.invalidate(window.options.scope, ['species']);
    const key = window.cache.keyOf(window.options.scope, window.options.domain);
    const { token } = await window.disk.read(window.options.scope, window.options.domain, key);
    await window.disk.write({ ...token, key, scope: window.options.scope, domain: window.options.domain, schemaVersion: 99, data: ['wrong schema'],
      fetchedAt: window.cacheTestBase, expiresAt: window.cacheTestBase + 60_000, staleUntil: window.cacheTestBase + 600_000, retryAt: 0, failureCount: 0, accessedAt: window.cacheTestBase });
    return window.cache.read(window.options);
  });
  assert.equal(corrupt.data[0], 'saved');
  const unavailable = await page.evaluate(async () => {
    const { IndexedDbCacheRepository } = await import('/src/data/indexedDbCacheRepository.ts');
    const original = window.indexedDB.open.bind(window.indexedDB);
    window.indexedDB.open = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
    const blocked = new IndexedDbCacheRepository();
    const { createGameCache } = await import('/src/utils/gameCache.ts');
    const cache = createGameCache(blocked, { now: () => window.clock });
    try { return await cache.read(window.options); }
    finally { window.indexedDB.open = original; }
  });
  assert.equal(unavailable.data[0], 'saved');
  const quota = await page.evaluate(async () => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) { if (this.name === 'entries') throw new DOMException('Quota exceeded','QuotaExceededError'); return original.apply(this,args); };
    try { await window.cache.invalidate(window.options.scope, ['species']); return await window.cache.read(window.options); }
    finally { IDBObjectStore.prototype.put = original; }
  });
  assert.equal(quota.data[0], 'saved');

  await page.evaluate(async () => { const { setup } = await import('/__cache_fixture.ts'); await setup(); });
  await other.evaluate(async () => { const { setup } = await import('/__cache_fixture.ts'); await setup(); });
  assert.equal(await page.evaluate(() => window.catalogCalls), 1);
  assert.equal(await other.evaluate(() => window.catalogCalls), 0);
  assert.equal(await other.evaluate(() => window.catalog.inspectCache().counts.countries.indexedDbHit), 1);
  await other.evaluate(() => window.country.fetchCountries());
  assert.equal(await other.evaluate(() => window.catalog.inspectCache().counts.countries.ramHit), 1);
  assert.equal(await other.evaluate(() => window.catalogCalls), 0);
  await other.evaluate(() => window.catalog.invalidate(['countries']));
  await page.waitForFunction(() => window.country.countries.length === 0);
  await page.evaluate(async () => { window.countryName = 'updated'; await window.catalog.resume(); });
  assert.equal(await page.evaluate(() => window.country.countries[0].name), 'updated');
  await page.evaluate(() => window.auth.applySession(null));
  assert.equal(await page.evaluate(() => window.country.countries.length), 0);
  await other.waitForFunction(() => window.country.countries.length === 0);
  await page.evaluate(async () => {
    const { setupReads } = await import('/__cache_fixture.ts'); setupReads();
    await window.readTutorials(); await window.readCaught(); await window.readCaught();
  });
  assert.deepEqual(await page.evaluate(() => window.readCalls), { tutorials: 1, caught: 1 });
  await page.reload();
  await page.evaluate(async () => {
    const { setupReads } = await import('/__cache_fixture.ts'); setupReads();
    await window.readTutorials(); await window.readCaught();
  });
  assert.deepEqual(await page.evaluate(() => window.readCalls), { tutorials: 0, caught: 1 });
  assert.equal(await page.evaluate(() => window.readCache.inspect().counts.tutorials.indexedDbHit), 1);
  await other.evaluate(async () => {
    const { setupReads } = await import('/__cache_fixture.ts'); setupReads();
    await window.readFetch('https://cache-test.supabase.co/rest/v1/caught?id=eq.fish', { method: 'DELETE' });
  });
  await page.waitForFunction(() => window.readCache.inspect().counts.caught.invalidated > 0);
  await page.evaluate(() => window.readCaught());
  assert.equal(await page.evaluate(() => window.readCalls.caught), 2);
  await other.evaluate(() => window.readFetch('https://cache-test.supabase.co/rest/v1/tutorials?id=eq.tutorial', { method: 'PATCH', body: '{}' }));
  await page.waitForFunction(() => window.readCache.inspect().counts.tutorials.invalidated > 0);
  await page.evaluate(() => window.readTutorials());
  assert.equal(await page.evaluate(() => window.readCalls.tutorials), 1);
  const persistedDomains = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const open = indexedDB.open('fishing-game-cache', 1); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
    try { return await new Promise((resolve, reject) => { const request = db.transaction('entries').objectStore('entries').getAll(); request.onsuccess = () => resolve(request.result.map(row => row.domain)); request.onerror = () => reject(request.error); }); }
    finally { db.close(); }
  });
  assert.equal(persistedDomains.includes('caught'), false, 'Private fish snapshots must never enter IndexedDB');
  await page.evaluate(() => window.readAuth.applySession(null));
  console.log('PASS: real Edge IndexedDB: concurrent reads, reload TTL, cross-tab generation, stale cooldown, schema validation, blocked/quota storage fallback; real Pinia hydration, BroadcastChannel invalidation, active-view resume and logout.');
  console.log('PASS: HTTP read cache: static catalogs survive reload, personal snapshots stay RAM-only, and cross-tab gameplay/admin mutations invalidate cached reads.');
  await context.close();
} finally { await browser?.close(); await server.close(); }
