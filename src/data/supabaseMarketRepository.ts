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
    species_id: string;
    weight: number;
    fish: {
      id: string;
      name: string;
      weight: number;
      image: string | null;
      rarity: string | null;
    } | null;
    created_at: string | null;
  } | null;
}

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
  async fetchActiveListings(): Promise<MarketListing[]> {
    try {
      const { data, error } = await supabase.from("species_market").select("id, created_at, caught_id, user_id, price, status, caught:caught_id (id, user_id, species_id, weight, created_at, species(name, image, rarity))").eq("status", "normal").order("created_at", { ascending: false });

      if (error) {
        return this.fetchActiveListingsFallback();
      }

      const list = (data as any[]) ?? [];
      const missingItemIds = list.filter((m) => !m.caught).map((m) => m.caught_id);

      if (missingItemIds.length > 0) {
        const { data: caughtData } = await supabase.from("caught").select("id, user_id, species_id, weight, created_at, species(name, image, rarity)").in("id", missingItemIds);

        const caughtMap = new Map((caughtData ?? []).map((c: any) => [c.id, c]));
        return list.map((m) => ({
          ...m,
          caught: m.caught ? mapCaughtRow(m.caught) : mapCaughtRow(caughtMap.get(m.caught_id)),
        }));
      }

      return list.map((m) => ({ ...m, caught: m.caught ? mapCaughtRow(m.caught) : null }));
    } catch {
      return this.fetchActiveListingsFallback();
    }
  }

  private async fetchActiveListingsFallback(): Promise<MarketListing[]> {
    const { data: rawData, error: rawError } = await supabase.from("species_market").select("*").eq("status", "normal").order("created_at", { ascending: false });

    if (rawError || !rawData || rawData.length === 0) return [];

    const itemIds = rawData.map((m) => m.caught_id);
    const { data: caughtData } = await supabase.from("caught").select("id, user_id, species_id, weight, created_at, species(name, image, rarity)").in("id", itemIds);

    const caughtMap = new Map((caughtData ?? []).map((c: any) => [c.id, c]));
    return rawData.map((m) => ({
      ...m,
      caught: mapCaughtRow(caughtMap.get(m.caught_id)),
    }));
  }

  async cancelListing(marketId: string): Promise<void> {
    const { error: marketError } = await supabase.from("species_market").update({ status: "cancelled" }).eq("id", marketId);

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
    const { data, error } = await supabase.rpc("buy_species_from_market", {
      p_market_id: speciesMarketId,
    });
    if (error) throw new Error(error.message);
    return data;
  }
}

export const supabaseMarketRepository = new SupabaseMarketRepository();
