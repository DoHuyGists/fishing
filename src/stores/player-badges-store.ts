import type { BadgeStatusFilter, UserBadgeStatus } from "../types/model/badge";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseBadgeRepository } from "../data/supabaseBadgeRepository";
import { useCurrencyStore } from "./player-currency-store";
import { useAuthStore } from "./auth";
import { LIST_PAGE_SIZE } from "../data/pagination";

export const useBadgesStore = defineStore("badges", {
  state: () => ({
    badges: [] as UserBadgeStatus[],
    loading: false,
    claimingId: "",
    error: "",
    claimError: "",
    page: 1,
    pageSize: LIST_PAGE_SIZE,
    total: 0,
    collectionTotal: 0,
    earnedTotal: 0,
    badgeTypes: [] as string[],
    searchQuery: "",
    selectedType: "all",
    statusFilter: "all" as BadgeStatusFilter,
    requestId: 0,
    ownerId: "",
  }),
  getters: {
    completion: (state) => state.collectionTotal ? Math.round(state.earnedTotal / state.collectionTotal * 100) : 0,
  },
  actions: {
    invalidateRequest() {
      this.requestId++;
      this.loading = true;
      this.badges = [];
    },
    async fetchBadges(page?: number): Promise<void> {
      page ??= this.page;
      const auth = useAuthStore();
      const userId = auth.user?.id;
      const generation = auth.sessionGeneration;
      if (!userId) { this.$reset(); return; }
      if (this.ownerId !== userId) {
        this.$reset();
        this.ownerId = userId;
        page = 1;
      }
      const request = ++this.requestId;
      const current = () => request === this.requestId && auth.user?.id === userId && auth.sessionGeneration === generation;
      this.loading = true;
      this.error = "";
      this.badges = [];
      try {
        const result = await supabaseBadgeRepository.fetchPage(page, this.searchQuery, this.selectedType, this.statusFilter);
        if (!current()) return;
        this.badges = result.items;
        this.total = result.total;
        this.collectionTotal = result.collectionTotal;
        this.earnedTotal = result.earnedTotal;
        this.badgeTypes = result.types;
        this.page = page;
        if (!result.items.length && page > 1) {
          await this.fetchBadges(Math.max(1, Math.ceil(result.total / this.pageSize)));
        }
      } catch (error) {
        if (current()) this.error = error instanceof Error ? error.message : tr("badges.khong_the_tai_danh_sach_huy_hieu");
      } finally {
        if (current()) this.loading = false;
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
        this.claimError = error instanceof Error ? error.message : tr("DailyMission.khong_the_nhan_thuong");
        return false;
      } finally {
        this.claimingId = "";
      }
    },
  },
});
