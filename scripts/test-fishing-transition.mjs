import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { createMemoryHistory, createRouter, isNavigationFailure, NavigationFailureType } from 'vue-router';
import ts from 'typescript';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const source = ts.transpileModule(await read('../src/stores/player-fishing-transition-store.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture() {
  const images = [];
  class Image {
    decode() {
      const pending = deferred();
      images.push({ src: this.src, ...pending });
      return pending.promise;
    }
  }
  const module = { exports: {} };
  const imports = { pinia: { defineStore }, vue: { nextTick } };
  new Function('require', 'module', 'exports', 'Image', 'requestAnimationFrame', source)(
    id => imports[id], module, module.exports, Image, callback => setImmediate(callback),
  );
  setActivePinia(createPinia());
  return { store: module.exports.useFishingTransitionStore(), images };
}

test('cover is painted before continuing; reveal waits for every scene image', async () => {
  const { store, images } = fixture();
  const covering = store.coverScreen();
  assert.equal(store.visible, true);
  await covering;
  const reveal = store.revealScene(['/lake.png', '/rod.png']);
  images[0].resolve();
  await new Promise(setImmediate);
  assert.equal(store.visible, true, 'rod is still loading');
  images[1].resolve();
  await reveal;
  assert.equal(store.visible, false);
});

test('a late image response from an old visit cannot uncover a new visit', async () => {
  const { store, images } = fixture();
  store.show();
  const oldReveal = store.revealScene(['/old-lake.png']);
  store.hide();
  store.show();
  images[0].resolve();
  await oldReveal;
  assert.equal(store.visible, true);
});

test('a broken scene image does not trap the user behind the cover', async () => {
  const { store, images } = fixture();
  store.show();
  const reveal = store.revealScene(['/missing.png']);
  images[0].resolve(Promise.reject(new Error('Image unavailable')));
  await reveal;
  assert.equal(store.visible, false);
});

const prepareSource = await read('../src/components/player/player-prepare/PrepareModal.vue');
const script = prepareSource.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
const ast = ts.createSourceFile('PrepareModal.ts', script, ts.ScriptTarget.Latest, true);
const confirmSource = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'confirm').getText(ast);

test('prepare closes before entry requests; a competing fishing navigation keeps the cover', async () => {
  const { store } = fixture();
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/lobby', name: 'lobby', component: {} },
    { path: '/fishing', name: 'fishing', component: {} },
  ] });
  await router.push('/lobby');
  const firstGuard = deferred(), firstStarted = deferred(), secondGuard = deferred(), secondStarted = deferred();
  let guards = 0;
  router.beforeEach(async () => {
    if (++guards === 1) { firstStarted.resolve(); await firstGuard.promise; }
    else { secondStarted.resolve(); await secondGuard.promise; }
  });
  const modal = { openName: 'prepare', close() { this.openName = null; }, open(name) { this.openName = name; } };
  const consume = { async consumeTurn() {
    assert.equal(modal.openName, null, 'prepare must close before database work');
    assert.equal(store.visible, true);
  } };
  const confirm = new Function(
    'canProceed', 'worldStore', 'fishingTransition', 'modalStore', 'userTurnsStore',
    'supabaseUserInAreaRepository', 'router', 'isNavigationFailure', 'NavigationFailureType', 'toast', 'tr',
    `return (${confirmSource});`,
  )({ value: true }, { selectedArea: { id: 'lake' } }, store, modal, consume,
    { async setUserEnterArea(id) { assert.equal(id, 'lake'); } }, router,
    isNavigationFailure, NavigationFailureType, { error: assert.fail }, key => key);
  const entering = confirm();
  await firstStarted.promise;
  const replacement = router.replace('/fishing');
  await secondStarted.promise;
  firstGuard.resolve();
  await entering;
  assert.equal(router.currentRoute.value.name, 'lobby', 'replacement navigation is still pending');
  assert.equal(store.visible, true, 'cancellation must not briefly uncover the lobby');
  assert.equal(modal.openName, null, 'cancellation must not reopen prepare');
  secondGuard.resolve();
  await replacement;
  assert.equal(router.currentRoute.value.name, 'fishing');
});
