import type { SpeciesRow, SpeciesPayload } from "../types/table/species";
import supabase from "../database/connection";

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
