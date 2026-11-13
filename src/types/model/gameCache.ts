import type { Country } from '../../stores/country';
import type { FishingArea } from '../../stores/fishingArea';
import type { Species } from './diary';
import type { GuideRow } from '../table/guide';
import type { ShopItem, Item } from './item';
import type { Blueprint } from './blueprint';
import type { Skill } from './skill';
import type { AquacultureCatalog } from './aquaculture';
import type { CurrencyConversionRate } from './currency';

export interface GameCatalogData {
  countries: Country[];
  areas: FishingArea[];
  species: Species[];
  guides: GuideRow[];
  shop: ShopItem[];
  items: Item[];
  blueprints: Blueprint[];
  skills: Skill[];
  aquaculture: AquacultureCatalog;
  rates: CurrencyConversionRate[];
}
export type CatalogDomain = keyof GameCatalogData;
export type CacheEventKind = 'ramHit' | 'indexedDbHit' | 'joined' | 'network' | 'forced' | 'error' | 'stale' | 'invalidated' | 'storageUnavailable';
export interface CacheEvent { domain: string; kind: CacheEventKind; at: number; detail?: string }
export interface CachePolicy { ttl: number; maxAge: number; feature?: string }
export interface CacheToken { generation: string; scopeGeneration: string }
export interface CacheEntry<T = unknown> extends CacheToken {
  key: string;
  scope: string;
  domain: string;
  schemaVersion: number;
  data?: T;
  revision?: string;
  fetchedAt: number;
  expiresAt: number;
  staleUntil: number;
  retryAt: number;
  failureCount: number;
  accessedAt: number;
}
export interface CacheSnapshot<T> { data: T; revision?: string }
export interface CacheResult<T> { data: T; state: 'fresh' | 'stale'; fetchedAt: number; revision?: string; refreshError?: string }
export interface CacheStorage {
  read(scope: string, domain: string, key: string): Promise<{ entry?: CacheEntry; token: CacheToken; available?: boolean }>;
  write(entry: CacheEntry): Promise<boolean>;
  invalidate(scope: string, domains?: string[]): Promise<void>;
}
export interface CacheReadOptions<T> {
  scope: string;
  domain: string;
  parameter?: string;
  policy: CachePolicy;
  validate(data: unknown): data is T;
  load(signal: AbortSignal): Promise<CacheSnapshot<T>>;
  force?: boolean;
  expectedRevision?: string;
  current?: () => boolean;
}
