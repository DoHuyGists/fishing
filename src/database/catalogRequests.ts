import type { CatalogDomain } from '../types/model/gameCache';
import { catalogPolicies } from '../data/gameCachePolicies';
import { catalogRequestBody } from './requestBody.ts';
export async function featureRequestUrl(url: URL, input: RequestInfo | URL, init?: RequestInit): Promise<URL> {
  if (!/\/rest\/v1\/rpc\/(execute_game_catalog_action|get_game_catalog_snapshot)$/.test(url.pathname)) return url;
  const body = await catalogRequestBody(input, init);
  const mapped = new URL(url);
  if (url.pathname.endsWith('/execute_game_catalog_action') && typeof body.p_action === 'string') mapped.pathname = '/rest/v1/rpc/' + body.p_action;
  if (url.pathname.endsWith('/get_game_catalog_snapshot') && typeof body.p_domain === 'string') {
    const feature = catalogPolicies[body.p_domain as CatalogDomain]?.feature;
    // Routes used only to resolve the existing feature catalog; no network call
    // is redirected. The server checks the domain/action again independently.
    const routes: Record<string, string> = { 'world-map': 'fishing_areas', diary: 'species', guide: 'guides', shop: 'rpc/purchase_item', 'work-bench': 'blueprint', skill: 'rpc/upgrade_skill', aquaculture: 'aquaculture_species_rules', redeem: 'rpc/get_currency_conversion_rates' };
    if (feature && routes[feature]) mapped.pathname = '/rest/v1/' + routes[feature];
  }
  return mapped;
}

const tables: Record<string, CatalogDomain[]> = {
  countries: ['countries'], fishing_areas: ['areas'], species: ['species'], guides: ['guides'],
  items: ['items', 'shop'], blueprint: ['blueprints'], skills: ['skills'], aquaculture_species_rules: ['aquaculture'],
  aquaculture_species_foods: ['aquaculture'], currency_conversion_rates: ['rates'],
};
let capture: ((domains: CatalogDomain[]) => () => void) | undefined;
export function setCatalogMutationHandler(handler: typeof capture) { capture = handler; }
export function createCatalogMutationFetch(baseUrl: string, transport: typeof fetch): typeof fetch {
  const origin = new URL(baseUrl).origin;
  return async (input, init) => {
    const request = input instanceof Request ? input : undefined;
    const url = new URL(request?.url ?? String(input));
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    const table = url.pathname.split('/rest/v1/')[1];
    const domains = url.origin === origin && ['POST', 'PATCH', 'DELETE'].includes(method) && table ? tables[table] : undefined;
    const notify = domains ? capture?.(domains) : undefined;
    const response = await transport(input, init);
    if (response.ok) notify?.();
    const retry = response.headers.get('Retry-After');
    if (url.origin === origin && [429, 503].includes(response.status) && retry) {
      const milliseconds = /^\d+(\.\d+)?$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now();
      if (Number.isFinite(milliseconds) && milliseconds > 0) {
        try {
          const body = await response.clone().json();
          let detail: Record<string, unknown> = {};
          try { const parsed = JSON.parse(body.details); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) detail = parsed; } catch { /* Preserve text below. */ }
          body.details = JSON.stringify({ ...detail, originalDetails: body.details, retryAfterMs: milliseconds });
          const headers = new Headers(response.headers);
          headers.delete('Content-Length'); headers.delete('Content-Encoding'); headers.set('Content-Type', 'application/json');
          return new Response(JSON.stringify(body), { status: response.status, statusText: response.statusText, headers });
        } catch { /* Preserve non-JSON upstream errors. */ }
      }
    }
    return response;
  };
}
