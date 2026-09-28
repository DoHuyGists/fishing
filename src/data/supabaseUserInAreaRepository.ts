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
  /**
   * Cập nhật vị trí bãi câu hiện tại của user vào bảng user_in_area.
   * Nếu user chưa có thì thêm mới, nếu đã có thì cập nhật lại area_id và updated_at.
   */
  async setUserArea(userId: string, areaId: string | null): Promise<void> {
    if (!userId) return;

    const { data: existing, error: selectError } = await supabase
      .from("user_in_area")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (selectError) {
      console.warn("Lỗi khi kiểm tra user_in_area:", selectError.message);
    }

    const now = new Date().toISOString();

    if (existing) {
      const { error: updateError } = await supabase
        .from("user_in_area")
        .update({
          area_id: areaId,
          updated_at: now,
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Lỗi khi cập nhật user_in_area:", updateError.message);
        throw new Error(updateError.message);
      }
    } else {
      const { error: insertError } = await supabase
        .from("user_in_area")
        .insert({
          user_id: userId,
          area_id: areaId,
          updated_at: now,
        });

      if (insertError) {
        console.error("Lỗi khi thêm mới user_in_area:", insertError.message);
        throw new Error(insertError.message);
      }
    }
  }

  /**
   * Lấy danh sách tất cả người dùng đang ở trong bãi câu có area_id tương ứng.
   */
  async fetchUsersInArea(areaId: string): Promise<UserInAreaRow[]> {
    if (!areaId) return [];

    const { data, error } = await supabase
      .from("user_in_area")
      .select("id, created_at, area_id, user_id, updated_at")
      .eq("area_id", areaId);

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
        }
      )
      .subscribe();
  }

  /**
   * Hủy đăng ký realtime channel
   */
  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await supabase.removeChannel(channel);
  }

  async getCurrentUserArea(userId: string){
    const { data, error } = await supabase
      .from("user_in_area")
      .select("area_id")
      .eq("user_id", userId)
      .maybeSingle();

      if(error){
        throw new Error(error.message);
      }

      return data?.area_id;
  }
}

export const supabaseUserInAreaRepository = new SupabaseUserInAreaRepository();
