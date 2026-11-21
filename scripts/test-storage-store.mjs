import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

test('standalone storage manages the complete inventory safely', async t => {
  const server = await createServer({ configFile: false, envDir: false,
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom',
    define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://storage-test.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key') } });
  try {
    const load = path => server.ssrLoadModule('/src/' + path + '.ts');
    const { useAuthStore } = await load('stores/auth');
    const { useInventoryStore } = await load('stores/player-inventory-store');
    const { useHealthStore } = await load('stores/player-health-store');
    const { useStorageStore } = await load('stores/player-storage-store');
    const { i18n } = await load('i18n/index');
    i18n.global.locale.value = 'en';
    const init = async () => {
      setActivePinia(createPinia());
      const auth = useAuthStore(); auth.applySession({ user: { id: 'owner' } });
      const inventory = useInventoryStore(), health = useHealthStore(), storage = useStorageStore();
      let rows = Array.from({ length: 45 }, (_, index) => ({
        id: `item-${String(index).padStart(2, '0')}`, userId: 'owner',
        createdAt: new Date(2026, 0, index + 1).toISOString(), rpc: index === 44 ? 'consume' : null,
        data: { name: `Item ${index}`, category: index % 2 ? 'rod' : 'material',
          classification: index % 2 ? 'fishing' : 'material', quantity: index + 1 },
      }));
      health.loadInventory = async () => { inventory.items = structuredClone(rows); health.error = ''; };
      inventory.setEquipmentSet = async () => {};
      await storage.load();
      return { auth, inventory, health, storage, setRows: value => { rows = value; } };
    };

    await t.test('filters and sorting include items beyond the first page and all classifications', async () => {
      const { storage } = await init();
      assert.equal(storage.items.length, 45);
      assert.equal(storage.pagedItems.length, 20);
      assert.equal(storage.totalQuantity, 1035);
      storage.search = 'Item 44';
      assert.deepEqual(storage.filteredItems.map(item => item.id), ['item-44']);
      storage.resetFilters(); storage.classification = 'material';
      assert.equal(storage.filteredItems.length, 23);
      storage.resetFilters(); storage.status = 'usable';
      assert.equal(storage.filteredItems[0].id, 'item-44');
      storage.resetFilters(); storage.sort = 'quantity';
      assert.equal(storage.filteredItems[0].id, 'item-44');
      storage.sort = 'oldest';
      assert.equal(storage.filteredItems[0].id, 'item-00');
      storage.resetFilters(); storage.search = storage.categoryLabel('rod');
      assert.equal(storage.filteredItems.length, 22);
    });

    await t.test('selection spans pages and supports selecting every filtered result', async () => {
      const { storage } = await init();
      storage.togglePage(); assert.equal(storage.selectedIds.length, 20);
      storage.page = 2; storage.togglePage(); assert.equal(storage.selectedIds.length, 40);
      storage.togglePage(); assert.equal(storage.selectedIds.length, 20);
      storage.selectFiltered(); assert.equal(storage.selectedIds.length, 45);
      storage.filtersChanged(); assert.equal(storage.selectedIds.length, 0); assert.equal(storage.page, 1);
    });

    await t.test('items in saved fishing or body sets cannot be deleted', async () => {
      const { storage, inventory, health } = await init();
      inventory.savedEquipmentSets = [{ id: 'set', rod: [{ inventory_id: 'item-01' }], line: [], reel: [], hook: [], bait: [] }];
      health.savedSets = [{ id: 'body', head: [{ inventory_id: 'item-02' }], torso: [], hands: [], legs: [], feet: [], accessory: [] }];
      let deleted = false; inventory.removeItem = async () => { deleted = true; };
      for (const id of ['item-01', 'item-02']) {
        storage.selectedIds = [id]; assert.equal(storage.canDelete, false);
        await storage.deleteSelected(); assert.equal(deleted, false);
      }
      storage.status = 'protected'; assert.equal(storage.filteredItems.length, 2);
    });

    await t.test('use and deletion refresh inventory, clamp pages and retain failures for review', async () => {
      const { storage, inventory, setRows } = await init();
      let used = ''; inventory.useItem = async id => { used = id; };
      storage.selectedIds = ['item-44']; await storage.useSelected();
      assert.equal(used, 'item-44'); assert.equal(storage.selectedIds.length, 0);
      storage.page = 3; storage.selectFiltered(); storage.confirmingDelete = true;
      inventory.removeItem = async () => { throw new Error('denied'); };
      await storage.deleteSelected();
      assert.equal(storage.error, 'denied'); assert.equal(storage.selectedIds.length, 45); assert.equal(storage.confirmingDelete, true);
      inventory.removeItem = async (_owner, ids) => { assert.equal(ids.length, 45); setRows([]); };
      await storage.deleteSelected();
      assert.equal(storage.items.length, 0); assert.equal(storage.page, 1); assert.equal(storage.confirmingDelete, false);
    });

    await t.test('incomplete protection data and previous sessions cannot authorize mutations', async () => {
      const { storage, health, auth } = await init();
      health.loadInventory = async () => { health.error = 'failed to load sets'; };
      await storage.load(); storage.selectedIds = ['item-00'];
      assert.equal(storage.ready, false); assert.equal(storage.canDelete, false);
      let finish; health.error = '';
      health.loadInventory = () => new Promise(resolve => { finish = resolve; });
      const pending = storage.load();
      auth.applySession({ user: { id: 'another-owner' } });
      finish(); await pending;
      assert.equal(storage.ready, false); assert.equal(storage.items.length, 0); assert.equal(storage.canDelete, false);
    });
  } finally { await server.close(); }
});
