import supabase from "../database/connection";

export interface SpeciesRow {
  id: string;
  created_at: string;
  information: string | null;
  location: string | null;
  status: string | null;
  name: string;
  image: string | null;
  "3d": string | null;
  rarity: string | null;
  weight_min: number | null;
  weight_max: number | null;
  base_catch_rate: number | null;
}

export type SpeciesPayload = Omit<SpeciesRow, "id" | "created_at">;

class SupabaseSpeciesRepository {
  async fetchAll(): Promise<SpeciesRow[]> {
    const { data, error } = await supabase.from("species").select("*").order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as SpeciesRow[];
  }

  async create(payload: SpeciesPayload): Promise<SpeciesRow> {
    const { data, error } = await supabase.from("species").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return data as SpeciesRow;
  }

  async update(id: string, payload: SpeciesPayload): Promise<SpeciesRow> {
    const { data, error } = await supabase.from("species").update(payload).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return data as SpeciesRow;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("species").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}

export const supabaseSpeciesRepository = new SupabaseSpeciesRepository();
