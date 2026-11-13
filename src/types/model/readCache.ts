export interface ReadCachePolicy {
  ttl: number;
  persist?: boolean;
  feature?: string;
  hourBoundary?: boolean;
}
export interface CachedHttpRead {
  body: string | null;
  status: number;
  headers: [string, string][];
}
export interface ReadCacheContext {
  bypassReads?: boolean;
  matchesAuthorization?(authorization: string | null): boolean;
  current(): boolean;
  read(domain: string, key: string, load: (signal: AbortSignal) => Promise<CachedHttpRead>): Promise<CachedHttpRead>;
  invalidate(domains?: string[]): Promise<void>;
}
