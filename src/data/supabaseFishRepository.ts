import supabase from "../database/connection";

export type CaughtFishDetails = {
  id: string;
  name: string;
  weight: number;
  image: string | null;
  rarity: string | null;
};

export type CaughtRow = {
  id: string;
  created_at: string | null;
  user_id: string;
  species_id: string;
  weight: number;
  fish: CaughtFishDetails | null;
};

export type FishingInventoryRow = {
  id: string;
  created_at: string | null;
  weight: number;
  species: {
    name: string;
    image: string | null;
    rarity: string | null;
    "3d": string | null;
  } | null;
};

class SupabaseFishRepository {
  async fetchCaughtFishes(userId: string): Promise<CaughtRow[]> {
    return this.fetchAllCaughtFishes(userId);
  }

  async fetchFishingInventory(areaId: string): Promise<FishingInventoryRow[]> {
    const { data, error } = await supabase.rpc('get_caught_in_area ', {
      p_area_id: areaId
    });
    if (error) throw new Error(error.message);

    return (data ?? []) as unknown as FishingInventoryRow[];
  }

  async fetchAllCaughtFishes(userId: string): Promise<CaughtRow[]> {
    const listedCaughtIds = await this.fetchListedCaughtIds(userId);
    let query = supabase.from("caught").select("id, created_at, user_id, species_id, weight, species(name, image, rarity)").eq("user_id", userId).order("created_at", { ascending: false });
    if (listedCaughtIds.length) query = query.not("id", "in", `(${listedCaughtIds.join(",")})`);
    const { data, error } = await query;

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => {
      const species = Array.isArray(row.species) ? row.species[0] : row.species;
      return {
        id: row.id,
        created_at: row.created_at,
        user_id: row.user_id,
        species_id: row.species_id,
        weight: Number(row.weight),
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
    });
  }

  private async fetchListedCaughtIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase.from("species_market").select("caught_id").eq("user_id", userId).eq("status", "normal");

    if (error) throw new Error(error.message);

    return (data ?? []).map((listing) => listing.caught_id);
  }

  async deleteCaughtFish(caughtId: string): Promise<void> {
    const { error } = await supabase.from("caught").delete().eq("id", caughtId);

    if (error) throw new Error(error.message);
  }

  async listFishOnMarket(caughtId: string, userId: string, price: number): Promise<void> {
    const { error: marketError } = await supabase.from("species_market").insert({
      caught_id: caughtId,
      user_id: userId,
      price: price,
      status: "normal",
    });

    if (marketError) throw new Error(marketError.message);
  }
}

export const supabaseFishRepository = new SupabaseFishRepository();
