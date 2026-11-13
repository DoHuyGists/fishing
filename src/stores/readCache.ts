import { defineStore } from 'pinia';
import { watch } from 'vue';
import { useAuthStore } from './auth';
import { useFeatureAvailabilityStore } from './featureAvailability';
import { createGameCache, CacheContextChangedError, CacheUnavailableError } from '../utils/gameCache';
import { indexedDbCacheRepository } from '../data/indexedDbCacheRepository';
import { readCachePolicies } from '../data/readCachePolicies';
import { RepositoryError } from '../data/repositoryError';
import { t as tr } from '../i18n';
import type { CacheEvent, CacheStorage } from '../types/model/gameCache';
import type { CachedHttpRead, ReadCacheContext } from '../types/model/readCache';

const memoryOnly: CacheStorage = {
  read: async () => ({ available: false, token: { generation: '', scopeGeneration: '' } }),
  write: async () => false,
  invalidate: async () => {},
};
const validResponse = (value: unknown): value is CachedHttpRead => {
  if (!value || typeof value !== 'object') return false;
  const row = value as CachedHttpRead;
  try { if (row.body !== null) JSON.parse(row.body); } catch { return false; }
  return [200, 206].includes(row.status) && (row.body === null || typeof row.body === 'string')
    && Array.isArray(row.headers) && row.headers.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(item => typeof item === 'string'));
};

export const useReadCacheStore = defineStore('readCache', () => {
  const auth = useAuthStore();
  const scope = () => `${import.meta.env.VITE_SUPABASE_URL}:http-reads-v1:user:${auth.user?.id ?? 'guest'}`;
  const counts: Record<string, Record<string, number>> = {};
  const recent: CacheEvent[] = [];
  const report = (event: CacheEvent) => {
    // Unavailable persistence is intentional for personal RAM snapshots.
    if (event.kind === 'storageUnavailable' && !readCachePolicies[event.domain]?.persist) return;
    const domain = counts[event.domain] ??= {};
    domain[event.kind] = (domain[event.kind] ?? 0) + 1;
    recent.push(event); if (recent.length > 100) recent.shift();
  };
  const options = { onEvent: import.meta.env.DEV ? report : undefined };
  const ram = createGameCache(memoryOnly, options);
  const disk = createGameCache(indexedDbCacheRepository, options);
  let channel: BroadcastChannel | undefined;
  function connect() {
    if (channel || typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    channel = new BroadcastChannel('fishing-read-cache');
    channel.onmessage = event => {
      if (event.data?.scope !== scope() || !Array.isArray(event.data.domains)) return;
      const domains = event.data.domains.filter((key: string) => Object.hasOwn(readCachePolicies, key));
      ram.forget(scope(), domains); disk.forget(scope(), domains);
    };
  }
  async function clear(ownerScope: string, domains: string[]) {
    // Both engines forget synchronously, before the first await, so an existing
    // read cannot publish its pre-mutation response after the commit.
    const persisted = domains.filter(domain => readCachePolicies[domain]?.persist);
    const work = [ram.invalidate(ownerScope, domains)];
    if (persisted.length) work.push(disk.invalidate(ownerScope, persisted));
    channel?.postMessage({ scope: ownerScope, domains });
    await Promise.all(work);
  }
  function capture(): ReadCacheContext | undefined {
    const owner = auth.user?.id, generation = auth.sessionGeneration, ownerScope = scope();
    const accessToken = auth.session?.access_token;
    if (!owner) return undefined;
    connect();
    const current = () => auth.user?.id === owner && auth.sessionGeneration === generation;
    const matchesAuthorization = (authorization: string | null) => {
      if (!accessToken) return true;
      const token = /^Bearer\s+(.+)$/i.exec(authorization ?? '')?.[1];
      if (token === accessToken) return true;
      // Token rotation for the same owner is valid. The subject is only a cache
      // scoping hint; Supabase remains responsible for verifying the JWT.
      try {
        const payload = token?.split('.')[1];
        return Boolean(payload && JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))?.sub === owner);
      } catch { return false; }
    };
    return {
      current,
      matchesAuthorization,
      async read(domain, key, load) {
        if (!current()) throw new CacheContextChangedError();
        const policy = readCachePolicies[domain];
        if (!policy) throw new Error('Unknown read cache domain');
        if (policy.feature) {
          const denied = await useFeatureAvailabilityStore().checkRequests([policy.feature]);
          if (denied) throw new RepositoryError(denied);
        }
        if (!current()) throw new CacheContextChangedError();
        const parameter = policy.hourBoundary ? `${Math.floor(Date.now() / 3_600_000)}:${key}` : key;
        const result = await (policy.persist ? disk : ram).read({
          scope: ownerScope, domain, parameter, policy: { ttl: policy.ttl, maxAge: policy.ttl }, current,
          validate: validResponse, load: async signal => ({ data: await load(signal) }),
        }).catch(error => {
          if (error instanceof CacheUnavailableError) throw new RepositoryError({ code: 'READ_CACHE_UNAVAILABLE', message: tr('GameCache.unavailable') });
          throw error;
        });
        if (!current()) throw new CacheContextChangedError();
        return structuredClone(result.data);
      },
      async invalidate(domains = Object.keys(readCachePolicies)) {
        if (current()) await clear(ownerScope, domains);
      },
    };
  }
  async function invalidate(domains?: string[]) { await capture()?.invalidate(domains); }
  async function get<T>(domain: string, parameter: string, load: () => Promise<T>, force = false): Promise<T> {
    const context = capture();
    if (!context) throw new CacheContextChangedError();
    if (force) await context.invalidate([domain]);
    const result = await context.read(domain, `snapshot:${parameter}`, async () => ({
      body: JSON.stringify(await load()), status: 200, headers: [],
    }));
    return JSON.parse(result.body!) as T;
  }
  watch(() => auth.sessionGeneration, () => {
    // Auth increments generation before replacing user: scope() is the old owner.
    void clear(scope(), Object.keys(readCachePolicies));
    recent.length = 0;
    for (const key of Object.keys(counts)) delete counts[key];
  }, { flush: 'sync' });
  return { capture, get, invalidate, inspect: () => ({ counts: structuredClone(counts), recent: structuredClone(recent) }) };
});
