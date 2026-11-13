import type { DailyMissionRewardRow, DailyMissionTemplateRow, RewardPayload, TemplatePayload } from "../types/table/dailyMissionAdmin";
import supabase from "../database/connection";
import { fetchAdminListPage } from './supabaseAdminListRepository';

function repository<Row, Payload extends object>(table: string, order: string) {
  return {
    fetchPage(page: number, search: string, status: string) {
      return fetchAdminListPage<Row>(table, page, search, status === 'ALL' ? {} : { is_active: status === 'ACTIVE' });
    },
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
