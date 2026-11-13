import { onScopeDispose, watch } from 'vue';
import { useGameCatalogStore } from '../stores/gameCatalog';
import type { CatalogDomain } from '../types/model/gameCache';

/** Resume/focus reconciles only catalogs belonging to a visible feature. */
export function useGameCatalogRefresh(domains: CatalogDomain[], enabled: () => boolean = () => true) {
  const catalog = useGameCatalogStore();
  const stop = watch(enabled, (visible, _, cleanup) => {
    if (visible) cleanup(catalog.activate(domains));
  }, { immediate: true });
  onScopeDispose(stop);
}
