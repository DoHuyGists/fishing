import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseBadgeRepository, type UserBadgeStatus } from "../data/supabaseBadgeRepository";
import { useCurrencyStore } from "./currency";

export const useBadgesStore = defineStore("badges", {
  state: () => ({
    badges: [] as UserBadgeStatus[],
    loading: false,
    claimingId: "",
    error: "",
    claimError: "",
  }),
  getters: {
    earnedBadges: (state) => state.badges.filter((badge) => badge.is_earned),
  },
  actions: {
    async fetchBadges() {
      this.loading = true;
      this.error = "";
      try {
        const badges = await supabaseBadgeRepository.fetchUserBadgesStatus();
        this.badges = [...badges].sort((a, b) => Number(b.is_earned) - Number(a.is_earned) || a.name.localeCompare(b.name));
      } catch (error) {
        this.error = error instanceof Error ? error.message : tr('badges.khong_the_tai_danh_sach_huy_hieu');
      } finally {
        this.loading = false;
      }
    },
    async claimReward(badgeId: string) {
      if (this.claimingId) return false;
      this.claimingId = badgeId;
      this.claimError = "";
      try {
        await supabaseBadgeRepository.claimBadgeReward(badgeId);
        await Promise.all([this.fetchBadges(), useCurrencyStore().fetchCurrency()]);
        return true;
      } catch (error) {
        this.claimError = error instanceof Error ? error.message : tr('DailyMission.khong_the_nhan_thuong');
        return false;
      } finally {
        this.claimingId = "";
      }
    },
  },
});
