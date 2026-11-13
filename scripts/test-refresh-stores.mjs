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
    const { useFriendStore } = await server.ssrLoadModule('/src/stores/friend.ts');
    const { supabaseFriendRepository: friendRepo } = await server.ssrLoadModule('/src/data/supabaseFriendRepository.ts');
    const { useInventoryStore } = await server.ssrLoadModule('/src/stores/inventory.ts');
    const { supabaseUserInventoryRepository: inventoryRepo } = await server.ssrLoadModule('/src/data/supabaseUserInventoryRepository.ts');
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
        const rows = await marketRepo.fetchActiveListings({ page: 2, pageSize: 10, search: 'fish%_', rarity: 'RARE', sort: 'price-asc', userId: 'a' });
        assert.equal(requested.searchParams.get('offset'), '10');
        assert.equal(requested.searchParams.get('limit'), '10');
        assert.equal(requested.searchParams.get('user_id'), 'eq.a');
        assert.equal(requested.searchParams.get('caught.species.name'), 'ilike.%fish\\%\\_%');
        assert.equal(requested.searchParams.get('caught.species.rarity'), 'eq.RARE');
        assert.equal(requested.searchParams.get('order'), 'price.asc,created_at.desc,id.desc');
        assert.match(requested.searchParams.get('select'), /caught_id!inner/);
        assert.equal(rows.items[0].price, 123);
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
      two.resolve({ items: [{ id: 'page2' }], total: 20 }); await b;
      assert.deepEqual(store.marketListings, []);
      one.resolve({ items: Array.from({ length: 10 }, (_, id) => ({ id: 'page1-' + id })), total: 20 });
      await Promise.all([a, c]);
      assert.equal(store.marketListings[0].id, 'page1-0');
      assert.equal(store.marketListings.length, 10);
      assert.equal(store.listingHasNext, true);
      assert.equal(store.isLoadingMarket, false);
    });

    await t.test('notification pages keep unread totals independent from the five visible rows', async () => {
      const originalFetch = globalThis.fetch;
      const requested = [];
      setFeatureRequestGuard(async () => null);
      globalThis.fetch = async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        const head = (init?.method ?? (input instanceof Request ? input.method : 'GET')) === 'HEAD';
        const table = url.pathname.split('/').at(-1);
        requested.push({ url, head });
        if (head) return new Response(null, { headers: { 'content-range': table === 'personal_notifications' ? '*/12' : '*/8' } });
        if (url.searchParams.get('select') === 'expires_at') return Response.json({ expires_at: '2026-11-15T00:00:00Z' });
        if (table === 'system_notification_reads') return Response.json([{ notification_id: 'system-1' }]);
        const personal = table === 'personal_notifications';
        const rows = Array.from({ length: 5 }, (_, i) => ({ id: `${personal ? 'personal' : 'system'}-${i}`, is_read: false }));
        return Response.json(rows, { headers: { 'content-range': `5-9/${personal ? 40 : 20}` } });
      };
      try {
        const result = await notificationRepo.fetchNotifications('a', 2, 2);
        assert.equal(result.personal.length, 5); assert.equal(result.system.length, 5);
        assert.equal(result.personalUnread, 12); assert.equal(result.systemUnread, 12);
        assert.equal(result.system[1].is_read, true);
        assert.equal(result.nextSystemExpiry, '2026-11-15T00:00:00Z');
        for (const { url } of requested.filter(r => !r.head && r.url.searchParams.get('select')?.includes('title'))) {
          assert.equal(url.searchParams.get('offset'), '5'); assert.equal(url.searchParams.get('limit'), '5');
        }
        const reads = requested.find(r => !r.head && r.url.pathname.endsWith('system_notification_reads'));
        assert.match(reads.url.searchParams.get('notification_id'), /^in\./);
      } finally { globalThis.fetch = originalFetch; }
    });

    await t.test('friend search discards old pages and preserves global tab counts', async () => {
      setActivePinia(createPinia());
      useAuthStore().applySession(session('a'));
      const store = useFriendStore();
      const old = deferred();
      const counts = { friends: 23, sent: 4, received: 3, discover: 100 };
      friendRepo.fetchPage = async (_tab, search) => search ? { profiles: [{ id: 'found' }], friends: [], total: 1, counts } : old.promise;
      const first = store.loadData('a'); await flush();
      store.search = 'needle';
      await store.loadData('a', 1);
      old.resolve({ profiles: [{ id: 'old' }], friends: [], total: 100, counts });
      await first;
      assert.equal(store.profiles[0].id, 'found');
      assert.equal(store.total, 1); assert.equal(store.counts.friends, 23);
      assert.equal(store.loading, false);
    });

    await t.test('inventory view pages leave the complete crafting snapshot intact and clamp after deletion', async () => {
      setActivePinia(createPinia());
      useAuthStore().applySession(session('a'));
      const store = useInventoryStore();
      store.items = [{ id: 'crafting', data: { id: 'material', quantity: 25 } }];
      const pages = [];
      inventoryRepo.fetchPage = async (_user, page) => {
        pages.push(page);
        return { items: page === 3 ? [] : [{ id: 'last' }], total: 20, ownedTotal: 42 };
      };
      await store.loadViewPage([], 3);
      assert.deepEqual(pages, [3, 2]);
      assert.equal(store.viewPage, 2); assert.equal(store.viewItems[0].id, 'last');
      assert.equal(store.ownedTotal, 42); assert.equal(store.ownedQuantitiesByItemId.get('material'), 25);
      assert.equal(store.viewLoading, false);
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
      const { useFeatureAvailabilityStore } = await server.ssrLoadModule('/src/stores/featureAvailability.ts');
      useFeatureAvailabilityStore().checkRequests = async () => null;
      const read = deferred();
      let calls = 0;
      notificationRepo.fetchNotifications = () => { calls++; return read.promise; };
      const first = store.loadNotifications('a'); await flush();
      store.stopRefreshing('modal');
      const second = store.loadNotifications('a');
      read.resolve({ personal: [{ id: 'new', is_read: false }], system: [], personalTotal: 1, systemTotal: 0, personalUnread: 1, systemUnread: 0 });
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
      teamRepo.fetchMyInvites = async () => ({ items: [], total: 0 });
      teamRepo.fetchTeams = async () => ({ items: [], total: 0 });
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
