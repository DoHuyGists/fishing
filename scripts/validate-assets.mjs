// node --test scripts/validate-assets.mjs
// Runs the real Pinia store and repository against controlled I/O, without network access.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { beforeEach, test } from 'node:test';
import ts from 'typescript';
import * as vue from 'vue';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import * as folders from '../src/utils/assetFolders.ts';

async function evaluate(path, dependencies) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    assert(id in dependencies, `Unexpected import: ${id}`);
    return dependencies[id];
  }, module, module.exports);
  return module.exports;
}

const repository = {};
const notices = [];
const { useAdminAssetsStore } = await evaluate('../src/components/admin/assets/admin-assets-store.ts', {
  vue, pinia: { defineStore },
  '../../../data/supabaseAssetRepository': { supabaseAssetRepository: repository },
  '../../../utils/assetFolders': folders,
  '../../../composables/useToast': { useToast: () => ({
    success: text => notices.push(text), error: text => notices.push(text),
  }) },
});

const sample = (id, folder = '', kind = 'image', name = `${id}.jpg`) => ({
  id, path: `physical/${id}_${name}`, folder, kind, name, size: 1024,
  createdAt: '2026-11-10T00:00:00Z', url: `https://example.test/${id}`,
});
const record = row => {
  const { createdAt, url, ...rest } = row;
  return { ...rest, created_at: createdAt };
};
const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { resolve, promise };
};

let queryHandler;
let storageUpload;
let storageRemove;
let queries;
let storageCalls;
const database = {
  from(table) {
    const query = { table, action: 'select', filters: [], order: [] };
    const builder = {
      select(columns) { query.columns = columns; return this; },
      insert(payload) { query.action = 'insert'; query.payload = payload; return this; },
      update(payload) { query.action = 'update'; query.payload = payload; return this; },
      delete() { query.action = 'delete'; return this; },
      eq(column, value) { query.filters.push([column, value]); return this; },
      order(column, options) { query.order.push([column, options]); return this; },
      range(from, to) { query.range = [from, to]; return this; },
      single() { query.single = true; return this; },
      maybeSingle() { query.maybeSingle = true; return this; },
      then(resolve, reject) {
        queries.push(query);
        return Promise.resolve().then(() => queryHandler(query)).then(resolve, reject);
      },
    };
    return builder;
  },
  async rpc(name, payload) {
    const query = { action: 'rpc', name, payload };
    queries.push(query);
    return queryHandler(query);
  },
  storage: { from(bucket) {
    assert.equal(bucket, 'admin-assets');
    return {
      getPublicUrl: path => ({ data: { publicUrl: `https://example.test/admin-assets/${path}` } }),
      upload: async (...args) => { storageCalls.push(['upload', ...args]); return storageUpload(...args); },
      remove: async (...args) => { storageCalls.push(['remove', ...args]); return storageRemove(...args); },
    };
  } },
};
const assetId = '00000000-0000-4000-8000-000000000001';
const { supabaseAssetRepository: actualRepository } = await evaluate('../src/data/supabaseAssetRepository.ts', {
  '../database/connection': { __esModule: true, default: database },
  '../utils/uuid': { createUuid: () => assetId },
  '../utils/assetFolders': folders,
});

beforeEach(() => {
  setActivePinia(createPinia());
  notices.length = 0;
  queries = [];
  storageCalls = [];
  storageUpload = async () => ({ data: {}, error: null });
  storageRemove = async () => ({ data: [], error: null });
  queryHandler = query => ({ data: query.action === 'insert'
    ? { ...query.payload, created_at: '2026-11-10T00:00:00Z' } : [], error: null });
  repository.fetchAll = async () => [];
  repository.moveFolder = async () => {};
  repository.move = async (id, folder) => ({ ...sample(id), folder });
  repository.upload = async (file, folder) => sample(file.name, folder);
  repository.remove = async () => {};
});

test('folder paths preserve Vietnamese, normalize segments, and reject ambiguous paths', () => {
  assert.equal(folders.normalizeAssetFolder(' Hướng dẫn / Cần câu '), 'Hướng dẫn/Cần câu/');
  assert.equal(folders.normalizeAssetFolder(''), '');
  assert.equal(folders.normalizeAssetFolder('a/b/'), 'a/b/');
  for (const value of ['/', '/a', 'a//b', 'a//', 'a/../b', './a', 'a\\b', 'a/\u0000/b', 'a'.repeat(500)]) {
    assert.throws(() => folders.normalizeAssetFolder(value), value);
  }
  assert.deepEqual(folders.assetFolderAncestors('a/b/'), ['a/', 'a/b/']);
  assert.equal(folders.replaceAssetFolderPrefix('ab/c/', 'a/', 'new/'), 'ab/c/');
});

test('grid and list scope files to the selected folder and optionally include descendants', () => {
  const store = useAdminAssetsStore();
  store.rows = [sample('root'), sample('one', 'a/'), sample('deep', 'a/b/'), sample('other', 'ab/')];
  assert.deepEqual(store.folderPaths, ['a/', 'a/b/', 'ab/']);
  for (const mode of ['grid', 'list']) {
    store.viewMode = mode;
    assert.deepEqual(store.filteredRows.map(row => row.id), ['root']);
    store.navigate('a/');
    assert.deepEqual(store.filteredRows.map(row => row.id), ['one']);
    assert.deepEqual(store.visibleEntries.filter(entry => entry.type === 'folder').map(entry => entry.folder), ['a/b/']);
    store.includeDescendants = true;
    assert.deepEqual(store.filteredRows.map(row => row.id), ['one', 'deep']);
    store.includeDescendants = false;
    store.navigate('');
  }
});

test('tree expands nested files, search reveals matching branches, and branches remain collapsible', () => {
  const store = useAdminAssetsStore();
  store.rows = [sample('root'), sample('deep', 'a/b/', 'image', 'Cần câu.jpg'), sample('video', 'a/', 'video'), sample('other', 'ab/')];
  store.viewMode = 'tree';
  assert.deepEqual(store.visibleEntries.map(entry => entry.key), ['folder:a/', 'folder:ab/', 'root']);
  store.expandAll();
  const deep = store.visibleEntries.find(entry => entry.key === 'deep');
  assert.equal(deep.depth, 2);
  store.search = 'CẦN CÂU';
  assert.deepEqual(store.visibleEntries.map(entry => entry.key), ['folder:a/', 'folder:a/b/', 'deep']);
  store.toggleFolder('a/');
  assert.deepEqual(store.visibleEntries.map(entry => entry.key), ['folder:a/']);
  store.expandAll();
  store.kind = 'video';
  assert.deepEqual(store.visibleEntries, []);
});

test('creating nested empty folders is session-only and does not call the database', async () => {
  const store = useAdminAssetsStore();
  store.openFolderDialog('create');
  store.folderInput = 'Hướng dẫn/Câu cá/';
  await store.saveFolder();
  assert.deepEqual(store.folderPaths, ['Hướng dẫn/', 'Hướng dẫn/Câu cá/']);
  assert.equal(store.currentFolder, 'Hướng dẫn/Câu cá/');
  assert.equal(store.folderDialog, null);
  store.resetView();
  assert.equal(store.folderPaths.length, 2);
  setActivePinia(createPinia());
  assert.deepEqual(useAdminAssetsStore().folderPaths, []);
});

test('moving a folder updates its entire branch without changing Storage paths or public URLs', async () => {
  const store = useAdminAssetsStore();
  const original = [sample('one', 'a/'), sample('deep', 'a/b/'), sample('outside', 'ab/')];
  store.rows = original;
  store.navigate('a/b/');
  let calls = 0;
  repository.moveFolder = async (from, to) => {
    calls++;
    assert.equal(from, 'a/');
    assert.equal(to, 'Hướng dẫn/');
  };
  store.openFolderDialog('move-folder', 'a/');
  store.folderInput = 'Hướng dẫn/';
  await store.saveFolder();
  assert.equal(calls, 1);
  assert.deepEqual(store.rows.map(row => row.folder), ['Hướng dẫn/', 'Hướng dẫn/b/', 'ab/']);
  assert.equal(store.currentFolder, 'Hướng dẫn/b/');
  assert.deepEqual(store.rows.map(({ id, path, url }) => ({ id, path, url })), original.map(({ id, path, url }) => ({ id, path, url })));
});

test('folder moves reject descendants, collisions and oversized descendants before any write', async () => {
  const store = useAdminAssetsStore();
  store.rows = [sample('one', 'a/'), sample('deep', `a/${'b'.repeat(490)}/`), sample('other', 'existing/')];
  repository.moveFolder = async () => { assert.fail('Invalid folder move reached the repository'); };
  for (const target of ['a/inside/', 'existing/', '', `${'x'.repeat(20)}/`]) {
    store.openFolderDialog('move-folder', 'a/');
    store.folderInput = target;
    await store.saveFolder();
    assert(store.folderError, target);
    assert.equal(store.rows[0].folder, 'a/');
  }
});

test('moving a file can create a logical path or return it to root without touching its URL', async () => {
  const store = useAdminAssetsStore();
  const row = sample('one', 'old/');
  store.rows = [row];
  repository.move = async (id, folder) => ({ ...row, folder });
  for (const target of ['new/nested/', '']) {
    store.requestMove(store.rows[0]);
    store.folderInput = target;
    await store.saveFolder();
    assert.equal(store.rows[0].folder, target);
    assert.equal(store.rows[0].url, row.url);
    assert.equal(store.rows[0].path, row.path);
  }
});

test('failed folder moves keep the old state and prevent duplicate writes while saving', async () => {
  const store = useAdminAssetsStore();
  store.rows = [sample('one', 'a/')];
  const pending = deferred();
  let calls = 0;
  repository.moveFolder = async () => { calls++; await pending.promise; throw new Error('Database unavailable'); };
  store.openFolderDialog('move-folder', 'a/');
  store.folderInput = 'new/';
  const first = store.saveFolder();
  await store.saveFolder();
  store.navigate('elsewhere/');
  store.cancelFolderDialog();
  assert.equal(store.busy, true);
  assert.equal(store.currentFolder, '');
  assert(store.folderDialog);
  pending.resolve();
  await first;
  assert.equal(calls, 1);
  assert.equal(store.rows[0].folder, 'a/');
  assert.equal(store.folderError, 'Database unavailable');
  assert.equal(store.busy, false);
});

test('batch uploads use a fixed destination, report partial errors, and keep successful files', async () => {
  const store = useAdminAssetsStore();
  store.navigate('a/');
  const pending = deferred();
  const destinations = [];
  repository.upload = async (file, folder) => {
    destinations.push(folder);
    if (file.name === 'bad') throw new Error('Unsupported file');
    await pending.promise;
    return sample(file.name, folder);
  };
  const upload = store.upload([{ name: 'ok' }, { name: 'bad' }]);
  store.navigate('other/');
  await store.upload([{ name: 'duplicate' }]);
  assert.equal(store.currentFolder, 'a/');
  pending.resolve();
  await upload;
  assert.deepEqual(destinations, ['a/', 'a/']);
  assert.equal(store.completed, 2);
  assert.equal(store.rows.length, 1);
  assert.match(store.uploadErrors[0], /bad: Unsupported file/);
});

test('failed deletions retain metadata and allow a retry', async () => {
  const store = useAdminAssetsStore();
  store.rows = [sample('one')];
  store.requestDelete(store.rows[0]);
  repository.remove = async () => { throw new Error('Retry deletion'); };
  await store.remove();
  assert.equal(store.rows.length, 1);
  assert(store.deleting);
  assert.equal(store.deleteError, 'Retry deletion');
  repository.remove = async () => {};
  await store.remove();
  assert.equal(store.rows.length, 0);
  assert.equal(store.deleting, null);
});

test('refresh returns to an existing ancestor if the active folder was removed elsewhere', async () => {
  const store = useAdminAssetsStore();
  store.navigate('a/removed/');
  repository.fetchAll = async () => [sample('one', 'a/')];
  await store.fetchRows();
  assert.equal(store.currentFolder, 'a/');
});

test('repository paginates metadata and generates public URLs from the original Storage paths', async () => {
  queryHandler = query => {
    assert.equal(query.table, 'assets');
    assert.deepEqual(query.order, [['created_at', { ascending: false }], ['id', { ascending: true }]]);
    const [offset] = query.range;
    return { data: Array.from({ length: offset === 0 ? 1000 : 1 }, (_, index) => record(sample(String(offset + index), 'nested/'))), error: null };
  };
  const rows = await actualRepository.fetchAll();
  assert.equal(rows.length, 1001);
  assert.deepEqual(queries.map(query => query.range), [[0, 999], [1000, 1999]]);
  assert.equal(rows[0].url, 'https://example.test/admin-assets/physical/0_0.jpg');
  assert.equal(rows[0].folder, 'nested/');
  assert.deepEqual(storageCalls, []);
});

test('repository uploads into a stable physical path and persists the normalized logical folder', async () => {
  const row = await actualRepository.upload(new File(['image'], 'Cần câu.png', { type: 'image/png' }), ' Hướng dẫn / Cá ');
  assert.equal(row.folder, 'Hướng dẫn/Cá/');
  assert.equal(row.path, `${assetId}_Can-cau.png`);
  assert.equal(queries[0].payload.folder, 'Hướng dẫn/Cá/');
  assert.equal(storageCalls[0][1], row.path);
});

test('definitive metadata rejection cleans up the uploaded object even when the table is missing', async () => {
  queryHandler = () => ({ data: null, error: { code: 'PGRST205', message: 'Table missing' } });
  await assert.rejects(actualRepository.upload(new File(['image'], 'one.png', { type: 'image/png' })), /Table missing/);
  assert.equal(queries.length, 1);
  assert.deepEqual(storageCalls.map(call => call[0]), ['upload', 'remove']);
});

test('lost insert response recovers the committed record without deleting its image', async () => {
  const existing = record({ ...sample(assetId, 'a/'), path: `${assetId}_one.png` });
  queryHandler = query => query.action === 'insert'
    ? { data: null, error: { code: '', message: 'Network lost' } }
    : { data: existing, error: null };
  const row = await actualRepository.upload(new File(['image'], 'one.png', { type: 'image/png' }), 'a/');
  assert.equal(row.id, assetId);
  assert.deepEqual(storageCalls.map(call => call[0]), ['upload']);
});

test('uncertain insert and failed verification preserve the object and ask to refresh', async () => {
  queryHandler = () => ({ data: null, error: { code: '', message: 'Network lost' } });
  await assert.rejects(actualRepository.upload(new File(['image'], 'one.png', { type: 'image/png' })), /Hãy làm mới/);
  assert.deepEqual(storageCalls.map(call => call[0]), ['upload']);
});

test('repository move writes only folder metadata and branch move uses one RPC', async () => {
  queryHandler = query => ({ data: query.action === 'update' ? record(sample('one', query.payload.folder)) : null, error: null });
  await actualRepository.move('one', 'new/folder');
  assert.deepEqual(queries[0].payload, { folder: 'new/folder/' });
  await actualRepository.moveFolder('a/', 'b/');
  assert.deepEqual(queries[1], { action: 'rpc', name: 'assets_move_folder', payload: { source_folder: 'a/', target_folder: 'b/' } });
  assert.deepEqual(storageCalls, []);
});

test('repository never deletes metadata when Storage fails; missing objects allow deletion retries', async () => {
  storageRemove = async () => ({ error: { message: 'Storage failed' } });
  await assert.rejects(actualRepository.remove(sample('one')), /Storage failed/);
  assert.equal(queries.length, 0);
  storageRemove = async () => ({ data: [], error: null });
  queryHandler = () => ({ data: null, error: { message: 'Database failed' } });
  await assert.rejects(actualRepository.remove(sample('one')), /Hãy thử xóa lại/);
  queryHandler = () => ({ data: { id: 'one' }, error: null });
  await actualRepository.remove(sample('one'));
  assert.deepEqual(queries.at(-1).filters, [['id', 'one']]);
});
