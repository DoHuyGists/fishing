import { defineStore } from "pinia";
import { supabaseBadgeRepository, type Badge, type UserBadge } from "../data/supabaseBadgeRepository";

export const useBadgesStore = defineStore("badges", {
  state: () => ({
    badges: [] as Badge[],
    userBadges: [] as UserBadge[],
    loading: false,
    error: "",
    loadedUserId: "",
  }),
  getters: {
    ownedBadgeMap: (state) => new Map(state.userBadges.map((badge) => [badge.badge_id, badge])),
  },
  actions: {
    async fetchForUser(userId: string, force = false) {
      if (!userId) return;
      if (!force && this.loadedUserId === userId && this.badges.length > 0) return;
      if (this.loadedUserId && this.loadedUserId !== userId) {
        this.badges = [];
        this.userBadges = [];
      }
      this.loading = true;
      this.error = "";
      try {
        const [badges, userBadges] = await Promise.all([
          supabaseBadgeRepository.fetchBadges(),
          supabaseBadgeRepository.fetchUserBadges(userId),
        ]);
        this.badges = badges;
        this.userBadges = userBadges.filter((badge) => badge.quantity > 0);
        this.loadedUserId = userId;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Không thể tải danh sách huy hiệu";
      } finally {
        this.loading = false;
      }
    },
  },
});
