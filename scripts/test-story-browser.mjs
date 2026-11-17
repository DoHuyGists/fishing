import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright-core';

const executablePath = process.env.STORY_TEST_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium',
].find(existsSync);
if (!executablePath) throw new Error('Set STORY_TEST_BROWSER to an installed Chromium browser.');
const server = await createServer({ configFile: false, envDir: false, appType: 'custom', cacheDir: 'node_modules/.vite-story-browser',
  server: { host: '127.0.0.1', port: 0, hmr: false },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://story-test.supabase.co'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key') },
  plugins: [vue(), tailwindcss(), {
    name: 'story-browser-fixture',
    configureServer(instance) { instance.middlewares.use('/__story', (_req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__story_fixture.ts"></script></body></html>'); }); },
    resolveId(id) { if (id === '/__story_fixture.ts') return id; },
    load(id) {
      if (id !== '/__story_fixture.ts') return;
      return `
        import { createApp, h } from 'vue';
        import { createPinia } from 'pinia';
        import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
        import StoryView from '/src/views/StoryView.vue';
        import AdminView from '/src/views/AdminView.vue';
        import { useStoryStore } from '/src/stores/story.ts';
        import { useStoryPlaybackStore } from '/src/stores/storyPlayback.ts';
        import { useStoryEditorStore } from '/src/stores/storyEditor.ts';
        import { useAuthStore } from '/src/stores/auth.ts';
        import { useFeatureAvailabilityStore } from '/src/stores/featureAvailability.ts';
        import { supabaseStoryRepository as repository } from '/src/data/supabaseStoryRepository.ts';
        import { FEATURE_CATALOG } from '/src/data/featureAvailability.ts';
        import { storyDemo } from '/src/data/storyDemo.ts';
        import { i18n } from '/src/i18n/index.ts';
        import '/src/styles/index.css';
        const clone = value => JSON.parse(JSON.stringify(value));
        const pinia = createPinia(), auth = useAuthStore(pinia), stories = useStoryStore(pinia);
        auth.user = { id: 'owner' }; auth.initialized = true; auth.isAdmin = true; stories.reset('owner');
        const features = useFeatureAvailabilityStore(pinia); features.ready = true;
        features.flags = Object.fromEntries(FEATURE_CATALOG.map(f => [f.key, { feature_key: f.key, enabled: true }]));
        let rows = [], progress = null, published = null;
        repository.catalog = async () => published ? [{ id: published.script.id, version: published.version, title: published.script.title, summary: published.script.summary, sort_order: 0 }] : [];
        repository.drafts = async () => rows.map(({ draft, ...row }) => ({ ...clone(row), title: clone(draft.title) }));
        repository.draft = async id => clone(rows.find(row => row.id === id)); repository.media = async () => [];
        repository.progress = async () => clone(progress);
        repository.saveProgress = async value => { progress = clone(value); };
        repository.release = async () => clone(published);
        repository.save = async (script, revision, sort_order) => {
          const row = { id: script.id, draft: clone(script), revision: revision + 1, sort_order, enabled: false, published_version: null };
          rows = [row]; return { id: row.id, revision: row.revision, published_version: null };
        };
        repository.publish = async id => { const row = rows.find(r => r.id === id); row.enabled = true; row.published_version = 1; published = { script: clone(row.draft), story_id: id, version: 1 }; return 1; };
        const router = createRouter({ history: createMemoryHistory(), routes: [
          { path: '/story', name: 'story', component: StoryView },
          { path: '/admin', name: 'admin', component: AdminView },
          { path: '/', name: 'home', component: { render: () => h('div', 'Lobby') } },
        ] });
        const app = createApp({ render: () => h(RouterView) }); app.use(pinia); app.use(i18n); app.use(router);
        await router.push('/story?id=' + storyDemo.id + '&demo=1'); await router.isReady(); app.mount('#app');
        window.storyTest = { stories, player: useStoryPlaybackStore(pinia), editor: useStoryEditorStore(pinia), i18n, router, auth, features, getProgress: () => progress };
      `;
    },
  }],
});
let browser, page;
const errors = [];
try {
  await server.listen();
  browser = await chromium.launch({ executablePath, headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
  await page.goto(server.resolvedUrls.local[0] + '__story');
  await page.getByRole('button', { name: 'Bắt đầu / Tiếp tục →', exact: true }).click();
  await page.waitForFunction(() => storyTest.player.revealed > 0 && storyTest.player.textLength > 0);
  await page.locator('.story-dialogue').click();
  assert.equal(await page.evaluate(() => storyTest.player.typing), false);
  await page.getByRole('button', { name: 'Lịch sử thoại', exact: true }).click();
  await page.getByRole('dialog', { name: 'Lịch sử thoại', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.story-player').focus(); await page.keyboard.press('h');
  assert.equal(await page.locator('.story-dialogue').count(), 0);
  await page.locator('.story-stage').click({ position: { x: 600, y: 350 } });
  await page.locator('.story-dialogue').waitFor();
  await page.getByRole('button', { name: 'Bỏ qua »', exact: true }).click();
  await page.getByRole('dialog', { name: 'Bỏ qua chương này?', exact: true }).getByRole('button', { name: 'Hủy', exact: true }).click();
  for (let index = 0; index < 3; index++) {
    await page.evaluate(() => { storyTest.player.revealed = storyTest.player.textLength; });
    await page.locator('.story-player').focus(); await page.keyboard.press('Space');
  }
  await page.evaluate(() => { storyTest.player.revealed = storyTest.player.textLength; storyTest.player.auto = true; storyTest.player.autoProgress = 0.99; });
  await page.getByRole('button', { name: '◇ Quan sát từ vị trí an toàn', exact: true }).waitFor();
  const choiceNode = await page.evaluate(() => storyTest.player.nodeId);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => storyTest.player.nodeId), choiceNode, 'Auto must wait for a choice');
  await page.getByRole('button', { name: '◇ Quan sát từ vị trí an toàn', exact: true }).click();
  assert.equal(await page.evaluate(() => storyTest.player.history.length), 5);
  await page.evaluate(() => { storyTest.player.auto = false; storyTest.player.revealed = storyTest.player.textLength; });
  await page.waitForFunction(() => [...document.querySelectorAll('.story-effect-overlay')].every(el => getComputedStyle(el).opacity === '0'));
  mkdirSync('artifacts/story', { recursive: true });
  await page.screenshot({ path: 'artifacts/story/player-desktop.png' });
  await page.evaluate(() => { storyTest.i18n.global.locale.value = 'en'; });
  await page.getByRole('button', { name: 'Dialogue log', exact: true }).click();
  await page.getByRole('dialog', { name: 'Dialogue log', exact: true }).waitFor();
  assert.equal(await page.locator('.story-log-entry').count(), 5);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { storyTest.player.node.dialogue.en = '<strong>Hello 👨‍👩‍👧‍👦</strong><img src=x onerror="window.storyXss=true"><span style="color:#7dd3fc">Safe</span>'; });
  await page.waitForFunction(() => storyTest.player.textLength === 11);
  assert.equal(await page.evaluate(() => window.storyXss), undefined);
  assert.equal(await page.locator('.story-dialogue img').count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/story/player-mobile.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('button', { name: 'Skip »', exact: true }).click();
  await page.getByRole('dialog', { name: 'Skip this chapter?', exact: true }).getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByText('Chapter complete', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => storyTest.player.skipped), true);
  await page.evaluate(() => { storyTest.i18n.global.locale.value = 'vi'; storyTest.router.push('/admin?module=story'); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Truyện mẫu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Xác nhận thao tác', exact: true }).getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.story-node-card').length === 7);
  await page.getByLabel('Thoại · VI', { exact: true }).fill('Chào bạn! Đây là bản thử nghiệm đầy đủ.');
  await page.getByRole('button', { name: '＋ Thêm', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.story-node-card').length === 8);
  await page.getByRole('button', { name: 'Xóa', exact: true }).click();
  await page.getByRole('dialog', { name: 'Xác nhận thao tác', exact: true }).getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.story-node-card').length === 7);
  const selected = await page.evaluate(() => storyTest.editor.selectedId);
  await page.getByRole('button', { name: '▶ Play Test', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu / Tiếp tục →', exact: true }).click();
  await page.getByRole('button', { name: '← Biên tập kịch bản', exact: true }).click();
  await page.locator('.story-editor').waitFor();
  assert.equal(await page.evaluate(() => storyTest.editor.selectedId), selected);
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  assert.match((await downloadPromise).suggestedFilename(), /^story-.*\.json$/);
  const imported = await page.evaluate(() => ({ id: storyTest.editor.draft.id, json: JSON.stringify(storyTest.editor.draft) }));
  await page.locator('input[accept=".json,application/json"]').setInputFiles({ name: 'sample.json', mimeType: 'application/json', buffer: Buffer.from(imported.json, 'utf8') });
  await page.getByRole('dialog', { name: 'Xác nhận thao tác', exact: true }).getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.waitForFunction(oldId => storyTest.editor.draft.id !== oldId, imported.id);
  assert.equal(await page.locator('.story-node-card').count(), 7);
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  await page.waitForFunction(() => storyTest.editor.notice === 'Đã lưu bản nháp lên Supabase.');
  await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
  await page.getByRole('dialog', { name: 'Xác nhận thao tác', exact: true }).getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.waitForFunction(() => storyTest.editor.notice === 'Đã lưu và xuất bản phiên bản mới.');
  await page.screenshot({ path: 'artifacts/story/editor-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/story/editor-mobile.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.evaluate(() => { storyTest.router.push('/story?id=' + storyTest.editor.draft.id); });
  await page.getByRole('button', { name: 'Bắt đầu / Tiếp tục →', exact: true }).click();
  await page.waitForFunction(() => storyTest.getProgress()?.version === 1);
  assert.equal(await page.evaluate(() => storyTest.getProgress().completed), false);
  const publishedId = await page.evaluate(() => storyTest.editor.draft.id);
  await page.evaluate(() => storyTest.router.push('/story'));
  await page.locator('.story-library-page').waitFor();
  await page.evaluate(id => storyTest.router.push('/story?id=' + id), publishedId);
  await page.getByRole('dialog', { name: 'Tiếp tục hành trình', exact: true }).getByRole('button', { name: 'Đọc tiếp', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu / Tiếp tục →', exact: true }).click();
  assert.equal(await page.evaluate(() => storyTest.player.history.length), 1, 'Resume must not duplicate the current log entry');
  await page.evaluate(() => { storyTest.features.flags.story.enabled = false; });
  await page.locator('.story-empty-screen').waitFor();
  assert.equal(await page.locator('.story-player').count(), 0);
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log('Story browser checks passed: playback, branch gating, log, hide, skip, i18n, markup safety, mobile, editor, preview, export, publish, progress and feature switch.');
} catch (error) {
  console.error('Browser errors:', errors);
  console.error('Visible page:', await page?.locator('body').innerText());
  console.error('Playback state:', await page?.evaluate(() => window.storyTest && ({ revealed: storyTest.player.revealed, textLength: storyTest.player.textLength, paused: storyTest.player.paused, blocked: storyTest.player.blocked, started: storyTest.player.started, node: storyTest.player.nodeId, choices: storyTest.player.node?.choices, text: document.querySelector('.story-dialogue')?.textContent })));
  throw error;
} finally { await browser?.close(); await server.close(); }
