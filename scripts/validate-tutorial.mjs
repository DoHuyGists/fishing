// Run with: node --test scripts/validate-tutorial.mjs
// Execute the actual Pinia stores with a virtual clock. Unknown imports fail,
// so a database or live-player-store dependency cannot silently enter practice.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { beforeEach, test } from 'node:test';
import ts from 'typescript';
import * as pinia from 'pinia';
import * as vue from 'vue';
import * as tension from '../src/data/tensionChallenge.ts';
import * as fishingMap from '../src/data/fishingMap.ts';

const sources = await Promise.all(['tutorialSession', 'tutorials/newPlayerFishing'].map(async name => {
  const source = await readFile(new URL(`../src/stores/${name}.ts`, import.meta.url), 'utf8');
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
}));
let session, lesson, now, timers, nextId;

function advance(milliseconds) {
  const end = now + milliseconds;
  for (;;) {
    const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) break;
    now = next[1].at;
    timers.delete(next[0]);
    next[1].callback();
  }
  now = end;
}
function prepare() {
  lesson.dismissGuide();
  for (const item of lesson.config.equipment) session.selectEquipment(item.id);
  session.confirmEquipment();
  lesson.dismissGuide();
}
function bite() {
  prepare();
  session.castTo(56, 60);
  advance(650 + lesson.config.waitTimeMs);
  assert.equal(session.castPhase, 'bite');
}
beforeEach(() => {
  pinia.setActivePinia(pinia.createPinia());
  now = 100;
  timers = new Map();
  nextId = 0;
  const imports = { pinia, vue, '../data/tensionChallenge': tension, '../data/fishingMap': fishingMap };
  const modules = sources.map(source => {
    const module = { exports: {} };
    new Function('require', 'module', 'exports', 'performance', 'setTimeout', 'clearTimeout', source)(
      id => { assert.ok(id in imports, `Forbidden runtime dependency: ${id}`); return imports[id]; },
      module, module.exports, { now: () => now },
      (callback, delay) => { const id = ++nextId; timers.set(id, { at: now + delay, callback }); return id; },
      id => timers.delete(id),
    );
    imports['../tutorialSession'] = module.exports;
    return module.exports;
  });
  session = modules[0].useTutorialSessionStore();
  lesson = modules[1].useNewPlayerFishingStore();
  lesson.start();
});

test('equipment gates casting and the next guide pauses the lesson', () => {
  assert.equal(lesson.objective, 'equipment');
  assert.equal(session.canCast, false);
  session.selectEquipment('not-a-real-item');
  assert.deepEqual(session.loadout, {});
  for (const item of lesson.config.equipment.slice(0, 4)) session.selectEquipment(item.id);
  session.confirmEquipment();
  assert.equal(session.equipmentConfirmed, false);
  session.selectEquipment(lesson.config.equipment[4].id);
  session.confirmEquipment();
  assert.equal(lesson.objective, 'cast');
  assert.equal(lesson.guideVisible, true);
  assert.equal(session.canCast, false);
  lesson.dismissGuide();
  assert.equal(session.canCast, true);
});

test('land and invalid coordinates are rejected; a valid cast reaches a paused bite', () => {
  prepare();
  for (const point of [{ x: 5, y: 5 }, { x: NaN, y: 60 }, { x: 150, y: 60 }]) session.castTo(point.x, point.y);
  assert.equal(session.castPhase, 'idle');
  assert.equal(timers.size, 0);
  session.castTo(56, 60);
  assert.equal(session.castPhase, 'casting');
  advance(650);
  assert.equal(session.castPhase, 'waiting');
  advance(lesson.config.waitTimeMs);
  assert.equal(lesson.objective, 'fight');
  assert.equal(lesson.guideVisible, true);
  assert.equal(session.paused, true);
  session.setTensionReeling(true);
  advance(120_000);
  session.advanceTensionFight();
  assert.equal(session.tensionFight.tick, 0);
  assert.equal(session.tensionStartedAt, null);
  assert.ok(tension.isTensionChallenge(session.tensionChallenge));
});

test('holding and releasing uses the real tension engine and awards only a local fish', () => {
  bite();
  lesson.dismissGuide();
  for (let tick = 0; tick < 2700 && session.castPhase === 'bite'; tick++) {
    session.setTensionReeling(session.tensionFight.tension / tension.TENSION_SCALE < 52);
    now += 1000 / 30 + 0.001;
    session.advanceTensionFight();
  }
  assert.equal(session.castPhase, 'caught');
  assert.equal(lesson.objective, 'complete');
  assert.equal(session.inventory.length, 1);
  assert.deepEqual(session.inventory[0], lesson.config.fish);
  session.advanceTensionFight();
  assert.equal(session.inventory.length, 1);
  lesson.start();
  assert.deepEqual(session.inventory, []);
  assert.deepEqual(session.loadout, {});
  assert.equal(lesson.objective, 'equipment');
});

test('excess tension and slack permit retry without consuming practice equipment', () => {
  bite();
  lesson.dismissGuide();
  session.setTensionReeling(true);
  now += 10_000;
  session.advanceTensionFight();
  assert.equal(session.castPhase, 'lost');
  assert.match(session.castMessage, /đứt/);
  assert.equal(session.canCast, true);
  assert.equal(session.equipmentReady, true);
  session.castTo(56, 60);
  advance(650 + lesson.config.waitTimeMs);
  lesson.dismissGuide();
  session.setTensionReeling(true);
  session.setTensionReeling(false);
  now += 20_000;
  session.advanceTensionFight();
  assert.equal(session.castPhase, 'lost');
  assert.match(session.castMessage, /chùng/);
  assert.equal(session.inventory.length, 0);
});

test('reeling in, restarting and leaving cancel pending bites', () => {
  prepare();
  session.castTo(56, 60);
  advance(650);
  session.reelInBait();
  advance(10_000);
  assert.equal(session.castPhase, 'idle');
  session.castTo(56, 60);
  lesson.start();
  advance(10_000);
  assert.equal(session.castPhase, 'idle');
  assert.equal(session.tensionChallenge, null);
  prepare();
  session.castTo(56, 60);
  lesson.stop();
  advance(10_000);
  assert.equal(session.config, null);
  assert.equal(session.tensionChallenge, null);
  assert.equal(timers.size, 0);
});

test('opening a guide during a fight preserves simulated time and clears held input', () => {
  bite();
  lesson.dismissGuide();
  session.setTensionReeling(true);
  now += 500;
  session.advanceTensionFight();
  lesson.showGuide();
  const tick = session.tensionFight.tick;
  assert.equal(session.tensionReeling, false);
  now += 100_000;
  session.advanceTensionFight();
  assert.equal(session.tensionFight.tick, tick);
  lesson.dismissGuide();
  session.advanceTensionFight();
  assert.equal(session.tensionFight.tick, tick);
});

test('the tutorial route requires login and bypasses live area lookups', async () => {
  const source = (await readFile(new URL('../src/router/index.ts', import.meta.url), 'utf8'))
    .replace('import.meta.env.BASE_URL', '"/"');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let guard, routes, currentSession = null, areaReads = 0;
  const imports = {
    'vue-router': {
      createWebHistory: () => ({}),
      createRouter: options => { routes = options.routes; return { beforeEach: callback => { guard = callback; } }; },
    },
    '../database/connection': { __esModule: true, default: { auth: { getSession: async () => ({ data: { session: currentSession } }) } } },
    '../data/supabaseUserInAreaRepository.ts': { supabaseUserInAreaRepository: { getCurrentUserArea: async () => { areaReads++; return { status: 'enter' }; } } },
    '../layouts/PlayerLayout.vue': { default: {} },
    '../layouts/AdminLayout.vue': { default: {} },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(id => { assert.ok(id in imports, id); return imports[id]; }, module, module.exports);
  const route = routes.find(route => route.name === 'tutorial');
  assert.ok(route && !route.children);
  assert.equal(route.meta.requiresAuth, true);
  assert.deepEqual(await guard(route), { name: 'login' });
  currentSession = { user: { id: 'player-with-active-trip' } };
  assert.equal(await guard(route), undefined);
  assert.equal(areaReads, 0);
  assert.deepEqual(await guard({ name: 'home', meta: { requiresAuth: true } }), { name: 'fishing' });
  assert.equal(areaReads, 1);
});

test('catalog supports both layouts and recovers from repository failures', async () => {
  const source = await readFile(new URL('../src/stores/tutorial.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const rows = [{ id: 'lesson-1', slug: 'new-player-fishing' }];
  let fail = true;
  const imports = { pinia, '../data/supabaseTutorialRepository': { supabaseTutorialRepository: {
    fetchPublished: async () => { if (fail) throw new Error('offline'); return rows; },
  } } };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(id => { assert.ok(id in imports, id); return imports[id]; }, module, module.exports);
  const catalog = module.exports.useTutorialStore();
  assert.equal(catalog.viewMode, 'grid');
  catalog.setViewMode('list');
  assert.equal(catalog.viewMode, 'list');
  await catalog.load();
  assert.ok(catalog.error);
  assert.equal(catalog.loading, false);
  fail = false;
  await catalog.load();
  assert.equal(catalog.error, '');
  assert.deepEqual(catalog.tutorials, rows);
});
