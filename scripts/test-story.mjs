import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { createPinia, setActivePinia, defineStore } from 'pinia';
import { PGlite } from '@electric-sql/pglite';

function load(path, dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { if (!(name in dependencies)) throw new Error(`Unexpected import ${name}`); return dependencies[name]; }, JSON, Set, Error, Object, Array, Promise }, { filename: path });
  return exports;
}
const utils = load('src/utils/story.ts', { './uuid': { createUuid: randomUUID } });
const { storyDemo } = load('src/data/storyDemo.ts', { '../utils/story': utils });
const clone = value => JSON.parse(JSON.stringify(value));

test('story runtime validator rejects broken branches, slots, markup URLs and malformed imports', () => {
  assert.equal(utils.validateStory(storyDemo).errors.length, 0);
  const mutations = [
    s => { s.schemaVersion = 2; }, s => { s.nodes[1].id = s.nodes[0].id; },
    s => { s.nodes[0].nextNodeId = randomUUID(); }, s => { s.nodes[0].characters[1].position = 'left'; },
    s => { s.nodes[0].background.url = 'javascript:alert(1)'; },
    s => { s.nodes[0].characters[0].characterId = 'missing'; },
    s => { s.nodes[0].dialogue.en = null; }, s => { s.nodes[3].choices[0].text.en = ''; },
    s => { s.nodes[6].nextNodeId = s.nodes[0].id; }, s => { s.nodes[0].audio.sfx = '//external.test/a.mp3'; },
  ];
  for (const mutate of mutations) { const script = clone(storyDemo); mutate(script); assert.ok(utils.validateStory(script).errors.length, mutate.toString()); }
  for (const malformed of [null, [], {}, { nodes: [null] }, { ...storyDemo, nodes: [null] }, { ...storyDemo, characters: [null] }]) assert.ok(utils.validateStory(malformed).errors.length);
});

test('playback requires explicit choices, preserves visited log and resumes without duplicating current entry', () => {
  setActivePinia(createPinia());
  const { useStoryPlaybackStore } = load('src/stores/player-story-playback-store.ts', { pinia: { defineStore }, '../utils/story': utils });
  const player = useStoryPlaybackStore(); player.load(storyDemo); player.started = true;
  player.textLength = 10; player.advance(); assert.equal(player.nodeId, storyDemo.startNodeId); assert.equal(player.revealed, 10);
  player.advance(); assert.equal(player.nodeId, storyDemo.nodes[1].id);
  player.advance(); player.advance(); assert.equal(player.nodeId, storyDemo.nodes[3].id);
  player.advance(); assert.equal(player.nodeId, storyDemo.nodes[3].id);
  player.overlay = 'log'; player.advance(storyDemo.nodes[3].choices[1].id); assert.equal(player.nodeId, storyDemo.nodes[3].id);
  player.overlay = ''; player.advance(storyDemo.nodes[3].choices[1].id); assert.equal(player.nodeId, storyDemo.nodes[5].id);
  player.advance(); player.advance(); assert.equal(player.completed, true); assert.equal(player.history.length, 6);
  assert.ok(!player.history.includes(storyDemo.nodes[4].id));
  const history = [...player.history]; player.load(storyDemo, history.at(-1), history.slice(0, -1)); assert.deepEqual([...player.history], history);
});

test('editor node edits preserve explicit graph and imports get a new chapter identity', async () => {
  setActivePinia(createPinia());
  const row = { id: storyDemo.id, draft: clone(storyDemo), revision: 2, published_version: 1, enabled: true, sort_order: 5 };
  const { useStoryEditorStore } = load('src/components/admin/admin-story/admin-story-editor-store.ts', { pinia: { defineStore }, '../../../data/supabaseStoryRepository': { supabaseStoryRepository: { draft: async () => row } }, '../../../data/storyDemo': { storyDemo }, '../../../utils/story': utils, '../../../utils/uuid': { createUuid: randomUUID } });
  const editor = useStoryEditorStore(); editor.newScript(true);
  assert.notEqual(editor.draft.id, storyDemo.id);
  const first = editor.draft.nodes[0], second = editor.draft.nodes[1];
  editor.addNode(); assert.equal(first.nextNodeId, editor.node.id); assert.equal(editor.node.nextNodeId, second.id);
  editor.removeNode(); assert.equal(first.nextNodeId, second.id);
  editor.reorder(second.id, first.id); assert.equal(first.nextNodeId, second.id);
  editor.importJson(JSON.stringify(storyDemo)); assert.notEqual(editor.draft.id, storyDemo.id);
  assert.equal(editor.revision, 0); assert.equal(editor.validation.errors.length, 0);
  await editor.select(storyDemo.id); assert.equal(editor.revision, 2); assert.equal(editor.publishedVersion, 1); assert.equal(editor.dirty, false);
});

test('library discards stale reads and retries ordered progress without mixing accounts', async () => {
  setActivePinia(createPinia());
  let resolveRelease;
  const calls = [], repository = {
    release: () => new Promise(resolve => { resolveRelease = resolve; }), progress: async () => null,
    saveProgress: async value => { calls.push(value.node_id); },
  };
  const { useStoryStore } = load('src/stores/player-story-store.ts', { pinia: { defineStore }, '../data/supabaseStoryRepository': { supabaseStoryRepository: repository }, '../data/storyDemo': { storyDemo, STORY_DEMO_ID: storyDemo.id }, '../utils/story': utils, '../i18n': { t: key => key } });
  const store = useStoryStore(); store.reset('a');
  const read = store.open(storyDemo.id); store.reset('b');
  resolveRelease({ script: storyDemo, version: 1 }); await read; assert.equal(store.script, null);
  const checkpoint = n => ({ story_id: storyDemo.id, version: 1, node_id: storyDemo.nodes[n].id, history: storyDemo.nodes.slice(0, n + 1).map(n => n.id), completed: false, skipped: false });
  await Promise.all([store.persist(checkpoint(0), 'b'), store.persist(checkpoint(1), 'b')]);
  assert.deepEqual(calls, [storyDemo.nodes[0].id, storyDemo.nodes[1].id]);
  repository.saveProgress = async () => { throw new Error('offline'); };
  await store.persist(checkpoint(2), 'b'); assert.ok(store.progressError); assert.equal(Object.keys(store.pendingProgress).length, 1);
  repository.saveProgress = async value => calls.push(value.node_id);
  await store.retryProgress(); assert.equal(store.progressError, ''); assert.equal(Object.keys(store.pendingProgress).length, 0);
  await store.persist(checkpoint(0), 'a'); assert.equal(calls.length, 3);
  store.reset('c'); assert.equal(store.progress, null); assert.equal(Object.keys(store.pendingProgress).length, 0);
});

test('Supabase story migration enforces drafts, publication snapshots, access, revisions and valid progress', async () => {
  const db = new PGlite(), owner = randomUUID(), other = randomUUID();
  const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA feature_control; CREATE SCHEMA storage;
      CREATE TABLE auth.users(id UUID PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::UUID $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE public.feature_flags(feature_key TEXT PRIMARY KEY,enabled BOOLEAN DEFAULT TRUE);
      CREATE TABLE feature_control.request_rules(feature_key TEXT,path TEXT,writes_only BOOLEAN,PRIMARY KEY(feature_key,path));
      CREATE FUNCTION public.feature_flags_is_admin() RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.admin',true),'false')='true' $$;
      CREATE FUNCTION public.feature_is_enabled(k TEXT) RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$ SELECT enabled FROM public.feature_flags WHERE feature_key=k $$;
      CREATE TABLE storage.buckets(id TEXT PRIMARY KEY,name TEXT,public BOOLEAN,file_size_limit BIGINT,allowed_mime_types TEXT[]);
      CREATE TABLE storage.objects(id UUID,bucket_id TEXT); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    `);
    await db.exec(readFileSync('scripts/supabase/migrations/20261117_story.sql', 'utf8'));
    await db.exec(readFileSync('scripts/supabase/migrations/20261117_story_media.sql', 'utf8'));
    await db.query('INSERT INTO auth.users VALUES($1),($2)', [owner, other]);
    await db.query("SELECT set_config('test.uid',$1,false),set_config('test.admin','false',false)", [owner]);
    await db.exec('SET ROLE authenticated');
    const catalog = await scalar('SELECT story_catalog()'); assert.equal(catalog.length, 1);
    assert.equal(await scalar('SELECT count(*) FROM story_scripts'), 0);
    await assert.rejects(scalar('SELECT story_save_draft($1,0,0)', [JSON.stringify(storyDemo)]), /STORY_ADMIN_REQUIRED/);
    await assert.rejects(db.query('UPDATE story_scripts SET enabled=false'), /permission denied/);
    await db.exec("SELECT set_config('test.admin','true',false)");
    const draft = clone(storyDemo); draft.id = randomUUID();
    const saved = await scalar('SELECT story_save_draft($1,0,5)', [JSON.stringify(draft)]); assert.equal(saved.revision, 1);
    assert.equal((await scalar('SELECT story_catalog()')).length, 1);
    const version = await scalar('SELECT story_publish($1,1)', [draft.id]); assert.equal(version, 1);
    const original = await scalar('SELECT story_get($1)', [draft.id]);
    draft.title.vi = 'Bản nháp sửa';
    await scalar('SELECT story_save_draft($1,1,5)', [JSON.stringify(draft)]);
    assert.equal((await scalar('SELECT story_get($1)', [draft.id])).script.title.vi, original.script.title.vi);
    await assert.rejects(scalar('SELECT story_publish($1,1)', [draft.id]), /STORY_REVISION_CONFLICT/);
    await assert.rejects(scalar('SELECT story_save_draft($1,1,5)', [JSON.stringify(draft)]), /STORY_REVISION_CONFLICT/);
    const broken = clone(draft); broken.nodes[0].nextNodeId = randomUUID();
    await assert.rejects(scalar('SELECT story_save_draft($1,2,0)', [JSON.stringify(broken)]), /STORY_INVALID_SCHEMA/);
    await db.exec("SELECT set_config('test.admin','false',false)");
    const history = [draft.nodes[0].id, draft.nodes[1].id];
    await db.query('SELECT story_save_progress($1,1,$2,$3,false,false)', [draft.id, history[1], JSON.stringify(history)]);
    assert.equal(await scalar('SELECT count(*) FROM story_progress'), 1);
    await assert.rejects(db.query('SELECT story_save_progress($1,1,$2,$3,true,false)', [draft.id, history[1], JSON.stringify(history)]), /STORY_INVALID_PROGRESS/);
    await assert.rejects(db.query('SELECT story_save_progress($1,1,$2,$3,false,false)', [draft.id, draft.nodes[5].id, JSON.stringify([history[0], draft.nodes[5].id])]), /STORY_INVALID_PROGRESS/);
    await db.query('SELECT story_save_progress($1,1,$2,$3,true,true)', [draft.id, history[1], JSON.stringify(history)]);
    await db.query("SELECT set_config('test.uid',$1,false)", [other]);
    assert.equal(await scalar('SELECT count(*) FROM story_progress'), 0);
    await db.exec("SELECT set_config('test.admin','true',false)");
    await scalar('SELECT story_unpublish($1)', [draft.id]);
    await assert.rejects(scalar('SELECT story_get($1)', [draft.id]), /STORY_NOT_FOUND/);
    await db.exec('RESET ROLE; UPDATE feature_flags SET enabled=false WHERE feature_key=\'story\'; SET ROLE authenticated');
    await assert.rejects(scalar('SELECT story_catalog()'), /STORY_DISABLED/);
  } finally { await db.close(); }
});
