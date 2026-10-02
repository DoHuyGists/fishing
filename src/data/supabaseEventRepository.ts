import supabase from "../database/connection";

export interface EventRow {
  id: string;
  created_at: string;
  updated_at: string | null;
  name: string;
  description: string | null;
  image: string | null;
  thumbnail: string | null;
  is_disabled: boolean;
}

export type EventPayload = Omit<EventRow, "id" | "created_at" | "updated_at">;

class SupabaseEventRepository {
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
