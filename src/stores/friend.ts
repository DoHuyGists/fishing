import { defineStore } from "pinia";
import {
  supabaseFriendRepository,
  type FriendUserProfile,
  type UserFriend,
} from "../data/supabaseFriendRepository";

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
        this.error = err instanceof Error ? err.message : "Không thể tải dữ liệu bạn bè";
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
        this.error = err instanceof Error ? err.message : "Gửi lời mời kết bạn thất bại";
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
            : `Không thể ${accept ? "chấp nhận" : "từ chối"} lời mời`;
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
        this.error = err instanceof Error ? err.message : "Hủy lời mời kết bạn thất bại";
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
        this.error = err instanceof Error ? err.message : "Xóa bạn bè thất bại";
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
        this.error = err instanceof Error ? err.message : "Xóa yêu cầu/bạn bè thất bại";
        throw err;
      } finally {
        this.actionLoadingId = null;
      }
    },
  },
});
