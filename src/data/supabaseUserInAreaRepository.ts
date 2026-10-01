import supabase from "../database/connection";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type UserInAreaRow = {
  id: string;
  created_at: string;
  area_id: string | null;
  user_id: string;
  updated_at: string;
};

class SupabaseUserInAreaRepository {
  async setUserEnterArea(areaId: string): Promise<void> {
    const { error } = await supabase.rpc("user_enter_area", {
      p_area_id: areaId,
    });

    if (error) {
      console.error(error);
    }
  }

  async setUserLeaveArea() {
    const { error } = await supabase.rpc('user_leave_area');

    if (error) {
      console.error(error);
    }
  }

  /**
   * Lấy danh sách tất cả người dùng đang ở trong bãi câu có area_id tương ứng.
   */
  async fetchUsersInArea(areaId: string): Promise<UserInAreaRow[]> {
    if (!areaId) return [];

    const { data, error } = await supabase.from("user_in_area").select("id, created_at, area_id, user_id, updated_at").eq("area_id", areaId);

    if (error) {
      console.error("Lỗi khi lấy danh sách user_in_area:", error.message);
      throw new Error(error.message);
    }

    return data ?? [];
  }

  /**
   * Đăng ký lắng nghe thay đổi realtime trên bảng user_in_area.
   */
  subscribeToAreaUsers(onChange: () => void): RealtimeChannel {
    return supabase
      .channel("user_in_area_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_in_area",
        },
        () => {
          onChange();
        },
      )
      .subscribe();
  }

  /**
   * Hủy đăng ký realtime channel
   */
  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await supabase.removeChannel(channel);
  }

  async getCurrentUserArea(userId: string) {
    const { data, error } = await supabase.from("user_in_area").select("area_id").eq("user_id", userId).maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data?.area_id;
  }
}

export const supabaseUserInAreaRepository = new SupabaseUserInAreaRepository();
