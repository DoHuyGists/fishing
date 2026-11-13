import type { EventRow, EventPayload } from "../types/table/event";
import supabase from "../database/connection";
import { fetchAdminListPage } from './supabaseAdminListRepository';

class SupabaseEventRepository {
  fetchPage(page: number, search: string, status: string) {
    return fetchAdminListPage<EventRow>('event', page, search, status === 'ALL' ? {} : { is_disabled: status === 'DISABLED' });
  }
  async fetchAll(): Promise<EventRow[]> {
    const { data, error } = await supabase.from("event").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as EventRow[];
  }

  async create(payload: EventPayload): Promise<EventRow> {
    const { data, error } = await supabase.from("event").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return data as EventRow;
  }

  async update(id: string, payload: EventPayload): Promise<EventRow> {
    const { data, error } = await supabase
      .from("event")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as EventRow;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("event").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}

export const supabaseEventRepository = new SupabaseEventRepository();
