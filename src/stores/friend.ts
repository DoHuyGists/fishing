import type { FriendUserProfile, UserFriend } from "../types/model/friend";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseFriendRepository } from "../data/supabaseFriendRepository";

export type FriendshipRelation =
  | { type: "SELF" }
  | { type: "ACCEPTED"; record: UserFriend }
  | { type: "SENT_PENDING"; record: UserFriend }
  | { type: "RECEIVED_PENDING"; record: UserFriend }
  | { type: "NONE" };

export const useFriendStore = defineStore("friend", {
  state: () => ({
    friends: [] as UserFriend[],
    profiles: [] as FriendUserProfile[],
    loading: false,
    actionLoadingId: null as string | null,
    error: "",
  }),

  getters: {
    profilesMap: (state): Map<string, FriendUserProfile> => {
      const map = new Map<string, FriendUserProfile>();
      state.profiles.forEach((profile) => {
        map.set(profile.id, profile);
      });
      return map;
    },

    acceptedFriends: (state): UserFriend[] => {
      return state.friends.filter((friend) => friend.status === "ACCEPTED");
    },

    getReceivedRequests: (state) => (currentUserId: string): UserFriend[] => {
      if (!currentUserId) return [];
      return state.friends.filter(
        (friend) => friend.friend_id === currentUserId && friend.status === "PENDING"
      );
    },

    getSentRequests: (state) => (currentUserId: string): UserFriend[] => {
      if (!currentUserId) return [];
      return state.friends.filter(
        (friend) => friend.user_id === currentUserId && friend.status === "PENDING"
      );
    },

    getFriendshipWithUser:
      (state) =>
      (targetUserId: string, currentUserId: string): FriendshipRelation => {
        if (!targetUserId || !currentUserId) return { type: "NONE" };
        if (targetUserId === currentUserId) return { type: "SELF" };

        const directRecord = state.friends.find(
          (item) =>
            (item.user_id === currentUserId && item.friend_id === targetUserId) ||
            (item.user_id === targetUserId && item.friend_id === currentUserId)
        );

        if (!directRecord) return { type: "NONE" };

        if (directRecord.status === "ACCEPTED") {
          return { type: "ACCEPTED", record: directRecord };
        }

        if (directRecord.status === "PENDING") {
          if (directRecord.user_id === currentUserId) {
            return { type: "SENT_PENDING", record: directRecord };
          }
          return { type: "RECEIVED_PENDING", record: directRecord };
        }

        return { type: "NONE" };
      },
  },

  actions: {
    async loadData(currentUserId: string) {
      if (!currentUserId) return;

      this.loading = true;
      this.error = "";

      try {
        const [friendsData, profilesData] = await Promise.all([
          supabaseFriendRepository.fetchFriends(currentUserId),
          supabaseFriendRepository.fetchUserProfiles(),
        ]);

        this.friends = friendsData;
        this.profiles = profilesData;
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('friend.khong_the_tai_du_lieu_ban_be');
      } finally {
        this.loading = false;
      }
    },

    async sendFriendRequest(friendId: string, currentUserId: string): Promise<boolean> {
      if (!friendId || friendId === currentUserId) return false;

      this.actionLoadingId = friendId;
      this.error = "";

      try {
        await supabaseFriendRepository.sendFriendRequest(friendId);
        await this.loadData(currentUserId);
        return true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('friend.gui_loi_moi_ket_ban_that_bai');
        throw err;
      } finally {
        this.actionLoadingId = null;
      }
    },

    async respondFriendRequest(
      requestId: string,
      accept: boolean,
      currentUserId: string
    ): Promise<boolean> {
      if (!requestId) return false;

      this.actionLoadingId = requestId;
      this.error = "";

      try {
        await supabaseFriendRepository.respondFriendRequest(requestId, accept);
        await this.loadData(currentUserId);
        return true;
      } catch (err) {
        this.error =
          err instanceof Error
            ? err.message
            : tr('friend.khong_the_value0_loi_moi', { value0: accept ? tr('supabaseFriendRepository.chap_nhan') : tr('supabaseFriendRepository.tu_choi') });
        throw err;
      } finally {
        this.actionLoadingId = null;
      }
    },

    async cancelFriendRequest(
      requestId: string,
      currentUserId: string
    ): Promise<boolean> {
      if (!requestId) return false;

      this.actionLoadingId = requestId;
      this.error = "";

      try {
        await supabaseFriendRepository.cancelFriendRequest(requestId);
        await this.loadData(currentUserId);
        return true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('friend.huy_loi_moi_ket_ban_that_bai');
        throw err;
      } finally {
        this.actionLoadingId = null;
      }
    },

    async removeFriend(
      friendId: string,
      currentUserId: string
    ): Promise<boolean> {
      if (!friendId) return false;

      this.actionLoadingId = friendId;
      this.error = "";

      try {
        await supabaseFriendRepository.removeFriend(friendId);
        await this.loadData(currentUserId);
        return true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('friend.xoa_ban_be_that_bai');
        throw err;
      } finally {
        this.actionLoadingId = null;
      }
    },

    async deleteFriendRecord(recordId: string, currentUserId: string): Promise<boolean> {
      if (!recordId) return false;

      this.actionLoadingId = recordId;
      this.error = "";

      try {
        await supabaseFriendRepository.deleteFriendRecord(recordId);
        this.friends = this.friends.filter((item) => item.id !== recordId);
        await this.loadData(currentUserId);
        return true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('friend.xoa_yeu_cau_ban_be_that_bai');
        throw err;
      } finally {
        this.actionLoadingId = null;
      }
    },
  },
});
