import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright-core';

const executablePath = process.env.REFACTOR_TEST_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium',
].find(existsSync);
if (!executablePath) throw new Error('Set REFACTOR_TEST_BROWSER to an installed Chromium browser.');

const server = await createServer({ configFile: false, envDir: false, appType: 'custom',
  cacheDir: 'node_modules/.vite-module-refactoring-browser',
  server: { host: '127.0.0.1', port: 0, hmr: false },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://refactor-test.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key') },
  plugins: [vue(), tailwindcss(), {
    name: 'module-refactoring-fixture',
    configureServer(instance) {
      instance.middlewares.use('/__refactor', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><html><head><link rel="icon" href="data:,"></head><body><div id="app"></div><script type="module" src="/__refactor_fixture.ts"></script></body></html>');
      });
    },
    resolveId(id) { if (id === '/__refactor_fixture.ts') return id; },
    load(id) {
      if (id !== '/__refactor_fixture.ts') return;
      return `
        import { createApp, h, ref } from 'vue';
        import { createPinia } from 'pinia';
        import { i18n, t } from '/src/i18n/index.ts';
        import { useAuthStore } from '/src/stores/auth.ts';
        import { useFriendStore } from '/src/stores/player-friend-store.ts';
        import { useCountryStore } from '/src/stores/player-country-store.ts';
        import { useReadCacheStore } from '/src/stores/player-read-cache.ts';
        import { useEventStore } from '/src/stores/player-event-store.ts';
        import { supabaseEventScheduleRepository } from '/src/data/supabaseEventScheduleRepository.ts';
        import FriendModal from '/src/components/player/player-friend/FriendModal.vue';
        import TeamEditorForm from '/src/components/player/player-team/TeamEditorForm.vue';
        import TheBook from '/src/components/player/player-diary/TheBook.vue';
        import EventModal from '/src/components/player/player-event/EventModal.vue';
        import LakeMap from '/src/components/admin/admin-species-in-area/Map.vue';
        import '/src/styles/index.css';
        const pinia = createPinia(), auth = useAuthStore(pinia);
        auth.applySession({ user: { id: 'owner' } });
        const country = useCountryStore(pinia); country.fetchCountries = async () => {};
        useReadCacheStore(pinia).invalidate = async () => {};
        const friend = useFriendStore(pinia), events = [];
        friend.loadData = async () => {};
        friend.removeFriend = async id => { events.push(['remove', id]); };
        friend.respondFriendRequest = async (id, accept) => { events.push(['respond', id, accept]); };
        friend.sendFriendRequest = async id => { events.push(['send', id]); };
        friend.cancelFriendRequest = async id => { events.push(['cancel', id]); };
        friend.profiles = ['buddy','sender','recipient','stranger'].map(id => ({ id, display_name: id,
          level: 2, experience_point: 5, inventory_capacity: 10, species_storage_capacity: 10,
          country_id: null, avatar_url: null, created_at: '2026-01-01' }));
        friend.friends = [
          { id: 'accepted', user_id: 'owner', friend_id: 'buddy', status: 'ACCEPTED', created_at: '2026-01-01' },
          { id: 'received', user_id: 'sender', friend_id: 'owner', status: 'PENDING', created_at: '2026-01-01' },
          { id: 'sent', user_id: 'owner', friend_id: 'recipient', status: 'PENDING', created_at: '2026-01-01' },
        ];
        const panel = ref('book'), book = ref(), form = ref({ name: 'Draft', description: 'Keep me',
          maxMembers: 4, status: 'OPEN', joinType: 'everyone' }), loading = ref(false);
        let clock = Date.now();
        const realNow = Date.now; Date.now = () => clock;
        supabaseEventScheduleRepository.fetchAll = async () => [{ id: 'event', isDisabled: false,
          eventName: 'Clock event', viewCount: 0, start: new Date(clock + 10000).toISOString(),
          end: new Date(clock + 20000).toISOString() }];
        supabaseEventScheduleRepository.incrementViewCount = async () => {};
        const realSet = window.setInterval.bind(window), realClear = window.clearInterval.bind(window), intervals = new Set();
        window.setInterval = (...args) => {
          const id = realSet(...args);
          if (args[0].name === 'sync' && args[1] === 1000) intervals.add(id);
          return id;
        };
        window.clearInterval = id => { intervals.delete(id); return realClear(id); };
        i18n.global.locale.value = 'en';
        const app = createApp({ render: () => {
          if (panel.value === 'book') return h(TheBook, { ref: book, title: 'Diary', pages: [
            { title: 'One', content: 'First' }, { title: 'Two' }, { title: 'Three' }],
            onOpen: () => events.push(['open']), onClose: () => events.push(['close']) });
          if (panel.value === 'friends') return h(FriendModal);
          if (panel.value === 'team') return h(TeamEditorForm, { modelValue: form.value,
            'onUpdate:modelValue': value => { form.value = value; }, editing: true, loading: loading.value, error: '',
            onSubmit: () => events.push(['submit', JSON.parse(JSON.stringify(form.value))]) });
          if (panel.value === 'event') return h(EventModal);
          if (panel.value === 'map') return h(LakeMap);
          return h('div', 'closed');
        } });
        app.use(pinia); app.use(i18n); app.mount('#app');
        window.fixture = { panel, friend, form, loading, events, t, book,
          get intervalCount() { return intervals.size; },
          locale: value => { i18n.global.locale.value = value; },
          advance(ms) { clock += ms; window.dispatchEvent(new Event('focus')); },
          restoreClock() { Date.now = realNow; } };
      `;
    },
  }],
});

let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://refactor-test.supabase.co/**', route => route.abort());
  await page.goto(server.resolvedUrls.local[0] + '__refactor');
  await page.waitForFunction(() => Boolean(window.fixture));
  const show = panel => page.evaluate(value => { window.fixture.panel.value = value; }, panel);
  const label = key => page.evaluate(value => window.fixture.t(value), key);

  // The real book keeps external scoped styles, keyboard navigation and scroll cleanup.
  assert.equal(await page.locator('.book').evaluate(el => getComputedStyle(el).transformStyle), 'preserve-3d');
  await page.evaluate(() => window.fixture.locale('vi'));
  const viOpen = await page.evaluate(() => window.fixture.t('TheBook.open', { title: 'Diary' }));
  await page.getByRole('button', { name: viOpen, exact: true }).waitFor();
  await page.evaluate(() => window.fixture.locale('en'));
  await page.getByRole('button', { name: 'Open book Diary' }).click();
  await page.getByRole('button', { name: 'Next page' }).waitFor({ state: 'visible' });
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('.ctl-label')?.textContent.includes('2'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.fixture.events.some(event => event[0] === 'close'));
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  await page.evaluate(() => { void window.fixture.book.value.open(); });
  await show('closed');
  await page.waitForTimeout(1800);
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  assert.equal(await page.locator('.book-stage').count(), 0);

  await show('friends');
  await page.getByRole('button', { name: await label('FriendModal.xoa_ban'), exact: true }).click();
  await page.getByRole('button', { name: await label('FriendModal.xac_nhan_xoa'), exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.fixture.events.at(-1)), ['remove', 'buddy']);
  await page.evaluate(() => { window.fixture.friend.activeTab = 'received'; });
  await page.getByRole('button', { name: await label('FriendModal.dong_y'), exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.fixture.events.at(-1)), ['respond', 'received', true]);
  await page.evaluate(() => { window.fixture.friend.activeTab = 'sent'; });
  await page.getByRole('button', { name: await label('FriendModal.huy_loi_moi'), exact: true }).click();
  await page.getByRole('button', { name: await label('FriendModal.xac_nhan_xoa'), exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.fixture.events.at(-1)), ['cancel', 'sent']);
  await page.evaluate(() => { window.fixture.friend.activeTab = 'discover'; });
  await page.getByRole('button', { name: await label('FriendModal.them_ban'), exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.fixture.events.at(-1)), ['send', 'stranger']);

  await show('team');
  await page.locator('input[type=text]').fill('Edited team');
  await page.locator('textarea').fill('Edited description');
  await page.locator('button[type=submit]').click();
  const submitted = await page.evaluate(() => window.fixture.events.at(-1));
  assert.equal(submitted[0], 'submit'); assert.equal(submitted[1].name, 'Edited team');
  assert.equal(submitted[1].description, 'Edited description');
  await page.evaluate(() => { window.fixture.loading.value = true; });
  assert.equal(await page.locator('button[type=submit]').isDisabled(), true);

  await show('event');
  await page.getByText('Clock event', { exact: true }).first().waitFor();
  assert.ok(await page.getByText(await label('EventModal.sap_dien_ra'), { exact: true }).count());
  await page.evaluate(() => window.fixture.advance(11000));
  await page.getByText(await label('EventModal.dang_dien_ra'), { exact: true }).first().waitFor();
  await page.evaluate(() => window.fixture.advance(10000));
  await page.getByText(await label('EventModal.da_ket_thuc'), { exact: true }).first().waitFor();
  assert.equal(await page.evaluate(() => window.fixture.intervalCount), 1);
  await show('closed'); await page.waitForFunction(() => window.fixture.intervalCount === 0);

  await show('map');
  assert.ok(await page.locator('svg polygon, svg path').count());
  await page.getByRole('button', { name: 'Thêm vùng', exact: false }).click();
  assert.ok((await page.locator('#app').textContent()).includes('6/8'));
  assert.deepEqual(errors, []);
  console.log('Module browser checks passed: book lifecycle, four friend tabs, team form, event clock and lake controls.');
} finally {
  await browser?.close(); await server.close();
}
