import type { FishDepthPreviewResponse, AreaSpeciesDiaryResponse } from "../types/model/fish";
import type { CaughtRow, FishingInventoryRow } from "../types/table/fish";
import supabase from "../database/connection";

class SupabaseFishRepository {
  async fetchAreaSpeciesDiary(): Promise<AreaSpeciesDiaryResponse> {
    const { data, error } = await supabase.rpc("get_area_species_diary");

    if (error) throw new Error(error.message);
    return data as unknown as AreaSpeciesDiaryResponse;
  }

  async previewFishByDepth(castDepth: number): Promise<FishDepthPreviewResponse> {
    const { data, error } = await supabase.rpc("preview_fish_by_depth", {
      p_cast_depth: castDepth,
    });

    if (error) throw new Error(error.message);
    return data as unknown as FishDepthPreviewResponse;
  }

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
      origin: row.origin ? { id: row.origin.id, country: row.origin.country, name: row.origin.name, x: row.origin.x, y: row.origin.y, location: row.origin.location, isAvailable: row.origin.is_available } : null,
    }));
  }

  async fetchFishingInventory(areaId: string): Promise<FishingInventoryRow[]> {
    const { data, error } = await supabase.rpc('get_caught_in_area', {
      p_area_id: areaId
    });
    if (error) throw new Error(error.message);

    return (data ?? []) as unknown as FishingInventoryRow[];
  }

  async fetchAllCaughtFishes(userId?: string): Promise<CaughtRow[]> {
    const [{ data, error }, farmFish] = await Promise.all([
      supabase.rpc("get_caught_in_home"),
      userId ? this.fetchFarmFishInHome(userId) : Promise.resolve([]),
    ]);

    if (error) throw new Error(error.message);

    // Older home RPCs may INNER JOIN fishing areas and omit farm transfers.
    // Merge owned stored fish without an area, preserving existing RPC rows.
    const existingIds = new Set((data ?? []).map((row: any) => row.id));
    const rows = [...farmFish.filter(row => !existingIds.has(row.id)), ...(data ?? [])];
    return rows.map((row: any) => {
      return {
        id: row.id,
        created_at: row.created_at,
        user_id: row.user_id,
        species_id: row.species_id ?? row.species.id,
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
        origin: row.origin ? {
          id: row.origin.id,
          country: row.origin.country,
          name: row.origin.name,
          x: row.origin.x,
          y: row.origin.y,
          location: row.origin.location,
          isAvailable: row.origin.is_available
        } : null
      };
    });
  }

  private async fetchFarmFishInHome(userId: string): Promise<any[]> {
    const rows: any[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("caught")
        .select("id, created_at, user_id, species_id, weight, is_shiny, variant_type, status, species(id, name, image, rarity)")
        .eq("user_id", userId).eq("status", "normal").is("area_id", null)
        .order("id").range(offset, offset + 499);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < 500) return rows;
    }
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
    const { error } = await supabase.rpc("release_in_net_fishes");

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
