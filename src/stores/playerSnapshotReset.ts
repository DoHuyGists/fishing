import { watch } from 'vue';
import type { PiniaPlugin } from 'pinia';
import { useAuthStore } from './auth';

const privateStores = new Set([
  'Caught', 'Inventory', 'currency', 'userProfile', 'Country', 'diary', 'friend', 'faction',
  'fishingPass', 'badges', 'Mission', 'notifications', 'team', 'species_market', 'feedback', 'leaderboard',
]);

// Register only stores already loaded by the app. Avoid eager imports of every
// modal/store, and clear displayed snapshots as well as the underlying caches.
export const resetPlayerSnapshots: PiniaPlugin = ({ store, pinia }) => {
  if (!privateStores.has(store.$id) && !['equipment', 'AquaculturePlayer'].includes(store.$id)) return;
  const auth = useAuthStore(pinia);
  const stop = watch(() => auth.sessionGeneration, () => {
    if (store.$id === 'equipment') store.reset();
    else if (store.$id === 'AquaculturePlayer') store.resetSession();
    else {
      if (store.$id === 'team') { store.stopRefreshing('panel'); store.stopRefreshing('lobby'); }
      if (store.$id === 'notifications') { store.stopRefreshing('modal'); store.stopRefreshing('badge'); }
      if (store.$id === 'species_market') store.stopRefreshing();
      store.$reset();
    }
  }, { flush: 'sync' });
  const dispose = store.$dispose.bind(store);
  store.$dispose = () => { stop(); dispose(); };
};
