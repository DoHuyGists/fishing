import supabase from '../database/connection';
import type { CacheSnapshot, CatalogDomain, GameCatalogData } from '../types/model/gameCache';
import { RepositoryError } from './repositoryError';
import { supabaseCountryRepository } from './supabaseCountryRepository';
import { supabaseFishingAreaRepository } from './supabaseFishingAreaRepository';
import { supabaseDiaryRepository } from './supabaseDiaryRepository';
import { supabaseGuideRepository } from './supabaseGuideRepository';
import { supabaseItemRepository } from './supabaseItemRepository';
import { supabaseBlueprintRepository } from './supabaseBlueprintRepository';
import { supabaseSkillRepository } from './supabaseSkillRepository';
import { supabaseAquacultureRepository } from './supabaseAquacultureRepository';
import { supabaseCurrencyRepository } from './supabaseCurrencyRepository';
import { catalogPolicies } from './gameCachePolicies';

// Enable only after the catalog migration has been applied. Legacy deployment
// keeps its RPC signatures; the versioned client never retries a failed mutation.
export const versionedCatalogEnabled = import.meta.env.VITE_GAME_CATALOG_VERSIONED === 'true';

export const supabaseGameCatalogRepository = {
  async versions(signal?: AbortSignal): Promise<Record<string, string>> {
    const query = supabase.rpc('get_game_catalog_versions');
    const { data, error, status } = await (signal ? query.abortSignal(signal) : query);
    if (error) throw new RepositoryError({ ...error, status });
    if (!data || typeof data !== 'object' || Array.isArray(data)
      || !Object.keys(catalogPolicies).every(domain => typeof data[domain] === 'string' && /^[1-9]\d*$/.test(data[domain]))) throw new RepositoryError({ message: 'Invalid catalog manifest', code: 'CATALOG_SCHEMA_MISMATCH' });
    return data;
  },
  async snapshot<K extends CatalogDomain>(domain: K, ids: string[], signal: AbortSignal): Promise<CacheSnapshot<GameCatalogData[K]>> {
    if (versionedCatalogEnabled) {
      const { data, error, status } = await supabase.rpc('get_game_catalog_snapshot', { p_domain: domain, p_ids: ids }).abortSignal(signal);
      if (error) throw new RepositoryError({ ...error, status });
      if (!data || typeof data.revision !== 'string' || !/^[1-9]\d*$/.test(data.revision) || !Object.hasOwn(data, 'data')) throw new RepositoryError({ message: 'Invalid catalog snapshot', code: 'CATALOG_SCHEMA_MISMATCH' });
      return data;
    }
    const loaders = {
      countries: () => supabaseCountryRepository.fetchCountries(signal),
      areas: () => supabaseFishingAreaRepository.fetchAreas(signal),
      species: () => supabaseDiaryRepository.fetchSpecies(signal),
      guides: () => supabaseGuideRepository.fetchAll(signal),
      shop: () => supabaseItemRepository.fetchShopItems(signal),
      items: () => supabaseItemRepository.fetchByIds(ids, signal),
      blueprints: () => supabaseBlueprintRepository.fetchAll(signal),
      skills: () => supabaseSkillRepository.fetchSkills(signal),
      aquaculture: () => supabaseAquacultureRepository.fetchCatalog(signal),
      rates: () => supabaseCurrencyRepository.fetchConversionRates(signal),
    };
    return { data: await loaders[domain]() as GameCatalogData[K] };
  },
  async action<T>(action: string, args: Record<string, unknown>, revisions: Record<string, string>): Promise<T> {
    const { data, error, status } = await supabase.rpc('execute_game_catalog_action', { p_action: action, p_args: args, p_expected: revisions });
    if (error) throw new RepositoryError({ ...error, status });
    if (data?.success === false) throw new RepositoryError({ message: data.message ?? 'Action failed', code: data.code, details: data.details });
    return data as T;
  },
};
