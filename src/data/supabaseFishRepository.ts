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
  is_shiny: boolean;
  variant_type: "NORMAL" | "GOLDEN" | "MUTATED";
  species: CaughtFishDetails;
  origin: {
    id: string;
    country: string;
    name: string;
    x: number;
    y: number;
    location: { x: number; y: number }[];
    isAvailable: boolean;
  }
};

export type FishingInventoryRow = {
  id: string;
  created_at: string | null;
  weight: number;
  variant_type: "NORMAL" | "GOLDEN" | "MUTATED";
  is_shiny: boolean;
  species: {
    name: string;
    image: string | null;
    rarity: string | null;
    "3d": string | null;
  } | null;
};

class SupabaseFishRepository {
  async fetchCaughtFishes(): Promise<CaughtRow[]> {
    return this.fetchAllCaughtFishes();
  }

  async fetchFishingInventory(areaId: string): Promise<FishingInventoryRow[]> {
    const { data, error } = await supabase.rpc('get_caught_in_area ', {
      p_area_id: areaId
    });
    if (error) throw new Error(error.message);

    return (data ?? []) as unknown as FishingInventoryRow[];
  }

  async fetchAllCaughtFishes(): Promise<CaughtRow[]> {
    const { data, error } = await supabase.rpc("get_caught_in_home");

    if (error) throw new Error(error.message);

    return (data ?? []).map((row: any) => {
      return {
        id: row.id,
        created_at: row.created_at,
        user_id: row.user_id,
        weight: Number(row.weight),
        is_shiny: row.is_shiny,
        variant_type: row.variant_type,
        species: {
          id: row.species.id,
          name: row.species.name,
          weight: Number(row.weight),
          image: row.species.image,
          rarity: row.species.rarity,
        },
        origin: {
          id: row.origin.id,
          country: row.origin.country,
          name: row.origin.name,
          x: row.origin.x,
          y: row.origin.y,
          location: row.origin.location,
          isAvailable: row.origin.is_available
        }
      };
    });
  }

  async deleteCaughtFish(caughtId: string): Promise<void> {
    const { error } = await supabase.from("caught").delete().eq("id", caughtId);

    if (error) throw new Error(error.message);
  }

  async listFishOnMarket(caughtId: string, price: number): Promise<void> {
    const { data, error } = await supabase.rpc("list_species_on_market", {
      p_caught_id: caughtId,
      p_price: price,
    });

    if (error) throw new Error(error.message);

    return data;
  }
}

export const supabaseFishRepository = new SupabaseFishRepository();
