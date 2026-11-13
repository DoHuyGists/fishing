import type { CacheEntry, CacheReadOptions, CacheResult, CacheStorage } from '../types/model/gameCache';
import { isTemporaryReadError, RepositoryError } from '../data/repositoryError';

export class CacheUnavailableError extends Error {
  constructor(message = 'Catalog unavailable') { super(message); this.name = 'CacheUnavailableError'; }
}
export class CacheContextChangedError extends Error {
  constructor() { super('Cache context changed'); this.name = 'CacheContextChangedError'; }
}

export function createGameCache(storage: CacheStorage, dependencies: {
  now?: () => number;
  random?: () => number;
  timeoutMs?: number;
  onResult?: (key: string, result: CacheResult<unknown>) => void;
  onInvalidate?: (scope: string, domains?: string[]) => void;
} = {}) {
  const now = dependencies.now ?? Date.now;
  const random = dependencies.random ?? Math.random;
  const entries = new Map<string, CacheEntry>();
  const pending = new Map<string, Promise<CacheResult<unknown>>>();
  const epochs = new Map<string, number>();
  const barriers = new Map<string, Promise<void>>();
  const persistedEpochs = new Map<string, string>();
  const epoch = (scope: string, domain: string) => `${epochs.get(scope) ?? 0}:${epochs.get(scope + ':' + domain) ?? 0}`;
  const keyOf = (scope: string, domain: string, parameter = '') => JSON.stringify([scope, domain, parameter]);
  function remember(row: CacheEntry) {
    entries.delete(row.key); entries.set(row.key, row);
    while (entries.size > 200) entries.delete(entries.keys().next().value!);
  }
  const result = <T>(key: string, row: CacheEntry<T>, stale = false, error?: unknown): CacheResult<T> => {
    const value: CacheResult<T> = { data: row.data as T, state: stale ? 'stale' : 'fresh', fetchedAt: row.fetchedAt, revision: row.revision,
      refreshError: error instanceof Error ? error.message : undefined };
    dependencies.onResult?.(key, value);
    return value;
  };
  function forget(scope: string, domains?: string[]) {
    for (const domain of domains ?? ['']) {
      const key = domain ? scope + ':' + domain : scope;
      epochs.set(key, (epochs.get(key) ?? 0) + 1);
    }
    for (const [key, row] of entries) if (row.scope === scope && (!domains || domains.includes(row.domain))) entries.delete(key);
    dependencies.onInvalidate?.(scope, domains);
  }
  async function invalidate(scope: string, domains?: string[]) {
    forget(scope, domains);
    const work = (barriers.get(scope) ?? Promise.resolve()).then(() => storage.invalidate(scope, domains));
    barriers.set(scope, work);
    await work;
    if (barriers.get(scope) === work) barriers.delete(scope);
  }
  function read<T>(options: CacheReadOptions<T>): Promise<CacheResult<T>> {
    const { scope, domain, parameter, policy } = options;
    const key = keyOf(scope, domain, parameter);
    if (options.current?.() === false) return Promise.reject(new CacheContextChangedError());
    // Install the promise before storage/network awaits; all callers join hydration too.
    const existing = pending.get(key);
    if (existing) return existing as Promise<CacheResult<T>>;
    const work = Promise.resolve().then(async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        await barriers.get(scope);
        const started = epoch(scope, domain);
        const current = () => options.current?.() !== false && started === epoch(scope, domain);
        let row = entries.get(key) as CacheEntry<T> | undefined;
        const valid = (value: CacheEntry<T> | undefined): value is CacheEntry<T> => Boolean(value && value.key === key && value.scope === scope
          && value.domain === domain && value.schemaVersion === 1 && Number.isFinite(value.fetchedAt) && value.fetchedAt <= now()
          && value.expiresAt === value.fetchedAt + policy.ttl && value.staleUntil === value.fetchedAt + policy.maxAge
          && (value.revision === undefined || typeof value.revision === 'string' && /^[1-9]\d*$/.test(value.revision))
          && (!options.expectedRevision || typeof value.revision === 'string' && /^\d+$/.test(value.revision)
            && /^\d+$/.test(options.expectedRevision) && BigInt(value.revision) >= BigInt(options.expectedRevision))
          && Object.hasOwn(value, 'data') && options.validate(value.data));
        if (valid(row) && !options.force && now() < row.expiresAt) { remember(row); return result(key, row); }
        const persisted = await storage.read(scope, domain, key);
        if (!current()) { if (options.current?.() === false) throw new CacheContextChangedError(); continue; }
        // Even if storage fails to persist an invalidation, this runtime must
        // never hydrate the previously rejected snapshot again.
        const canHydrate = started === '0:0' || persistedEpochs.get(scope + ':' + domain) === started;
        if (canHydrate && persisted.available !== false && (!row || row.generation !== persisted.token.generation || row.scopeGeneration !== persisted.token.scopeGeneration)) row = persisted.entry as CacheEntry<T> | undefined;
        const usable = valid(row);
        if (usable && !options.force && now() < row!.expiresAt) { remember(row!); return result(key, row!); }
        const stale = () => usable && policy.maxAge > policy.ttl && now() < row!.staleUntil;
        const cooling = row && Number.isFinite(row.retryAt) && Number.isFinite(row.accessedAt) && row.accessedAt <= now() && row.retryAt > now();
        if (cooling || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
          if (stale()) return result(key, row!, true, new CacheUnavailableError('Waiting to retry'));
          throw new CacheUnavailableError('Waiting to retry');
        }
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const snapshot = await Promise.race([
            Promise.resolve().then(() => options.load(controller.signal)),
            new Promise<never>((_, reject) => { timer = setTimeout(() => {
              controller.abort(); const error = new Error('Catalog read timed out'); error.name = 'TimeoutError'; reject(error);
            }, dependencies.timeoutMs ?? 10_000); }),
          ]);
          if (!current()) { if (options.current?.() === false) throw new CacheContextChangedError(); continue; }
          if (!options.validate(snapshot.data)) throw new CacheUnavailableError('Invalid catalog payload');
          const fetchedAt = now();
          const next: CacheEntry<T> = { ...persisted.token, key, scope, domain, schemaVersion: 1, data: snapshot.data, revision: snapshot.revision,
            fetchedAt, expiresAt: fetchedAt + policy.ttl, staleUntil: fetchedAt + policy.maxAge, retryAt: 0, failureCount: 0, accessedAt: fetchedAt };
          const saved = await storage.write(next);
          if (!current()) { if (options.current?.() === false) throw new CacheContextChangedError(); continue; }
          // Detect an invalidate committed by another tab during the network request.
          const check = await storage.read(scope, domain, key);
          if (check.available !== false && (check.token.generation !== next.generation || check.token.scopeGeneration !== next.scopeGeneration)) continue;
          if (saved) persistedEpochs.set(scope + ':' + domain, started);
          remember(next);
          return result(key, next);
        } catch (error) {
          if (error instanceof CacheContextChangedError) throw error;
          if (!current()) { if (options.current?.() === false) throw new CacheContextChangedError(); continue; }
          if (!isTemporaryReadError(error)) {
            await invalidate(scope, [domain]);
            throw error;
          }
          const failureCount = Math.min((Number.isFinite(row?.failureCount) ? Math.max(0, row!.failureCount) : 0) + 1, 5);
          const delay = Math.min(120_000, 15_000 * 2 ** (failureCount - 1)) * (1 + random() * .15);
          const retryAt = now() + Math.max(delay, error instanceof RepositoryError ? error.retryAfterMs : 0);
          const failed: CacheEntry<T> = { ...persisted.token, key, scope, domain, schemaVersion: 1, fetchedAt: 0, expiresAt: 0, staleUntil: 0,
            ...(usable ? row : {}), retryAt, failureCount, accessedAt: now() };
          remember(failed); await storage.write(failed);
          if (!current()) { if (options.current?.() === false) throw new CacheContextChangedError(); continue; }
          const check = await storage.read(scope, domain, key);
          if (check.available !== false && (check.token.generation !== failed.generation || check.token.scopeGeneration !== failed.scopeGeneration)) continue;
          if (stale()) return result(key, row!, true, error);
          throw error;
        } finally { clearTimeout(timer); }
      }
      throw new CacheUnavailableError('Catalog changed repeatedly');
    }).finally(() => { if (pending.get(key) === work) pending.delete(key); });
    pending.set(key, work);
    return work;
  }
  return { read, invalidate, forget, keyOf };
}
