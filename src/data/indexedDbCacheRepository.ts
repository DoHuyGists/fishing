import type { CacheEntry, CacheStorage, CacheToken } from '../types/model/gameCache';

const DATABASE = 'fishing-game-cache';
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ENTRIES = 200;
const tokenKey = (scope: string, domain = '') => JSON.stringify([scope, domain]);
const request = <T>(value: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  value.onsuccess = () => resolve(value.result);
  value.onerror = () => reject(value.error);
});
const completed = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
});

/** Best-effort storage. A blocked/full/disabled database must not block gameplay. */
export class IndexedDbCacheRepository implements CacheStorage {
  private connection: Promise<IDBDatabase | null> | null = null;
  private open(): Promise<IDBDatabase | null> {
    if (this.connection) return this.connection;
    this.connection = new Promise(resolve => {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      let settled = false;
      const timer = setTimeout(() => { settled = true; resolve(null); }, 1500);
      let opening: IDBOpenDBRequest;
      try { opening = indexedDB.open(DATABASE, 1); }
      catch { clearTimeout(timer); resolve(null); return; }
      opening.onupgradeneeded = () => {
        const db = opening.result;
        if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('generations')) db.createObjectStore('generations');
      };
      opening.onsuccess = () => {
        clearTimeout(timer);
        const db = opening.result;
        if (settled) { db.close(); return; }
        db.onversionchange = () => { db.close(); this.connection = null; };
        db.onclose = () => { this.connection = null; };
        resolve(db);
      };
      opening.onerror = opening.onblocked = () => { clearTimeout(timer); settled = true; resolve(null); };
    });
    return this.connection;
  }
  private async run<T>(mode: IDBTransactionMode, fallback: T, action: (tx: IDBTransaction) => Promise<T>): Promise<T> {
    const db = await this.open();
    if (!db) return fallback;
    let tx: IDBTransaction | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      tx = db.transaction(['entries', 'generations'], mode);
      const done = completed(tx);
      const work = action(tx);
      return await Promise.race([
        Promise.all([work, done]).then(([value]) => value),
        new Promise<T>(resolve => { timer = setTimeout(() => { try { tx?.abort(); } catch { /* already complete */ } resolve(fallback); }, 2000); }),
      ]);
    } catch { return fallback; }
    finally { clearTimeout(timer); }
  }
  async read(scope: string, domain: string, key: string) {
    return this.run('readonly', { available: false, token: { generation: '', scopeGeneration: '' } } as { entry?: CacheEntry; token: CacheToken; available?: boolean }, async tx => {
      const store = tx.objectStore('generations');
      const [entry, generation, scopeGeneration] = await Promise.all([
        request(tx.objectStore('entries').get(key)), request(store.get(tokenKey(scope, domain))), request(store.get(tokenKey(scope))),
      ]);
      const token = { generation: generation ?? '', scopeGeneration: scopeGeneration ?? '' };
      return { available: true, entry: entry?.generation === token.generation && entry?.scopeGeneration === token.scopeGeneration ? entry : undefined, token };
    });
  }
  async write(entry: CacheEntry): Promise<boolean> {
    const bytes = new TextEncoder().encode(JSON.stringify(entry)).byteLength;
    if (bytes > MAX_BYTES) return false;
    return this.run('readwrite', false, async tx => {
      const generations = tx.objectStore('generations');
      const [domain, scope] = await Promise.all([
        request(generations.get(tokenKey(entry.scope, entry.domain))), request(generations.get(tokenKey(entry.scope))),
      ]);
      if ((domain ?? '') !== entry.generation || (scope ?? '') !== entry.scopeGeneration) return false;
      const entries = tx.objectStore('entries');
      await request(entries.put(entry));
      const rows = await request(entries.getAll()) as CacheEntry[];
      const now = Date.now();
      const alive = rows.filter(row => row.staleUntil > now || row.retryAt > now);
      for (const row of rows) if (!alive.includes(row)) entries.delete(row.key);
      alive.sort((a, b) => a.accessedAt - b.accessedAt);
      let size = alive.reduce((sum, row) => sum + new TextEncoder().encode(JSON.stringify(row)).byteLength, 0);
      while (alive.length > MAX_ENTRIES || size > MAX_BYTES) {
        const row = alive.shift()!;
        size -= new TextEncoder().encode(JSON.stringify(row)).byteLength;
        entries.delete(row.key);
      }
      return true;
    });
  }
  async invalidate(scope: string, domains?: string[]): Promise<void> {
    await this.run('readwrite', undefined, async tx => {
      const generations = tx.objectStore('generations');
      for (const domain of domains ?? ['']) generations.put(crypto.randomUUID(), tokenKey(scope, domain));
      const entries = tx.objectStore('entries');
      await new Promise<void>((resolve, reject) => {
        const cursor = entries.openCursor();
        cursor.onerror = () => reject(cursor.error);
        cursor.onsuccess = () => {
          const row = cursor.result;
          if (!row) { resolve(); return; }
          const value = row.value as CacheEntry;
          if (value.scope === scope && (!domains || domains.includes(value.domain))) row.delete();
          row.continue();
        };
      });
    });
  }
}
export const indexedDbCacheRepository = new IndexedDbCacheRepository();
