import type { FriendUserProfile, UserFriend, FriendTab } from "../types/model/friend";
import { useAuthStore } from './auth';
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
    activeTab: 'friends' as FriendTab,
    search: '',
    page: 1,
    pageSize: 10,
    total: 0,
    counts: { friends: 0, received: 0, sent: 0, discover: 0 },
    requestId: 0,
    ownerId: '',
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
    async loadData(currentUserId: string, page?: number) {
      page ??= this.page;
      if (!currentUserId) return;
      const auth = useAuthStore(), generation = auth.sessionGeneration;
      if (this.ownerId !== currentUserId) {
        this.$reset(); this.ownerId = currentUserId; page = 1;
      }
      const request = ++this.requestId;
      const current = () => request === this.requestId && auth.user?.id === currentUserId && auth.sessionGeneration === generation;
      this.loading = true;
      this.error = "";

      try {
        const result = await supabaseFriendRepository.fetchPage(this.activeTab, this.search, page);
        if (!current()) return;
        this.friends = result.friends; this.profiles = result.profiles;
        this.total = result.total; this.counts = result.counts; this.page = page;
        if (!result.profiles.length && page > 1) await this.loadData(currentUserId, Math.max(1, Math.ceil(result.total / this.pageSize)));
      } catch (err) {
        if (current()) this.error = err instanceof Error ? err.message : tr('friend.khong_the_tai_du_lieu_ban_be');
      } finally {
        if (current()) this.loading = false;
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
