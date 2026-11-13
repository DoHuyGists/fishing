import type { UserFriend, FriendUserProfile, FriendListPage, FriendTab } from "../types/model/friend";
import { t as tr } from "../i18n";
import supabase from "../database/connection";
import { supabaseAvatarRepository } from "./supabaseAvatarRepository";

class SupabaseFriendRepository {
  async fetchPage(tab: FriendTab, search: string, page: number): Promise<FriendListPage> {
    const { data, error } = await supabase.rpc('get_friend_list_page', { p_tab: tab, p_search: search.trim(), p_page: page });
    if (error) throw new Error(error.message);
    const result = data as FriendListPage;
    return { ...result, profiles: await supabaseAvatarRepository.resolveProfiles(result.profiles) };
  }

  async fetchProfilesByIds(ids: string[]): Promise<FriendUserProfile[]> {
    if (!ids.length) return [];
    const { data, error } = await supabase.from('user_profile').select('*').in('id', ids);
    if (error) throw new Error(error.message);
    return supabaseAvatarRepository.resolveProfiles((data ?? []) as FriendUserProfile[]);
  }

  async fetchRelationsForUsers(userId: string, ids: string[]): Promise<UserFriend[]> {
    if (!ids.length) return [];
    const { data, error } = await supabase.from('user_friends').select('*')
      .or(`and(user_id.eq.${userId},friend_id.in.(${ids.join(',')})),and(friend_id.eq.${userId},user_id.in.(${ids.join(',')}))`);
    if (error) throw new Error(error.message);
    return (data ?? []) as UserFriend[];
  }
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
      throw new Error(error.message || tr('supabaseFriendRepository.khong_the_tai_danh_sach_quan_he_ban_be'));
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
      throw new Error(error.message || tr('supabaseFriendRepository.khong_the_tai_danh_sach_nguoi_choi'));
    }

    return supabaseAvatarRepository.resolveProfiles((data ?? []) as FriendUserProfile[]);
  }

  /**
   * Gửi yêu cầu kết bạn tới friendId qua RPC send_friend_request
   */
  async sendFriendRequest(friendId: string): Promise<void> {
    const { error } = await supabase.rpc("send_friend_request", {
      p_friend_id: friendId,
    });

    if (error) {
      throw new Error(error.message || tr('supabaseFriendRepository.khong_the_gui_yeu_cau_ket_ban'));
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
      throw new Error(error.message || tr('supabaseFriendRepository.khong_the_value0_yeu_cau', { value0: accept ? tr('supabaseFriendRepository.chap_nhan') : tr('supabaseFriendRepository.tu_choi') }));
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
      throw new Error(error.message || tr('supabaseFriendRepository.khong_the_huy_loi_moi_ket_ban'));
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
      throw new Error(error.message || tr('supabaseFriendRepository.khong_the_xoa_ban_be'));
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
      throw new Error(error.message || tr('supabaseFriendRepository.khong_the_xoa_yeu_cau_ban_be'));
    }
  }
}

export const supabaseFriendRepository = new SupabaseFriendRepository();
