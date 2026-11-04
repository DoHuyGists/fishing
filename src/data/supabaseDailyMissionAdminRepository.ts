import supabase from "../database/connection";

interface BaseRow {
  id: string;
  created_at: string;
  updated_at: string | null;
  is_active: boolean;
}
export interface DailyMissionRewardRow extends BaseRow {
  required_points: number;
  reward_data: unknown[];
}
export interface DailyMissionTemplateRow extends BaseRow {
  code: string;
  name: string;
  description: string | null;
  event_type: string;
  target_value: number;
  mission_points: number;
  difficulty: string;
  weight: number;
  config: Record<string, unknown>;
}
export type RewardPayload = Omit<DailyMissionRewardRow, "id" | "created_at" | "updated_at">;
export type TemplatePayload = Omit<DailyMissionTemplateRow, "id" | "created_at" | "updated_at">;

function repository<Row, Payload extends object>(table: string, order: string) {
  return {
    async fetchAll(): Promise<Row[]> {
      const { data, error } = await supabase.from(table).select("*").order(order);
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    },
    async save(id: string | null, payload: Payload): Promise<Row> {
      const query = id
        ? supabase.from(table).update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id)
        : supabase.from(table).insert({ ...payload });
      const { data, error } = await query.select("*").single();
      if (error) throw new Error(error.code === "23505" ? "Mã hoặc mốc điểm đã tồn tại." : error.message);
      return data as Row;
    },
    async remove(id: string): Promise<void> {
      const { data, error } = await supabase.from(table).delete().eq("id", id).select("id").single();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Không thể xoá bản ghi.");
    },
  };
}
export const supabaseDailyMissionRewardRepository = repository<DailyMissionRewardRow, RewardPayload>("daily_mission_rewards", "required_points");
export const supabaseDailyMissionTemplateRepository = repository<DailyMissionTemplateRow, TemplatePayload>("daily_mission_templates", "code");
