import type { MarketHistory, MarketListing, MarketListingQuery } from "../types/model/market";
import { t as tr } from "../i18n";
import supabase from "../database/connection";
import { listPage, pageRange } from './pagination';
import type { ListPage } from '../types/model/pagination';

function mapCaughtRow(row: any) {
  if (!row) return null;
  const species = Array.isArray(row.species) ? row.species[0] : row.species;
  return {
    id: row.id,
    user_id: row.user_id,
    species_id: row.species_id,
    weight: Number(row.weight),
    created_at: row.created_at,
    fish: species
      ? {
          id: row.species_id,
          name: species.name,
          weight: Number(row.weight),
          image: species.image,
          rarity: species.rarity,
        }
      : null,
  };
}

class SupabaseMarketRepository {
  async fetchHistory(userId: string, page: number): Promise<ListPage<MarketHistory>> {
    const { data, error, count } = await supabase.from("market_history").select("*", { count: 'exact' })
      .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`).order("created_at", { ascending: false }).order("id")
      .range(...pageRange(page));
    if (error) throw new Error(error.message);
    return listPage((data ?? []).map(row => ({ ...row, price: Number(row.price) })) as MarketHistory[], count);
  }
  async fetchActiveListings(options: MarketListingQuery): Promise<ListPage<MarketListing>> {
    const { page, pageSize, userId, search, rarity, sort } = options;
    const filteredSpecies = Boolean(search) || rarity !== 'ALL';
    const relation = filteredSpecies
      ? 'caught:caught_id!inner(id,user_id,species_id,weight,created_at,species!inner(name,image,rarity))'
      : 'caught:caught_id(id,user_id,species_id,weight,created_at,species(name,image,rarity))';
    let query = supabase.from('species_market').select('id,created_at,caught_id,user_id,price,status,' + relation, { count: 'exact' }).eq('status', 'normal');
    if (userId) query = query.eq('user_id', userId);
    if (search) query = query.ilike('caught.species.name', '%' + search.replace(/[\\%_]/g, '\\$&') + '%');
    if (rarity !== 'ALL') query = query.eq('caught.species.rarity', rarity);
    if (sort !== 'newest') query = query.order('price', { ascending: sort === 'price-asc' });
    query = query.order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(...pageRange(page, pageSize));
    const { data, error, count } = await query;
    if (error) {
      // Keep the legacy relationship fallback bounded. Filtering requires the
      // relationship query; never silently filter just one unfiltered page.
      if (filteredSpecies) throw new Error(error.message);
      return this.fetchActiveListingsFallback(options);
    }
    const list = (data ?? []) as unknown as Array<MarketListing & { caught: any }>;
    const missingIds = list.filter(row => !row.caught).map(row => row.caught_id);
    const caughtMap = new Map<string, any>();
    if (missingIds.length) {
      const { data: fish, error: fishError } = await supabase.from('caught')
        .select('id,user_id,species_id,weight,created_at,species(name,image,rarity)').in('id', missingIds);
      if (fishError) throw new Error(fishError.message);
      for (const row of fish ?? []) caughtMap.set(row.id, row);
    }
    return listPage(list.map(row => ({ ...row, price: Number(row.price), caught: mapCaughtRow(row.caught ?? caughtMap.get(row.caught_id)) })), count);
  }

  private async fetchActiveListingsFallback(options: MarketListingQuery): Promise<ListPage<MarketListing>> {
    let query = supabase.from('species_market').select('*', { count: 'exact' }).eq('status', 'normal');
    if (options.userId) query = query.eq('user_id', options.userId);
    if (options.sort !== 'newest') query = query.order('price', { ascending: options.sort === 'price-asc' });
    const { data, error, count } = await query.order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(...pageRange(options.page, options.pageSize));
    if (error) throw new Error(error.message);
    if (!data?.length) return listPage([], count);
    const { data: fish, error: fishError } = await supabase.from('caught')
      .select('id,user_id,species_id,weight,created_at,species(name,image,rarity)').in('id', data.map(row => row.caught_id));
    if (fishError) throw new Error(fishError.message);
    const caughtMap = new Map((fish ?? []).map(row => [row.id, row]));
    return listPage(data.map(row => ({ ...row, price: Number(row.price), caught: mapCaughtRow(caughtMap.get(row.caught_id)) })), count);
  }

  async cancelListing(marketId: string): Promise<void> {
    const { error: marketError } = await supabase.rpc("cancel_market_listing", {
      p_market_id: marketId,
    });

    if (marketError) throw new Error(marketError.message);
  }

  async buyFish(speciesMarketId: string): Promise<{
    success: boolean;
    market_id: string;
    caught_id: string;
    buyer_id: string;
    seller_id: string;
    price: number;
  }> {
    const { data, error } = await supabase.rpc("buy_species_with_history", {
      p_market_id: speciesMarketId,
    });
    if (error) throw new Error(error.message);
    if (data?.success === false) throw new Error(data.message || tr('supabaseMarketRepository.khong_the_mua_ca'));
    return data;
  }
}

export const supabaseMarketRepository = new SupabaseMarketRepository();
