import supabase from "../database/connection";

export type FriendStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED";

export interface UserFriend {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendStatus;
  created_at: string;
  updated_at: string;
}

export interface FriendUserProfile {
  id: string;
  experience_point: number;
  level: number;
  inventory_capacity: number;
  species_storage_capacity: number;
  created_at: string;
  updated_at: string;
}

class SupabaseFriendRepository {
  /**
   * Lấy tất cả quan hệ bạn bè mà người chơi tham gia (gửi hoặc nhận)
   */
  async fetchFriends(userId: string): Promise<UserFriend[]> {
    if (!userId) return [];

    const { data, error } = await supabase
      .from("user_friends")
      .select("*")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message || "Không thể tải danh sách quan hệ bạn bè");
    }

    return (data ?? []) as UserFriend[];
  }

  /**
   * Lấy danh sách hồ sơ người chơi từ bảng user_profile
   */
  async fetchUserProfiles(): Promise<FriendUserProfile[]> {
    const { data, error } = await supabase
      .from("user_profile")
      .select("*")
      .order("level", { ascending: false });

    if (error) {
      throw new Error(error.message || "Không thể tải danh sách người chơi");
    }

    return (data ?? []) as FriendUserProfile[];
  }

  /**
   * Gửi yêu cầu kết bạn tới friendId qua RPC send_friend_request
   */
  async sendFriendRequest(friendId: string): Promise<void> {
    const { error } = await supabase.rpc("send_friend_request", {
      p_friend_id: friendId,
    });

    if (error) {
      throw new Error(error.message || "Không thể gửi yêu cầu kết bạn");
    }
  }

  /**
   * Phản hồi yêu cầu kết bạn (chấp nhận hoặc từ chối) qua RPC respond_friend_request
   */
  async respondFriendRequest(requestId: string, accept: boolean): Promise<void> {
    const { error } = await supabase.rpc("respond_friend_request", {
      p_request_id: requestId,
      p_accept: accept,
    });

    if (error) {
      throw new Error(error.message || `Không thể ${accept ? "chấp nhận" : "từ chối"} yêu cầu`);
    }
  }

  /**
   * Hủy lời mời kết bạn qua RPC cancel_friend_request
   */
  async cancelFriendRequest(requestId: string): Promise<void> {
    const { error } = await supabase.rpc("cancel_friend_request", {
      p_request_id: requestId,
    });

    if (error) {
      throw new Error(error.message || "Không thể hủy lời mời kết bạn");
    }
  }

  /**
   * Xóa bạn qua RPC remove_friend
   */
  async removeFriend(friendId: string): Promise<void> {
    const { error } = await supabase.rpc("remove_friend", {
      p_friend_id: friendId,
    });

    if (error) {
      throw new Error(error.message || "Không thể xóa bạn bè");
    }
  }

  /**
   * Xóa yêu cầu kết bạn / lời mời / quan hệ bạn bè
   */
  async deleteFriendRecord(recordId: string): Promise<void> {
    const { error } = await supabase
      .from("user_friends")
      .delete()
      .eq("id", recordId);

    if (error) {
      throw new Error(error.message || "Không thể xóa yêu cầu/bạn bè");
    }
  }
}

export const supabaseFriendRepository = new SupabaseFriendRepository();
