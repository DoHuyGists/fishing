import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createPinia, setActivePinia, defineStore } from 'pinia';
import { PGlite } from '@electric-sql/pglite';

test('hidden flags block modal aliases and requests independently of enabled', async () => {
  const catalogExports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/data/featureAvailability.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports: catalogExports,
    require: () => JSON.parse(readFileSync('src/data/featureCatalog.json', 'utf8')),
  });
  const { modalFeatures, FEATURE_CATALOG } = catalogExports;
  const dependencies = {
    pinia: { defineStore },
    '../i18n': { i18n: { global: { locale: { value: 'en' } } }, t: key => key },
    '../data/featureAvailability': { modalFeatures, FEATURE_CATALOG },
    '../data/supabaseFeatureFlagRepository': { supabaseFeatureFlagRepository: {} },
    '../composables/useToast': { useToast: () => ({ warning() {} }) },
    './player-information-modal-store': { useInformationModalStore: () => ({ open() {} }) },
    '../utils/visibleRefresh': { startVisibleRefresh() {} },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/stores/player-feature-availability-store.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => dependencies[name], Date });
  setActivePinia(createPinia());
  const store = exports.useFeatureAvailabilityStore();
  store.ready = true;
  store.lastFetchedAt = Date.now();
  for (const [key, modal] of [['account', 'game-settings'], ['inventory', 'storage'], ['world-map', 'fishing-map'], ['market', 'market']]) {
    for (const enabled of [true, false]) {
      for (const is_visible of [true, false]) {
        store.flags[key] = { feature_key: key, enabled, is_visible };
        assert.equal(store.isVisible(key), is_visible);
        assert.equal(store.isModalVisible(modal), is_visible);
        assert.equal(store.canOpen(modal), enabled && is_visible);
        assert.equal(Boolean(await store.checkRequests([key])), !(enabled && is_visible));
      }
    }
  }
  assert.equal(store.isModalVisible('rule'), true);
  store.flags['world-map'] = { enabled: true, is_visible: true };
  store.flags['enter-area'] = { enabled: true, is_visible: false };
  assert.equal(store.canOpen('prepare'), false);
  assert.equal(store.isVisible('world-map'), true);
});

test('visibility migration blocks direct requests and helper access while preserving admin exemption and audit', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA feature_control;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'authenticated'::text $$;
      CREATE FUNCTION public.feature_flags_is_admin() RETURNS boolean LANGUAGE sql AS $$
        SELECT coalesce(current_setting('test.admin', true), 'false') = 'true'
      $$;
      CREATE TABLE public.feature_flags (
        feature_key text PRIMARY KEY, enabled boolean NOT NULL DEFAULT true,
        message_vi text DEFAULT '', message_en text DEFAULT '', updated_at timestamptz DEFAULT now()
      );
      CREATE TABLE feature_control.request_rules (feature_key text, path text, writes_only boolean);
      CREATE FUNCTION feature_control.stamp_flag() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN NEW.updated_at := clock_timestamp(); RETURN NEW; END;
      $$;
      INSERT INTO public.feature_flags (feature_key) VALUES ('market');
      INSERT INTO feature_control.request_rules VALUES ('market', 'rpc/buy_species_with_history', false);
    `);
    const migration = readFileSync('scripts/supabase/migrations/20261126_feature_flag_visibility.sql', 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    assert.equal((await db.query('SELECT is_visible FROM feature_flags')).rows[0].is_visible, true);
    await db.exec(`SELECT set_config('request.path', '/rpc/buy_species_with_history', false)`);
    for (const enabled of [true, false]) {
      for (const visible of [true, false]) {
        await db.query('UPDATE feature_flags SET enabled=$1, is_visible=$2', [enabled, visible]);
        assert.equal((await db.query(`SELECT public.feature_is_enabled('market') AS allowed`)).rows[0].allowed, enabled && visible);
        if (enabled && visible) await db.query('SELECT public.check_feature_request()');
        else await assert.rejects(db.query('SELECT public.check_feature_request()'), error => error.code === 'PT403');
      }
    }
    await db.exec(`SELECT set_config('test.admin', 'true', false)`);
    assert.equal((await db.query(`SELECT public.feature_is_enabled('market') AS allowed`)).rows[0].allowed, true);
    await db.query('SELECT public.check_feature_request()');
    await db.exec(`UPDATE feature_flags SET updated_at='2000-01-01'; UPDATE feature_flags SET is_visible=true;`);
    assert.equal((await db.query(`SELECT updated_at > '2000-01-01'::timestamptz AS stamped FROM feature_flags`)).rows[0].stamped, true);
    assert.equal((await db.query(`SELECT has_column_privilege('authenticated','public.feature_flags','is_visible','UPDATE') AS allowed`)).rows[0].allowed, true);
  } finally {
    await db.close();
  }
});
