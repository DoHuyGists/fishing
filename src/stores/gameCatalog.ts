import { defineStore } from 'pinia';
import { shallowReactive, watch } from 'vue';
import { useAuthStore } from './auth';
import { useFeatureAvailabilityStore } from './featureAvailability';
import { getFormattingLocale, t as tr } from '../i18n';
import { useToast } from '../composables/useToast';
import { createGameCache, CacheContextChangedError, CacheUnavailableError } from '../utils/gameCache';
import { indexedDbCacheRepository } from '../data/indexedDbCacheRepository';
import { catalogPolicies, expandCatalogDomains, validateCatalog } from '../data/gameCachePolicies';
import { RepositoryError } from '../data/repositoryError';
import { supabaseGameCatalogRepository as repository, versionedCatalogEnabled } from '../data/supabaseGameCatalogRepository';
import type { CacheResult, CatalogDomain, GameCatalogData } from '../types/model/gameCache';

export const useGameCatalogStore = defineStore('gameCatalog', () => {
  const auth = useAuthStore();
  const namespace = `${import.meta.env.VITE_SUPABASE_URL}:catalog-v1`;
  const scope = () => `${namespace}:user:${auth.user?.id ?? 'guest'}`;
  const results = shallowReactive<Record<string, CacheResult<unknown>>>({});
  const bindings = new Map<string, Map<string, (data: unknown) => void>>();
  const used = new Map<CatalogDomain, { ids: string[] }>();
  const active = new Map<CatalogDomain, number>();
  let lastNotice = 0;
  let channel: BroadcastChannel | undefined;
  function displayError(error: unknown) {
    if (error instanceof RepositoryError && error.code === 'CATALOG_SCHEMA_MISMATCH') return new RepositoryError({ code: error.code, message: tr('GameCache.updateClient') });
    if (error instanceof CacheUnavailableError) return new RepositoryError({ code: 'CATALOG_UNAVAILABLE', message: tr('GameCache.unavailable') });
    return error;
  }
  const cache = createGameCache(indexedDbCacheRepository, { onInvalidate(owner, domains) {
    if (owner === scope()) clearLocal(domains as CatalogDomain[] | undefined);
  }, onResult(key, result) {
    if (JSON.parse(key)[0] !== scope()) return;
    delete results[key]; results[key] = result;
    for (const oldKey of Object.keys(results)) {
      if (Object.keys(results).length <= 200) break;
      if (!bindings.get(oldKey)?.size) { delete results[oldKey]; bindings.delete(oldKey); }
    }
    for (const apply of bindings.get(key)?.values() ?? []) apply(structuredClone(result.data));
    if (result.state === 'stale' && Date.now() - lastNotice > 30_000) {
      lastNotice = Date.now();
      useToast().warning(tr('GameCache.stale', { time: new Date(result.fetchedAt).toLocaleString(getFormattingLocale()) }));
    }
  } });
  function clearLocal(domains?: CatalogDomain[]) {
    for (const key of Object.keys(results)) {
      if (!domains || domains.includes(JSON.parse(key)[1])) {
        delete results[key];
        for (const apply of bindings.get(key)?.values() ?? []) apply(undefined);
      }
    }
  }
  async function invalidate(domains: CatalogDomain[]) {
    const affected = expandCatalogDomains(domains);
    const owner = scope();
    clearLocal(affected);
    await cache.invalidate(owner, affected);
    channel?.postMessage({ scope: owner, domains: affected });
  }
  watch(() => auth.sessionGeneration, () => {
    const oldScopes = new Set(Object.keys(results).map(key => JSON.parse(key)[0] as string));
    oldScopes.add(scope());
    clearLocal(); bindings.clear(); used.clear();
    for (const owner of oldScopes) {
      void cache.invalidate(owner).then(() => channel?.postMessage({ scope: owner }));
    }
  }, { flush: 'sync' });
  // A channel only carries invalidation metadata. It neither carries catalog
  // payloads nor shares requests between tabs.
  function connect() {
    if (channel || typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    channel = new BroadcastChannel('fishing-game-catalog');
    channel.onmessage = event => {
      if (event.data?.scope !== scope()) return;
      const domains = Array.isArray(event.data.domains) ? event.data.domains.filter((d: string) => Object.hasOwn(catalogPolicies, d)) : undefined;
      cache.forget(scope(), domains); clearLocal(domains);
    };
  }
  async function manifest(current: () => boolean) {
    if (!versionedCatalogEnabled) return undefined;
    const response = await cache.read({ scope: scope(), domain: '_manifest', policy: { ttl: 300_000, maxAge: 300_000 }, current,
      validate: (data): data is Record<string, string> => Boolean(data && typeof data === 'object' && !Array.isArray(data)
        && Object.keys(catalogPolicies).every(key => typeof (data as Record<string, unknown>)[key] === 'string' && /^[1-9]\d*$/.test((data as Record<string, string>)[key]!))),
      load: async signal => ({ data: await repository.versions(signal) }),
    });
    return response.data;
  }
  async function get<K extends CatalogDomain>(domain: K, options: {
    ids?: string[]; force?: boolean; consumer?: string; onUpdate?: (data: GameCatalogData[K] | undefined) => void;
  } = {}): Promise<GameCatalogData[K]> {
    connect();
    const owner = auth.user?.id, session = auth.sessionGeneration, ownerScope = scope();
    const current = () => auth.user?.id === owner && auth.sessionGeneration === session;
    if (!owner) throw new CacheContextChangedError();
    const policy = catalogPolicies[domain];
    if (policy.feature) {
      const denial = await useFeatureAvailabilityStore().checkRequests([policy.feature]);
      if (denial) { await invalidate([domain]); throw new RepositoryError(denial); }
    }
    if (!current()) throw new CacheContextChangedError();
    const ids = [...new Set(options.ids ?? [])].sort();
    const key = cache.keyOf(ownerScope, domain, JSON.stringify(ids));
    if (options.onUpdate) {
      const consumers = bindings.get(key) ?? new Map();
      for (const [oldKey, oldConsumers] of bindings) {
        if (oldKey !== key && JSON.parse(oldKey)[1] === domain) oldConsumers.delete(options.consumer ?? domain);
      }
      consumers.set(options.consumer ?? domain, options.onUpdate as (data: unknown) => void); bindings.set(key, consumers);
    }
    used.set(domain, { ids });
    let versions: Record<string, string> | undefined;
    try { versions = await manifest(current); }
    catch (error) {
      if (!current()) throw new CacheContextChangedError();
      if (!(error instanceof Error) || error instanceof RepositoryError && error.code && error.status !== 429 && (error.status ?? 0) < 500
        || !['RepositoryError', 'TypeError', 'TimeoutError', 'CacheUnavailableError'].includes(error.name)) {
        await invalidate([domain]); throw displayError(error);
      }
    }
    if (!current()) throw new CacheContextChangedError();
    const read = () => cache.read({ scope: ownerScope, domain, parameter: JSON.stringify(ids), policy, force: options.force, current, expectedRevision: versions?.[domain],
      validate: (data): data is GameCatalogData[K] => validateCatalog(domain, data), load: signal => repository.snapshot(domain, ids, signal),
    });
    // Reject obsolete persisted revisions before publishing to feature stores.
    const previous = results[key];
    if (versions?.[domain] && previous?.revision && BigInt(previous.revision) < BigInt(versions[domain]!)) await invalidate([domain]);
    const value = await read().catch(error => {
      throw displayError(error);
    });
    if (!current()) throw new CacheContextChangedError();
    return structuredClone(value.data);
  }
  function state(domain: CatalogDomain, ids: string[] = []) {
    return results[cache.keyOf(scope(), domain, JSON.stringify([...new Set(ids)].sort()))];
  }
  async function action<T>(name: string, args: Record<string, unknown>, domains: CatalogDomain[], legacy: () => Promise<T>, receiptRetry = false): Promise<T> {
    const owner = auth.user?.id, session = auth.sessionGeneration;
    const current = () => auth.user?.id === owner && auth.sessionGeneration === session;
    const before = domains.map(domain => state(domain));
    const revisions: Record<string, string> = {};
    if (receiptRetry && versionedCatalogEnabled) {
      for (const domain of domains) revisions[domain] = state(domain)?.revision ?? '';
    } else for (let index = 0; index < domains.length; index++) {
      const domain = domains[index]!;
      try { await get(domain, { force: !versionedCatalogEnabled || before[index]?.state === 'stale' }); }
      catch { throw new RepositoryError({ code: 'CATALOG_REFRESH_REQUIRED', message: tr('GameCache.refreshRequired') }); }
      const after = state(domain);
      if (!current()) throw new CacheContextChangedError();
      if (!after || after.state !== 'fresh') throw new RepositoryError({ code: 'CATALOG_REFRESH_REQUIRED', message: tr('GameCache.refreshRequired') });
      if (!before[index] || before[index]?.revision !== after.revision || JSON.stringify(before[index]?.data) !== JSON.stringify(after.data)) {
        throw new RepositoryError({ code: 'CATALOG_VERSION_MISMATCH', message: tr('GameCache.changed') });
      }
      if (after.revision) revisions[domain] = after.revision;
    }
    try {
      return versionedCatalogEnabled ? await repository.action<T>(name, args, revisions) : await legacy();
    } catch (error) {
      if (error instanceof RepositoryError && error.code === 'CATALOG_VERSION_MISMATCH' && current()) {
        const affected = error.domains.filter((d): d is CatalogDomain => Object.hasOwn(catalogPolicies, d));
        await invalidate(affected.length ? affected : domains);
        if (!current()) throw new CacheContextChangedError();
        await Promise.allSettled(domains.map(domain => get(domain, { force: true })));
        throw new RepositoryError({ code: 'CATALOG_VERSION_MISMATCH', message: tr('GameCache.changed') });
      }
      throw error;
    }
  }
  async function resume() {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden' || typeof navigator !== 'undefined' && !navigator.onLine) return;
    await Promise.allSettled([...used].filter(([domain]) => (active.get(domain) ?? 0) > 0)
      .map(([domain, value]) => get(domain, { ids: value.ids })));
  }
  function activate(domains: CatalogDomain[]) {
    for (const domain of domains) active.set(domain, (active.get(domain) ?? 0) + 1);
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      for (const domain of domains) active.set(domain, Math.max(0, (active.get(domain) ?? 0) - 1));
    };
  }
  return { results, get, state, invalidate, action, resume, activate };
});
