import supabase from "../database/connection";

export interface MarketListing {
  id: string;
  created_at: string;
  caught_id: string;
  user_id: string;
  price: number;
  status: string;
  caught?: {
    id: string;
    user_id: string;
    area_id: string;
    fish: any;
    created_at: string;
  };
}

class SupabaseMarketRepository {
  async fetchActiveListings(): Promise<MarketListing[]> {
    try {
      const { data, error } = await supabase.from("species_market").select("id, created_at, caught_id, user_id, price, status, caught:caught_id (id, user_id, area_id, fish, created_at)").eq("status", "normal").order("created_at", { ascending: false });

      if (error) {
        return this.fetchActiveListingsFallback();
      }

      const list = (data as any[]) ?? [];
      const missingItemIds = list.filter((m) => !m.caught).map((m) => m.caught_id);

      if (missingItemIds.length > 0) {
        const { data: caughtData } = await supabase.from("caught").select("id, user_id, area_id, fish, created_at").in("id", missingItemIds);

        const caughtMap = new Map((caughtData ?? []).map((c: any) => [c.id, c]));
        return list.map((m) => ({
          ...m,
          caught: m.caught ?? caughtMap.get(m.caught_id),
        }));
      }

      return list;
    } catch {
      return this.fetchActiveListingsFallback();
    }
  }

  private async fetchActiveListingsFallback(): Promise<MarketListing[]> {
    const { data: rawData, error: rawError } = await supabase.from("species_market").select("*").eq("status", "normal").order("created_at", { ascending: false });

    if (rawError || !rawData || rawData.length === 0) return [];

    const itemIds = rawData.map((m) => m.caught_id);
    const { data: caughtData } = await supabase.from("caught").select("id, user_id, area_id, fish, created_at").in("id", itemIds);

    const caughtMap = new Map((caughtData ?? []).map((c: any) => [c.id, c]));
    return rawData.map((m) => ({
      ...m,
      caught: caughtMap.get(m.caught_id),
    }));
  }

  async cancelListing(marketId: string, caughtId: string): Promise<void> {
    const { error: marketError } = await supabase.from("species_market").update({ status: "cancelled" }).eq("id", marketId);

    if (marketError) throw new Error(marketError.message);

    const { error: caughtError } = await supabase.from("caught").update({ status: "normal" }).eq("id", caughtId);

    if (caughtError) throw new Error(caughtError.message);
  }

  async buyFish(speciesMarketId: string): Promise<{
    success : boolean;
    market_id : string;
    caught_id : string;
    buyer_id : string;
    seller_id : string;
    price : number;
  }> {
    const { data, error } = await supabase.rpc('buy_market_item', {
      p_market_id: speciesMarketId
    });
    if (error) throw new Error(error.message);
    return data;
  }
}

export const supabaseMarketRepository = new SupabaseMarketRepository();
