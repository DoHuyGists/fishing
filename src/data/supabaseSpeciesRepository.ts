import type { SpeciesRow, SpeciesPayload } from "../types/table/species";
import supabase from "../database/connection";
import { readCatalogPages } from './readCatalogPages';
import { fetchAdminListPage } from './supabaseAdminListRepository';

class SupabaseSpeciesRepository {
  async fetchById(id: string): Promise<SpeciesRow> {
    const { data, error } = await supabase.from('species').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data as SpeciesRow;
  }

  fetchPage(page: number, search: string, rarity: string) {
    return fetchAdminListPage<SpeciesRow>('species', page, search, {
      ...(rarity === 'ALL' ? {} : { rarity }),
    });
  }
  async fetchAll(): Promise<SpeciesRow[]> {
    return readCatalogPages<SpeciesRow>((from, to) => supabase.from("species").select("*")
      .order("name", { ascending: true }).order("id").range(from, to));
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
