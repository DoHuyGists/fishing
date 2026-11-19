import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createServer } from 'vite';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('redeem module preserves RPC contract and isolates pending submissions', async t => {
  const server = await createServer({ configFile: false, envDir: false,
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom',
    define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://redeem-test.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key') } });
  const originalFetch = globalThis.fetch;
  try {
    const load = path => server.ssrLoadModule('/src/' + path + '.ts');
    const { useAuthStore } = await load('stores/auth');
    const { useRedeemCodeStore } = await load('stores/player-redeem-code-store');
    const { resetPlayerSnapshots } = await load('stores/player-snapshot-reset-store');
    const { supabaseRedeemCodeRepository: repo } = await load('data/supabaseRedeemCodeRepository');
    const { useToast } = await load('composables/useToast');
    const { setFeatureRequestGuard } = await load('database/featureRequestGate');
    setFeatureRequestGuard(async () => null);
    const init = () => {
      const pinia = createPinia(); pinia.use(resetPlayerSnapshots);
      createApp({}).use(pinia); setActivePinia(pinia);
      const auth = useAuthStore(); auth.applySession({ user: { id: 'A' } });
      const toast = useToast();
      for (const item of toast.toasts.value) toast.dismiss(item.id);
      return { auth, store: useRedeemCodeStore(), toast };
    };
    await t.test('trimmed code reaches the existing RPC; empty and duplicate submissions do not', async () => {
      const { store, toast } = init(); const response = deferred(); let calls = 0;
      globalThis.fetch = async (input, options) => {
        const request = input instanceof Request ? input : new Request(input, options);
        assert.equal(request.url, 'https://redeem-test.supabase.co/rest/v1/rpc/redeem_code');
        assert.equal(request.method, 'POST');
        assert.deepEqual(await request.json(), { p_code: 'GIFT' }); calls++;
        return response.promise;
      };
      assert.equal(await store.redeem('   '), false);
      const pending = store.redeem(' GIFT ');
      assert.equal(store.isSubmitting, true);
      assert.equal(await store.redeem('OTHER'), false);
      response.resolve(new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      assert.equal(await pending, true);
      assert.equal(calls, 1); assert.equal(store.isSubmitting, false);
      assert.equal(toast.toasts.value.at(-1).variant, 'success');
    });
    await t.test('RPC errors retain a useful message and allow retry', async () => {
      const { store, toast } = init();
      globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Code expired', code: 'P0001' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } });
      assert.equal(await store.redeem('EXPIRED'), false);
      assert.equal(store.isSubmitting, false);
      assert.equal(toast.toasts.value.at(-1).message, 'Code expired');
      globalThis.fetch = async () => new Response('null', { headers: { 'Content-Type': 'application/json' } });
      assert.equal(await store.redeem('VALID'), true);
    });
    await t.test('old success and failure cannot toast or unlock a new session submission', async () => {
      const original = repo.redeem;
      try {
        for (const failure of [false, true]) {
          const { auth, store, toast } = init();
          const old = deferred(), next = deferred(); let calls = 0;
          repo.redeem = () => (++calls === 1 ? old.promise : next.promise);
          const first = store.redeem('OLD');
          auth.applySession(null);
          assert.equal(store.isSubmitting, false);
          assert.equal(await store.redeem('LOGGED-OUT'), false);
          auth.applySession({ user: { id: failure ? 'A' : 'B' } });
          const second = store.redeem('NEW');
          if (failure) old.reject(new Error('Old session')); else old.resolve();
          assert.equal(await first, false);
          assert.equal(store.isSubmitting, true);
          assert.equal(toast.toasts.value.length, 0);
          next.resolve(); assert.equal(await second, true);
          assert.equal(store.isSubmitting, false);
        }
      } finally { repo.redeem = original; }
    });
  } finally { globalThis.fetch = originalFetch; await server.close(); }
});
