import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const session = id => ({ user: { id }, access_token: 'test-' + id });

test('snapshot stores preserve the selected page and login under reordered responses', async t => {
  // SSR only loads local modules. Repository methods below are replaced before
  // any action runs; this suite never sends requests to Supabase.
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
    envDir: false,
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://example.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
    },
  });
  try {
    const { useAuthStore } = await server.ssrLoadModule('/src/stores/auth.ts');
    const { useMarketStore } = await server.ssrLoadModule('/src/stores/market.ts');
    const { supabaseMarketRepository: marketRepo } = await server.ssrLoadModule('/src/data/supabaseMarketRepository.ts');
    const { useNotificationStore } = await server.ssrLoadModule('/src/stores/notification.ts');
    const { supabaseNotificationRepository: notificationRepo } = await server.ssrLoadModule('/src/data/supabaseNotificationRepository.ts');
    const { useUserProfileStore } = await server.ssrLoadModule('/src/stores/userProfile.ts');
    const { supabaseUserProfileRepository: profileRepo } = await server.ssrLoadModule('/src/data/supabaseUserProfileRepository.ts');
    const { setFeatureRequestGuard } = await server.ssrLoadModule('/src/database/featureRequestGate.ts');

    await t.test('market queries filter and sort before applying a bounded server page', async () => {
      const originalFetch = globalThis.fetch;
      let requested;
      setFeatureRequestGuard(async () => null);
      globalThis.fetch = async input => {
        requested = new URL(input instanceof Request ? input.url : String(input));
        assert.equal(requested.origin, 'https://example.supabase.co');
        return Response.json([{ id: 'listing', price: '123', caught: { id: 'fish', species: { name: 'fish%_', rarity: 'RARE' } } }]);
      };
      try {
        const rows = await marketRepo.fetchActiveListings({ page: 2, pageSize: 25, search: 'fish%_', rarity: 'RARE', sort: 'price-asc', userId: 'a' });
        assert.equal(requested.searchParams.get('offset'), '25');
        assert.equal(requested.searchParams.get('limit'), '26');
        assert.equal(requested.searchParams.get('user_id'), 'eq.a');
        assert.equal(requested.searchParams.get('caught.species.name'), 'ilike.%fish\\%\\_%');
        assert.equal(requested.searchParams.get('caught.species.rarity'), 'eq.RARE');
        assert.equal(requested.searchParams.get('order'), 'price.asc,created_at.desc,id.desc');
        assert.match(requested.searchParams.get('select'), /caught_id!inner/);
        assert.equal(rows[0].price, 123);
      } finally { globalThis.fetch = originalFetch; }
    });

    await t.test('page 1 -> page 2 -> page 1 shares reads without painting page 2', async () => {
      setActivePinia(createPinia());
      const auth = useAuthStore(); auth.applySession(session('a'));
      const store = useMarketStore();
      const one = deferred(), two = deferred();
      let calls = 0;
      marketRepo.fetchActiveListings = query => { calls++; return query.page === 1 ? one.promise : two.promise; };
      const a = store.loadMarketListings(); await flush();
      store.listingPage = 2;
      const b = store.loadMarketListings(); await flush();
      store.listingPage = 1;
      const c = store.loadMarketListings(); await flush();
      assert.equal(calls, 2);
      two.resolve([{ id: 'page2' }]); await b;
      assert.deepEqual(store.marketListings, []);
      one.resolve(Array.from({ length: 26 }, (_, id) => ({ id: 'page1-' + id })));
      await Promise.all([a, c]);
      assert.equal(store.marketListings[0].id, 'page1-0');
      assert.equal(store.marketListings.length, 25);
      assert.equal(store.listingHasNext, true);
      assert.equal(store.isLoadingMarket, false);
    });

    await t.test('late profile responses from an earlier login are discarded', async () => {
      setActivePinia(createPinia());
      const auth = useAuthStore(); auth.applySession(session('a'));
      const store = useUserProfileStore();
      const old = deferred();
      profileRepo.fetchUserProfile = id => id === 'a' ? old.promise : Promise.resolve({ id: 'b', level: 9 });
      const a = store.fetchProfile('a'); await flush();
      auth.applySession(session('b'));
      await store.fetchProfile('b');
      old.resolve({ id: 'a', level: 1 }); await a;
      assert.equal(store.profile.id, 'b');
      assert.equal(store.profile.level, 9);
      assert.equal(store.loading, false);
    });

    await t.test('closing and reopening notifications shares a read and still applies its result', async () => {
      setActivePinia(createPinia());
      const auth = useAuthStore(); auth.applySession(session('a'));
      const store = useNotificationStore();
      const read = deferred();
      let calls = 0;
      notificationRepo.fetchNotifications = () => { calls++; return read.promise; };
      const first = store.loadNotifications('a'); await flush();
      store.stopRefreshing('modal');
      const second = store.loadNotifications('a');
      read.resolve({ personal: [{ id: 'new', is_read: false }], system: [] });
      await Promise.all([first, second]);
      assert.equal(calls, 1);
      assert.equal(store.unreadCount, 1);
      assert.equal(store.loading, false);
      store.stopRefreshing('modal');
    });

    await t.test('closing the team panel changes the polling interval without fetching again', async () => {
      const previousDocument = globalThis.document, previousWindow = globalThis.window;
      globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
      globalThis.window = new EventTarget();
      const { useTeamStore } = await server.ssrLoadModule('/src/stores/team.ts');
      const { supabaseTeamRepository: teamRepo } = await server.ssrLoadModule('/src/data/supabaseTeamRepository.ts');
      setActivePinia(createPinia());
      useAuthStore().applySession(session('a'));
      const store = useTeamStore(); let calls = 0;
      teamRepo.fetchMyTeam = async () => { calls++; return null; };
      teamRepo.fetchMyInvites = async () => [];
      teamRepo.fetchTeams = async () => [];
      try {
        store.startRefreshing('a', 'lobby'); await flush();
        assert.equal(calls, 1);
        store.startRefreshing('a', 'panel');
        await store.loadData('a', false);
        assert.equal(calls, 2);
        store.stopRefreshing('panel'); await flush();
        assert.equal(calls, 2, 'Closing must not issue another membership request');
        store.startRefreshing('a', 'lobby'); await flush();
        assert.equal(calls, 2, 'Registering an existing consumer must not restart polling');
      } finally {
        store.stopRefreshing('panel'); store.stopRefreshing('lobby');
        if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
        if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
      }
    });
  } finally { await server.close(); }
});
