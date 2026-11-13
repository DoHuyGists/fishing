import type { CachePolicy, CatalogDomain, GameCatalogData } from '../types/model/gameCache';

const minute = 60_000, hour = 60 * minute, day = 24 * hour;
export const catalogPolicies: Record<CatalogDomain, CachePolicy> = {
  countries: { ttl: 6 * hour, maxAge: 7 * day },
  areas: { ttl: 6 * hour, maxAge: 7 * day, feature: 'world-map' },
  species: { ttl: 6 * hour, maxAge: 7 * day, feature: 'diary' },
  guides: { ttl: day, maxAge: 7 * day, feature: 'guide' },
  shop: { ttl: 15 * minute, maxAge: day, feature: 'shop' },
  items: { ttl: 15 * minute, maxAge: day, feature: 'work-bench' },
  blueprints: { ttl: 15 * minute, maxAge: day, feature: 'work-bench' },
  skills: { ttl: 30 * minute, maxAge: day, feature: 'skill' },
  aquaculture: { ttl: 30 * minute, maxAge: day, feature: 'aquaculture' },
  rates: { ttl: 5 * minute, maxAge: 5 * minute, feature: 'redeem' },
};
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (row: Record<string, unknown>, keys: string[]) => keys.every(key => typeof row[key] === 'string');
const number = (row: Record<string, unknown>, keys: string[]) => keys.every(key => typeof row[key] === 'number' && Number.isFinite(row[key]));
const rows = (value: unknown, check: (row: Record<string, unknown>) => boolean) => Array.isArray(value) && value.every(row => object(row) && check(row));

/** Validate persisted DTOs, including fields used for calculations and rendering. */
export function validateCatalog<K extends CatalogDomain>(domain: K, data: unknown): data is GameCatalogData[K] {
  switch (domain) {
    case 'countries': return rows(data, row => text(row, ['id', 'name', 'code']) && (row.location == null || object(row.location) && number(row.location, ['k', 'lon', 'lat'])));
    case 'areas': return rows(data, row => text(row, ['id', 'countryId']) && (row.title == null || typeof row.title === 'string'));
    case 'species': return rows(data, row => text(row, ['id', 'name']) && (row.location == null || typeof row.location === 'string'));
    case 'guides': return rows(data, row => text(row, ['id', 'title', 'content']) && number(row, ['sort_order']));
    case 'items': case 'shop': return rows(data, row => text(row, ['id', 'name']) && number(row, ['price']) && (row.quantity == null || number(row, ['quantity'])));
    case 'blueprints': return rows(data, row => text(row, ['id', 'resultItemId']) && number(row, ['resultQuantity', 'goldCost'])
      && rows(row.requiredMaterials, material => text(material, ['item_id']) && number(material, ['quantity']) && Number(material.quantity) > 0));
    case 'skills': return rows(data, row => text(row, ['id', 'code', 'name']) && number(row, ['max_level', 'sort_order']) && object(row.effect_per_level) && typeof row.is_disabled === 'boolean');
    case 'aquaculture': return object(data) && rows(data.species, row => text(row, ['id', 'name']))
      && rows(data.foods, row => text(row, ['species_id', 'item_id']) && number(row, ['capacity_units_per_item', 'quality_gain'])
        && typeof row.enabled === 'boolean' && (row.item == null || object(row.item) && text(row.item, ['id', 'name'])));
    case 'rates': return rows(data, row => text(row, ['source_currency', 'target_currency']) && number(row, ['source_amount', 'target_amount'])
      && ['cash', 'shells', 'tickets'].includes(String(row.source_currency)) && ['cash', 'shells', 'tickets'].includes(String(row.target_currency))
      && Number.isSafeInteger(row.source_amount) && Number(row.source_amount) > 0 && Number.isSafeInteger(row.target_amount) && Number(row.target_amount) > 0);
  }
  return false;
}

export const catalogDependencies: Partial<Record<CatalogDomain, CatalogDomain[]>> = {
  items: ['shop', 'blueprints', 'aquaculture'], shop: ['items', 'blueprints', 'aquaculture'], species: ['aquaculture'],
  blueprints: ['items'],
};
export function expandCatalogDomains(domains: CatalogDomain[]): CatalogDomain[] {
  const affected = new Set<CatalogDomain>();
  const queue = [...domains];
  for (let index = 0; index < queue.length; index++) {
    const domain = queue[index]!;
    if (affected.has(domain)) continue;
    affected.add(domain); queue.push(...catalogDependencies[domain] ?? []);
  }
  return [...affected];
}
