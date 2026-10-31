import supabase from "../database/connection";
import type { MissionFish } from "./supabaseMissionRepository";

export interface HourMissionRow {
  id: string;
  createdAt: string;
  content: MissionFish[];
  start: string | null;
  end: string | null;
  isDisabled: boolean;
  cash: number | null;
}

export interface HourMissionPayload {
  content: MissionFish[];
  start: string | null;
  end: string | null;
  is_disabled: boolean;
  cash: number | null;
}

const COLUMNS = 'id, created_at, content, start, "end", is_disabled, cash';

// jsonb có thể được lưu dưới dạng chuỗi JSON (dữ liệu cũ) hoặc mảng
function parseContent(value: unknown): MissionFish[] {
  if (Array.isArray(value)) return value as MissionFish[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as MissionFish[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

class SupabaseHourMissionRepository {
  async fetchAll(): Promise<HourMissionRow[]> {
    const { data, error } = await supabase
      .from("hour_missions")
      .select(COLUMNS)
      .order("start", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      content: parseContent(row.content),
      start: row.start,
      end: row.end,
      isDisabled: row.is_disabled,
      cash: row.cash === null ? null : Number(row.cash),
    }));
  }

  async create(payload: HourMissionPayload): Promise<void> {
    const { error } = await supabase.from("hour_missions").insert(payload);
    if (error) throw new Error(error.message);
  }

  async update(id: string, payload: HourMissionPayload): Promise<void> {
    const { error } = await supabase.from("hour_missions").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("hour_missions").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}

export const supabaseHourMissionRepository = new SupabaseHourMissionRepository();
