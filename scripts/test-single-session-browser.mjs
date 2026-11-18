import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import ts from 'typescript';

const executablePath = process.env.SESSION_TEST_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium',
].find(existsSync);
assert(executablePath, 'Set SESSION_TEST_BROWSER to an installed Chromium/Edge executable.');
const source = ts.transpileModule(await readFile(new URL('../src/composables/use-single-session.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const server = await createServer({ configFile: false, envDir: false,
  server: { host: '127.0.0.1', port: 0, hmr: false }, appType: 'custom',
  plugins: [{ name: 'session-test', configureServer(instance) {
    instance.middlewares.use('/__session_test', (_, res) => {
      res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><div id="app"></div>');
    });
  } }],
});
await server.listen();
const origin = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath, headless: true });
const owners = new Map();
const writes = [];
let delayedRead;
const context = await browser.newContext();
const otherContext = await browser.newContext();
const open = async (ctx = context) => {
  const page = await ctx.newPage();
  await page.exposeFunction('claimSession', (uid, id) => { writes.push({ uid, id }); owners.set(uid, id); });
  await page.exposeFunction('fetchSession', async uid => {
    if (delayedRead) { const wait = delayedRead; delayedRead = null; await wait; }
    return owners.get(uid) ?? null;
  });
  await page.goto(origin + '__session_test');
  return page;
};
const setup = (page, uid, options = {}) => page.evaluate(async ({ source, uid, options }) => {
  const vue = await import('/node_modules/vue/dist/vue.runtime.esm-browser.js');
  window.uid = vue.ref(uid);
  window.claims = 0; window.subscriptions = []; window.blockReady = options.blockReady;
  const repository = {
    async claim(uid, id) { window.claims++; await window.claimSession(uid, id); },
    fetchOwner: uid => window.fetchSession(uid),
    listen(uid, change, connection) {
      let resolve;
      const ready = new Promise(yes => { resolve = yes; });
      const subscription = { uid, change, connection, stopped: false,
        connect() { connection(true); resolve(true); } };
      window.subscriptions.push(subscription);
      if (!window.blockReady) queueMicrotask(() => subscription.connect());
      return { ready, stop() { subscription.stopped = true; resolve(false); } };
    },
  };
  const imports = { vue, '../i18n': { t: key => key },
    '../utils/uuid': { createUuid: () => crypto.randomUUID() },
    '../stores/auth': { useAuthStore: () => ({ signOut: async () => true }) },
    '../data/supabaseSessionRepository': { supabaseSessionRepository: repository } };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(id => imports[id], module, module.exports);
  window.app = vue.createApp({ setup() {
    window.session = module.exports.useSingleSession(window.uid);
    return () => null;
  } });
  window.app.mount('#app');
}, { source, uid, options });
const ready = page => page.waitForFunction(() => window.session.sessionReady.value);
const conflict = (page, type) => page.waitForFunction(type => window.session.conflictType.value === type, type);
const tick = page => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));

try {
  const a = await open(); await setup(a, 'owner'); await ready(a);
  const owner = owners.get('owner');
  const b = await open(); await setup(b, 'owner'); await conflict(b, 'SAME_BROWSER');
  assert.equal(writes.length, 1);
  await b.evaluate(() => window.session.closeCurrentTab()).catch(error => {
    if (!b.isClosed()) throw error;
  });
  if (!b.isClosed()) { await b.waitForURL('about:blank'); await b.close(); }
  assert.equal(owners.get('owner'), owner);
  assert.equal(await a.evaluate(() => window.session.sessionReady.value), true);
  console.log('PASS: closing a rejected tab preserves the incumbent server session');

  const c = await open(); const d = await open();
  await Promise.all([setup(c, 'simultaneous'), setup(d, 'simultaneous')]);
  await c.waitForFunction(() => window.session.sessionReady.value || window.session.showConflictModal.value);
  await d.waitForFunction(() => window.session.sessionReady.value || window.session.showConflictModal.value);
  assert.equal(writes.filter(w => w.uid === 'simultaneous').length, 1);
  assert.equal(Number(await c.evaluate(() => window.session.sessionReady.value)) +
    Number(await d.evaluate(() => window.session.sessionReady.value)), 1);
  await c.close(); await d.close();
  console.log('PASS: simultaneous tabs have exactly one owner');

  await a.reload(); await setup(a, 'owner'); await ready(a);
  assert.notEqual(owners.get('owner'), owner);
  console.log('PASS: reload releases and reacquires the browser lock');

  const e = await open(otherContext); await setup(e, 'owner'); await ready(e);
  // No event is delivered: reconnect must read the authoritative row without claiming again.
  const count = writes.length;
  await a.evaluate(() => {
    const sub = window.subscriptions.at(-1); sub.connection(false); sub.connect();
  });
  await conflict(a, 'CROSS_BROWSER');
  assert.equal(writes.length, count);
  console.log('PASS: another browser takes over; reconnect detects the missed change without reclaiming');

  const f = await open(); await setup(f, 'before-switch', { blockReady: true });
  await f.waitForFunction(() => window.subscriptions.length === 1);
  await f.evaluate(() => { window.uid.value = 'after-switch'; window.subscriptions[0].connect(); });
  await f.waitForFunction(() => window.subscriptions.length === 2);
  await f.evaluate(() => window.subscriptions[1].connect()); await ready(f);
  assert(!writes.some(w => w.uid === 'before-switch'));
  assert.equal(await f.evaluate(() => window.subscriptions[0].stopped), true);
  console.log('PASS: switching accounts cancels old registration and cleans up its channel');

  const g = await open(); await setup(g, 'unmounted', { blockReady: true });
  await g.waitForFunction(() => window.subscriptions.length === 1);
  await g.evaluate(() => { window.app.unmount(); window.subscriptions[0].connect(); });
  await tick(g);
  assert(!writes.some(w => w.uid === 'unmounted'));
  assert.equal(await g.evaluate(() => window.subscriptions[0].stopped), true);
  console.log('PASS: unmount while subscribing cannot write or leave a live channel');

  let releaseRead;
  delayedRead = new Promise(resolve => { releaseRead = resolve; });
  const h = await open(); await setup(h, 'registration-race');
  await h.waitForFunction(() => window.claims === 1);
  while (!owners.has('registration-race')) await tick(h);
  owners.set('registration-race', 'another-browser');
  releaseRead();
  await conflict(h, 'CROSS_BROWSER');
  console.log('PASS: verification catches takeover during registration without a Realtime event');

  const i = await open(); await setup(i, 'late-read'); await ready(i);
  let releaseLate;
  delayedRead = new Promise(resolve => { releaseLate = resolve; });
  await i.evaluate(() => window.subscriptions[0].change());
  await i.evaluate(() => window.app.unmount());
  owners.set('late-read', 'foreign'); releaseLate(); await tick(i);
  assert.equal(await i.evaluate(() => window.session.showConflictModal.value), false);
  console.log('PASS: late reads after unmount cannot open a conflict modal');
} finally {
  await browser.close(); await server.close();
}
