// node --test --test-isolation=none scripts/validate-world-map.mjs
// Exercises real Pinia actions, repository queries, and Canvas drawing with no network access.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { beforeEach, test } from 'node:test';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import { computed, nextTick, reactive, ref, watch } from 'vue';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import ts from 'typescript';
import { getWorldMapCountryId } from '../src/data/worldMapCountries.ts';

const repository = {};
const auth = { user: { id: 'player-a' } };
const database = {};
const world = JSON.parse(await readFile(new URL('../node_modules/world-atlas/countries-110m.json', import.meta.url), 'utf8'));
const imports = {
  pinia: { defineStore },
  '../data/supabaseCountryRepository': { supabaseCountryRepository: repository },
  '../data/worldMapCountries': { getWorldMapCountryId },
  './auth': { useAuthStore: () => auth },
  '../database/connection': { __esModule: true, default: database },
  '../utils/uuid': { createUuid: () => 'test-subscription' },
};

function evaluate(source, dependencies, globals = {}) {
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(
    id => { assert(id in dependencies, 'Unexpected dependency: ' + id); return dependencies[id]; },
    module, module.exports, ...Object.values(globals),
  );
  return module.exports;
}

const { useCountryStore } = evaluate(await readFile(new URL('../src/stores/country.ts', import.meta.url), 'utf8'), imports);
const { supabaseCountryRepository: actualRepository } = evaluate(
  await readFile(new URL('../src/data/supabaseCountryRepository.ts', import.meta.url), 'utf8'), imports,
);
const country = (code, name = code) => ({ id: code, code, name });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

beforeEach(() => {
  setActivePinia(createPinia());
  auth.user = { id: 'player-a' };
  repository.fetchCountries = async () => [country('VN'), country('TH')];
  repository.fetchMyUnlockedCountries = async () => [country('VN')];
});

test('alpha-2 codes map to atlas IDs, including leading zeroes, without guessing unknown codes', () => {
  for (const [code, expected] of [[' vn ', '704'], ['TH', '764'], ['US', '840'], ['AU', '036'], ['4', '004']]) {
    assert.equal(getWorldMapCountryId(code), expected);
  }
  assert.equal(getWorldMapCountryId('UNKNOWN'), null);
  assert.equal(getWorldMapCountryId('toString'), null);
});

test('the full country catalog remains intact when unlocked countries are fetched', async () => {
  const store = useCountryStore();
  await Promise.all([store.fetchCountries(), store.fetchMyUnlockedCountries()]);
  assert.deepEqual(store.countries.map(row => row.code), ['VN', 'TH']);
  assert.deepEqual(store.unlockedCountries.map(row => row.code), ['VN']);
  assert.deepEqual(store.unlockedWorldMapCountryIds, ['704']);
  assert.equal(store.loaded, true);
});

test('switching players clears previous unlocks immediately and ignores late responses', async () => {
  const first = deferred(), second = deferred();
  repository.fetchMyUnlockedCountries = playerId => playerId === 'player-a' ? first.promise : second.promise;
  const store = useCountryStore();
  store.unlockedCountries = [country('VN')];
  const a = store.fetchMyUnlockedCountries();
  auth.user = { id: 'player-b' };
  const b = store.fetchMyUnlockedCountries();
  assert.deepEqual(store.unlockedCountries, []);
  second.resolve([country('TH')]);
  await b;
  first.resolve([country('VN')]);
  await a;
  assert.deepEqual(store.unlockedWorldMapCountryIds, ['764']);
  auth.user = null;
  await store.fetchMyUnlockedCountries();
  assert.deepEqual(store.unlockedCountries, []);
  assert.equal(store.isLoadingUnlocked, false);
});

test('the newest refresh wins when an earlier snapshot arrives late', async () => {
  const old = deferred(), fresh = deferred();
  const store = useCountryStore();
  repository.fetchMyUnlockedCountries = () => old.promise;
  const first = store.fetchMyUnlockedCountries();
  repository.fetchMyUnlockedCountries = () => fresh.promise;
  const second = store.fetchMyUnlockedCountries();
  fresh.resolve([country('VN'), country('TH')]);
  await second;
  old.resolve([country('VN')]);
  await first;
  assert.deepEqual(store.unlockedWorldMapCountryIds, ['704', '764']);
});

test('Realtime refreshes unlocks and exposes subscription cleanup', async () => {
  let onChange, stopped = false;
  repository.subscribeToUnlockedCountries = (playerId, callback) => {
    assert.equal(playerId, 'player-a');
    onChange = callback;
    return () => { stopped = true; };
  };
  const store = useCountryStore();
  const stop = store.watchUnlockedCountries('player-a');
  await nextTick();
  assert.deepEqual(store.unlockedWorldMapCountryIds, ['704']);
  repository.fetchMyUnlockedCountries = async () => [country('VN'), country('TH')];
  onChange();
  await nextTick();
  assert.deepEqual(store.unlockedWorldMapCountryIds, ['704', '764']);
  stop();
  assert.equal(stopped, true);
});

test('repository reads the unlock table with the player filter and joins country codes', async () => {
  const query = {
    select(columns) { assert.match(columns, /country:countries!inner/); return this; },
    eq(key, value) { assert.equal(key, 'player_id'); assert.equal(value, 'player-a'); return this; },
    returns() { return Promise.resolve({ data: [{ country: country('VN') }], error: null }); },
  };
  database.from = table => { assert.equal(table, 'player_unlocked_countries'); return query; };
  assert.deepEqual(await actualRepository.fetchMyUnlockedCountries('player-a'), [country('VN')]);
});

test('repository filters Realtime by player, refreshes on reconnect, and removes its channel', () => {
  let changes = 0, statusCallback, changeCallback, removed;
  const channel = {
    on(event, filter, callback) {
      assert.equal(event, 'postgres_changes');
      assert.equal(filter.table, 'player_unlocked_countries');
      assert.equal(filter.filter, 'player_id=eq.player-a');
      changeCallback = callback;
      return this;
    },
    subscribe(callback) { statusCallback = callback; return this; },
  };
  database.channel = () => channel;
  database.removeChannel = value => { removed = value; };
  const stop = actualRepository.subscribeToUnlockedCountries('player-a', () => { changes++; });
  statusCallback('SUBSCRIBED');
  changeCallback();
  assert.equal(changes, 2);
  stop();
  assert.equal(removed, channel);
});

test('clouds cover locked polygons, clear unlocked countries, and stay correct after zoom/resize', async () => {
  const source = await readFile(new URL('../src/components/player/world-map/WorldMap.vue', import.meta.url), 'utf8');
  const setup = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
  const props = reactive({ unlockedCountryIds: [], areas: [], anchor: null, pickEnabled: false, seaColor: '#cfe8f3' });
  const fills = [], transforms = [], images = [];
  function createCanvas() {
    const canvas = { clientWidth: 600, clientHeight: 600, getContext: () => context };
    const context = new Proxy({
      fill() { fills.push({ canvas, feature: this.feature, operation: this.globalCompositeOperation }); },
      drawImage(image) { images.push({ canvas, image }); },
      translate(x, y) { transforms.push([x, y]); },
      scale(x, y) { transforms.push([x, y]); },
      createPattern: () => ({}),
    }, { get: (target, key) => key in target ? target[key] : () => {} });
    return canvas;
  }
  const canvas = createCanvas();
  const harness = evaluate(setup + `
    export function render(canvas, view) {
      canvasRef.value = canvas;
      transform = view;
      setupCanvas();
      draw();
    }
  `, {
    vue: { computed, ref, watch, onMounted() {}, onBeforeUnmount() {} },
    d3: { ...d3, geoPath(...args) {
      const realPath = d3.geoPath(...args);
      return Object.assign(value => { args[1].feature = value; return realPath(value); }, realPath);
    } },
    'topojson-client': topojson,
    'world-atlas/countries-110m.json': { __esModule: true, default: world },
    '../../../database/connection': { __esModule: true, default: database },
    '../../../utils/worldMapClouds': { createWorldMapCloudTexture: createCanvas },
  }, {
    defineProps: () => props,
    withDefaults: value => value,
    defineEmits: () => () => {},
    defineExpose() {},
    Image: class { complete = true; naturalWidth = 4096; },
    window: { devicePixelRatio: 2 },
    document: { createElement: createCanvas },
  });
  const lockedMask = () => fills.find(fill => fill.canvas !== canvas && fill.operation !== 'destination-out');
  const clearedMasks = () => fills.filter(fill => fill.operation === 'destination-out');
  const cloudDraws = () => images.filter(draw => draw.canvas === canvas && draw.image.getContext);
  harness.render(canvas, d3.zoomIdentity);
  assert.equal(lockedMask().feature.features.length, world.objects.countries.geometries.length);
  assert.equal(cloudDraws().length, 1);
  fills.length = 0;
  props.unlockedCountryIds = ['704'];
  await nextTick();
  assert.equal(lockedMask().feature.features.some(feature => feature.id === '704'), false);
  assert.equal(lockedMask().feature.features.some(feature => feature.id === '764'), true);
  assert.equal(clearedMasks().length, 2);
  assert.ok(clearedMasks().every(fill => fill.feature.features.length === 1 && fill.feature.features[0].id === '704'));
  fills.length = 0;
  images.length = 0;
  canvas.clientWidth = 400;
  harness.render(canvas, d3.zoomIdentity.translate(-300, -200).scale(12));
  assert.equal(lockedMask(), undefined, 'panning/zooming/resizing reuses the cached cloud layer');
  assert.equal(cloudDraws().length, 1);
  assert.deepEqual(transforms.slice(-2), [[-300, -200], [12, 12]]);
  images.length = 0;
  props.unlockedCountryIds = null;
  await nextTick();
  assert.equal(cloudDraws().length, 0);
});
