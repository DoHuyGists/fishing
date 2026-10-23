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
  created_at: string;
  user_id: string;
  species_id: string;
  weight: number;
  is_shiny: boolean;
  variant_type: "NORMAL" | "GOLDEN" | "MUTATED";
  species: CaughtFishDetails;
  status: string;
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

  async fetchLatestInNetCaughtFishes(userId: string, limit = 10): Promise<CaughtRow[]> {
    const { data, error } = await supabase
      .from("caught")
      .select("id, created_at, user_id, species_id, weight, is_shiny, variant_type, status, species(id, name, image, rarity), origin(id, country, name, x, y, location, is_available)")
      .eq("user_id", userId)
      .eq("status", "in-net")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    return (data ?? []).map((row: any) => ({
      id: row.id,
      created_at: row.created_at,
      user_id: row.user_id,
      species_id: row.species_id,
      weight: Number(row.weight),
      is_shiny: row.is_shiny,
      variant_type: row.variant_type,
      status: row.status,
      species: { id: row.species.id, name: row.species.name, weight: Number(row.weight), image: row.species.image, rarity: row.species.rarity },
      origin: { id: row.origin.id, country: row.origin.country, name: row.origin.name, x: row.origin.x, y: row.origin.y, location: row.origin.location, isAvailable: row.origin.is_available },
    }));
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
        status: row.status,
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

  async updateCaughtStatus(ids: string[], status: "normal" | "in-net"): Promise<void> {
    if (ids.length === 0) return;
    await Promise.all(
      ids.map(async (caughtId) => {
        const { error } = await supabase.rpc("move_species", {
          p_caught_id: caughtId,
          p_status: status,
        });

        if (error) throw new Error(error.message);
      })
    );
  }

  async deleteInNetFishes(): Promise<void> {
    const { error } = await supabase.from("caught").delete().eq("status", "in-net");

    if (error) throw new Error(error.message);
  }

  async completeFishing(): Promise<void> {
    const { error } = await supabase.rpc("user_complete_fishing");

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
