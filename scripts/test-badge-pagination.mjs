import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

test('badge pages preserve global search, filters, totals and caller isolation', async () => {
  const db = new PGlite();
  const badgeId = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  const read = async (page = 1, search = '', type = 'all', status = 'all') =>
    (await db.query('SELECT public.get_user_badges_page($1, $2, $3, $4) AS data', [page, search, type, status])).rows[0].data;
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('test.uid', true), '')::uuid
      $$;
      CREATE TABLE public.badge_fixture (
        owner_id uuid, badge_id uuid, name text, description text, type text,
        is_earned boolean, can_claim boolean
      );
      CREATE FUNCTION public.get_user_badges_status()
      RETURNS jsonb
      LANGUAGE sql STABLE SECURITY DEFINER AS $$
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'badge_id', badge_id, 'name', name, 'description', description,
          'type', type, 'is_earned', is_earned, 'can_claim', can_claim,
          'icon_url', '/badge.png', 'reward', jsonb_build_object('cash', 100),
          'quantity', CASE WHEN is_earned THEN 1 ELSE 0 END,
          'earned_at', CASE WHEN is_earned THEN '2026-11-19T00:00:00Z'::timestamptz END,
          'is_claim', CASE WHEN is_earned THEN NOT can_claim END
        )), '[]'::jsonb) FROM public.badge_fixture
        WHERE owner_id = auth.uid()
      $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      SET test.uid = '00000000-0000-0000-0000-000000000001';
      INSERT INTO public.badge_fixture
        SELECT auth.uid(), ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
          'Badge ' || lpad(n::text, 2, '0'),
          CASE WHEN n = 23 THEN 'Cá hiếm 100%' ELSE 'Fishing' END,
          CASE WHEN n > 20 THEN ' Rare ' ELSE 'Common' END,
          n <= 12, n <= 3
        FROM generate_series(1, 23) n;
      INSERT INTO public.badge_fixture VALUES
        ('00000000-0000-0000-0000-000000000002', '${badgeId(99)}', 'Private', '', 'Secret', true, true);
    `);
    await db.exec(await readFile(new URL('./supabase/migrations/20261119_badge_pagination.sql', import.meta.url), 'utf8'));
    await db.exec('SET ROLE authenticated');
    const first = await read(), second = await read(2), last = await read(3);
    assert.equal(first.items.length, 23);
    assert.equal(second.items.length, 0);
    assert.equal(last.items.length, 0);
    assert.equal(new Set([...first.items, ...second.items, ...last.items].map(b => b.badge_id)).size, 23);
    assert.equal(first.collectionTotal, 23);
    assert.equal(first.earnedTotal, 12);
    assert.deepEqual(first.types, ['Common', 'Rare']);
    assert.equal(first.items[0].type, 'Common');
    assert.equal(first.items[0].badge_id, badgeId(1));
    assert.equal(first.items[0].icon_url, '/badge.png');
    assert.deepEqual(first.items[0].reward, { cash: 100 });
    assert.equal(first.items[0].quantity, 1);
    assert.equal(first.items[0].is_claim, false);
    assert.equal(Date.parse(first.items[0].earned_at), Date.parse('2026-11-19T00:00:00Z'));
    assert.equal(first.items[22].earned_at, null);
    assert.equal(first.items[22].is_claim, null);
    assert.ok(!('normalized_type' in first.items[0]));
    assert.ok(first.items.slice(0, 12).every(b => b.is_earned));
    assert.deepEqual((await read(-1)).items, first.items);
    const found = await read(1, 'cá hiếm');
    assert.equal(found.total, 1);
    assert.equal(found.items[0].badge_id, badgeId(23));
    assert.equal(found.items[0].type, ' Rare ');
    assert.equal(found.collectionTotal, 23);
    assert.equal(found.earnedTotal, 12);
    assert.deepEqual(found.types, first.types);
    assert.equal((await read(1, '%')).items[0].badge_id, badgeId(23));
    assert.equal((await read(1, '', 'Rare')).total, 3);
    assert.equal((await read(1, 'rare')).total, 3);
    assert.equal((await read(1, '', 'all', 'earned')).total, 12);
    assert.equal((await read(1, '', 'all', 'unearned')).total, 11);
    assert.equal((await read(1, '', 'all', 'claimable')).total, 3);
    assert.deepEqual((await read(100)).items, []);
    assert.equal((await read(1, 'missing')).total, 0);
    await assert.rejects(read(1, '', 'all', 'invalid'), /Invalid badge status/);
    await db.exec(`
      RESET ROLE;
      INSERT INTO public.badge_fixture
        SELECT auth.uid(), ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
          'Badge ' || n, 'Fishing', 'Common', false, false
        FROM generate_series(24, 61) n;
      SET ROLE authenticated;
    `);
    const pages = await Promise.all([read(1), read(2), read(3)]);
    assert.deepEqual(pages.map(page => page.items.length), [30, 30, 1]);
    assert.equal(new Set(pages.flatMap(page => page.items.map(b => b.badge_id))).size, 61);
    await db.exec("SET test.uid = '00000000-0000-0000-0000-000000000003'");
    assert.deepEqual(await read(), { items: [], total: 0, collectionTotal: 0, earnedTotal: 0, types: [] });
    await db.exec("SET test.uid = ''");
    await assert.rejects(read(), /Authentication required/);
    await db.exec('RESET ROLE; SET ROLE anon');
    await assert.rejects(read(), /permission denied/);
  } finally {
    await db.close();
  }
});

test('badge store ignores stale filters and refreshes only the current page after claiming', async () => {
  const server = await createServer({
    configFile: false, appType: 'custom', envDir: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://example.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
    },
  });
  try {
    const { useAuthStore } = await server.ssrLoadModule('/src/stores/auth.ts');
    const { useBadgesStore } = await server.ssrLoadModule('/src/stores/player-badges-store.ts');
    const { useCurrencyStore } = await server.ssrLoadModule('/src/stores/player-currency-store.ts');
    const { supabaseBadgeRepository: repo } = await server.ssrLoadModule('/src/data/supabaseBadgeRepository.ts');
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.user = { id: 'a' };
    const store = useBadgesStore();
    assert.equal(store.pageSize, 30);
    store.ownerId = 'a';
    const result = id => ({ items: [{ badge_id: id }], total: 21, collectionTotal: 23, earnedTotal: 12, types: ['Common', 'Rare'] });
    const pending = [];
    repo.fetchPage = (...args) => new Promise(resolve => pending.push({ args, resolve }));
    const old = store.fetchBadges(2);
    store.searchQuery = 'rare';
    store.invalidateRequest();
    const latest = store.fetchBadges(1);
    pending[1].resolve(result('new'));
    await latest;
    pending[0].resolve(result('old'));
    await old;
    assert.equal(store.badges[0].badge_id, 'new');
    assert.equal(store.page, 1);
    assert.equal(store.loading, false);
    assert.deepEqual(pending[1].args, [1, 'rare', 'all', 'all']);

    store.page = 3;
    repo.claimBadgeReward = async id => assert.equal(id, 'new');
    let currencyRefreshes = 0;
    useCurrencyStore().fetchCurrency = async () => { currencyRefreshes++; };
    const calls = [];
    repo.fetchPage = async (...args) => {
      calls.push(args);
      return args[0] === 3 ? { ...result(''), items: [], total: 11 } : result('remaining');
    };
    assert.equal(await store.claimReward('new'), true);
    assert.deepEqual(calls.map(args => args[0]), [3, 1]);
    assert.equal(store.page, 1);
    assert.equal(currencyRefreshes, 1);
    assert.equal(store.claimingId, '');
    assert.equal(store.loading, false);
  } finally {
    await server.close();
  }
});
