import supabase from "../../../database/connection";

export interface FishingPass {
  id: string; name: string; description: string | null; price: number; totalDays: number;
  startAt: string; endAt: string; isActive: boolean; createdAt: string;
}
export type FishingPassPayload = Omit<FishingPass, "id" | "createdAt">;
const mapRow = (row: any): FishingPass => ({ id: row.id, name: row.name, description: row.description, price: Number(row.price), totalDays: row.total_days, startAt: row.start_at, endAt: row.end_at, isActive: row.is_active, createdAt: row.created_at });
const toDb = (payload: FishingPassPayload) => ({ name: payload.name, description: payload.description, price: payload.price, total_days: payload.totalDays, start_at: payload.startAt, end_at: payload.endAt, is_active: payload.isActive });
export const supabaseFishingPassRepository = {
  async fetchAll(): Promise<FishingPass[]> {
    const { data, error } = await supabase.from("fishing_passes").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRow);
  },
  async create(payload: FishingPassPayload): Promise<FishingPass> {
    const { data, error } = await supabase.from("fishing_passes").insert(toDb(payload)).select("*").single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  },
  async update(id: string, payload: FishingPassPayload): Promise<FishingPass> {
    const { data, error } = await supabase.from("fishing_passes").update(toDb(payload)).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("fishing_passes").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
