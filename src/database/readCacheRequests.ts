import { cachedReadRpcs, cachedReadTables, personalReadDomains, catalogReadDomains, uncachedReadRpcs } from '../data/readCachePolicies';
import { catalogRequestBody } from './requestBody.ts';
import type { CachedHttpRead, ReadCacheContext } from '../types/model/readCache';
import { RepositoryError } from '../data/repositoryError';
import { CacheContextChangedError } from '../utils/gameCache';

let capture: (() => ReadCacheContext | undefined) | undefined;
export function setReadCacheHandler(handler: typeof capture) { capture = handler; }
const requestContext = Symbol('read-cache-owner');
type ContextInit = RequestInit & { [requestContext]?: ReadCacheContext };
// Capture before feature guards/body parsing can await and switch the login.
// The symbol travels only through local fetch adapters, never as an HTTP header.
export function createReadCacheContextFetch(transport: typeof fetch): typeof fetch {
  return (input, init) => transport(input, { ...init, [requestContext]: capture?.() } as ContextInit);
}
class UncachedResponse extends Error {
  readonly response: Response;
  constructor(response: Response) { super('Response is not cacheable'); this.response = response; }
}
class TemporaryReadResponse extends RepositoryError {
  readonly response: Response;
  constructor(response: Response) {
    const retry = response.headers.get('Retry-After');
    const retryAfterMs = retry ? /^\d+(\.\d+)?$/.test(retry) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now()) : 0;
    super({ message: 'Read request temporarily unavailable', status: response.status, details: JSON.stringify({ retryAfterMs }) });
    this.response = response;
  }
}
const replay = (read: CachedHttpRead) => new Response(read.body, { status: read.status, headers: read.headers });

/** Feature authorization runs outside this adapter, including every cache hit.
 * Only whitelisted reads are cached; writes are always executed exactly once. */
export function createReadCacheFetch(baseUrl: string, transport: typeof fetch = (...args) => globalThis.fetch(...args)): typeof fetch {
  const origin = new URL(baseUrl).origin;
  return async (input, init) => {
    const captured = init && Object.hasOwn(init, requestContext);
    const ownerContext = (init as ContextInit | undefined)?.[requestContext];
    if (captured) { const clean = { ...init } as ContextInit; delete clean[requestContext]; init = clean; }
    const request = input instanceof Request ? input : undefined;
    const url = new URL(request?.url ?? String(input));
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    const path = url.pathname.split('/rest/v1/')[1];
    if (url.origin !== origin || !path) return transport(input, init);
    // Capture the owner before asynchronous Request-body parsing.
    const context = captured ? ownerContext : capture?.();
    if (!context) return transport(input, init);
    const headers = new Headers(request?.headers);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    // Supabase awaits token retrieval before invoking custom fetch. A request
    // built for an older login must not enter the new owner's cache or mutate.
    if (context.matchesAuthorization?.(headers.get('Authorization')) === false) throw new CacheContextChangedError();
    const rpc = path.startsWith('rpc/') ? path.slice(4) : undefined;
    const isRead = rpc ? ['GET', 'POST'].includes(method) && Boolean(cachedReadRpcs[rpc]) : ['GET', 'HEAD'].includes(method);
    const domain = isRead ? rpc ? cachedReadRpcs[rpc] : cachedReadTables[path] : undefined;
    if (domain && !context.bypassReads) {
      if (['no-store', 'reload', 'no-cache'].includes(init?.cache ?? request?.cache ?? '') || /no-cache|no-store|max-age=0/i.test(headers.get('Cache-Control') ?? '')) {
        await context.invalidate([domain]);
      }
      // Non-public schemas and alternative response formats are outside these policies.
      if (['Accept-Profile', 'Content-Profile'].some(name => headers.has(name) && headers.get(name) !== 'public')) return transport(input, init);
      const body = rpc && method === 'POST' ? await catalogRequestBody(input, init) : null;
      url.searchParams.sort();
      const vary = ['accept', 'prefer', 'range', 'range-unit', 'accept-profile', 'accept-language'].map(key => [key, headers.get(key)]);
      const key = JSON.stringify([url.pathname, url.search, method, body, vary]);
      const signal = init?.signal ?? request?.signal;
      if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
      const work = context.read(domain, key, async cacheSignal => {
        const response = await transport(request ? request.clone() : input, { ...init, signal: cacheSignal });
        if (response.status === 429 || response.status >= 500) throw new TemporaryReadResponse(response);
        if (![200, 206].includes(response.status)) throw new UncachedResponse(response);
        const text = method === 'HEAD' ? null : await response.clone().text();
        if (text !== null) {
          let json: unknown;
          try { json = JSON.parse(text); } catch { throw new UncachedResponse(response); }
          if (text.length > 5 * 1024 * 1024 || json && typeof json === 'object' && 'success' in json && json.success === false) throw new UncachedResponse(response);
        }
        const savedHeaders: [string, string][] = [];
        for (const name of ['Content-Type', 'Content-Range', 'Range-Unit']) {
          const value = response.headers.get(name); if (value !== null) savedHeaders.push([name, value]);
        }
        return { body: text, status: response.status, headers: savedHeaders };
      });
      // Aborting one caller must not cancel a shared request needed by others.
      let abort: (() => void) | undefined;
      try {
        const value = signal ? await Promise.race([work, new Promise<never>((_, reject) => {
          abort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
          signal.addEventListener('abort', abort, { once: true });
          if (signal.aborted) abort();
        })]) : await work;
        return replay(value);
      } catch (error) {
        if (error instanceof UncachedResponse || error instanceof TemporaryReadResponse) return error.response.clone();
        throw error;
      } finally { if (signal && abort) signal.removeEventListener('abort', abort); }
    }
    const writesTable = !rpc && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const writesRpc = Boolean(rpc && method === 'POST' && !cachedReadRpcs[rpc] && !uncachedReadRpcs.has(rpc));
    const staticDomain = cachedReadTables[path];
    const staticDomains = writesTable && staticDomain && catalogReadDomains.includes(staticDomain) ? [staticDomain] : [];
    // Invalidate embedded projections when their joined rows change.
    if (writesTable && path === 'items') staticDomains.push('dailyRewards');
    if (writesTable && path === 'faction_effects') staticDomains.push('factions');
    const invalidate = async () => {
      if ((writesTable || writesRpc) && context.current()) {
        // Cache maintenance must never turn a committed mutation into a failure.
        await context.invalidate([...new Set([...personalReadDomains, ...staticDomains])]).catch(() => {});
      }
    };
    let response: Response;
    try { response = await transport(input, init); }
    catch (error) { await invalidate(); throw error; } // Outcome may be committed.
    if ((writesTable || writesRpc) && response.ok) {
      let success = true;
      try { const text = await response.clone().text(); if (text.trim()) success = JSON.parse(text)?.success !== false; }
      catch { /* An empty/non-JSON successful write still invalidates reads. */ }
      if (success) await invalidate();
    } else if (response.status >= 500 || response.status === 408) {
      await invalidate(); // Uncertain write outcome; do not serve the old snapshot.
    }
    return response;
  };
}
