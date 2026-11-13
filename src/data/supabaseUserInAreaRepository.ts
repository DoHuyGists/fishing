import type { UserInAreaRow } from "../types/table/userInArea";
import type { UserTurnStatus } from "../types/model/userInArea";
import supabase from "../database/connection";

class SupabaseUserInAreaRepository {
  async fetchTurnStatus(): Promise<UserTurnStatus> {
    const { data, error } = await supabase.rpc("get_user_status");
    if (error) throw new Error(error.message);
    return data as UserTurnStatus;
  }

  async consumeTurn(): Promise<UserTurnStatus | null> {
    const { data, error } = await supabase.rpc("consume_turn");
    if (error) throw new Error(error.message);
    return data as UserTurnStatus | null;
  }

  async setUserEnterArea(areaId: string): Promise<void> {
    const { error } = await supabase.rpc("user_enter_area", {
      p_area_id: areaId,
    });

    if (error) throw new Error(error.message);
  }

  async setUserLeaveArea() {
    const { error } = await supabase.rpc('user_leave_area');

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Lấy danh sách tất cả người dùng đang ở trong bãi câu có area_id tương ứng.
   */
  async fetchUsersInArea(areaId: string): Promise<UserInAreaRow[]> {
    if (!areaId) return [];

    const { data, error } = await supabase.from("user_in_area").select("id, created_at, area_id, user_id, updated_at, status").eq("area_id", areaId);

    if (error) {
      console.error("Lỗi khi lấy danh sách user_in_area:", error.message);
      throw new Error(error.message);
    }

    return data ?? [];
  }

  async getCurrentUserArea(userId: string) : Promise<UserInAreaRow | null> {
    const { data, error } = await supabase.from("user_in_area").select("*").eq("user_id", userId).maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }
}

export const supabaseUserInAreaRepository = new SupabaseUserInAreaRepository();
