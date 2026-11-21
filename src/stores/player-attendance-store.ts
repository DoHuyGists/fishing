import type { DailyRewardPreview } from "../types/model/dailyReward";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseDailyRewardRepository } from "../data/supabaseDailyRewardRepository";
import { supabaseCurrencyRepository } from "../data/supabaseCurrencyRepository";
import { useAuthStore } from "./auth";
import { useCurrencyStore } from "./player-currency-store";
import type { AttendanceReward } from "../types/model/attendance";

export const useAttendanceStore = defineStore("attendance", {
  state: () => ({
    possibleRewards: [] as DailyRewardPreview[],
    loadingRewards: false,
    rewardsError: "",
    nextClaimAt: null as string | null,
    dailyReward: null as { claimedAt: string; reward: AttendanceReward } | null,
    isClaimingDailyReward: false,
    statusRequest: 0,
  }),
  actions: {
    async fetchStatus() {
      const auth = useAuthStore();
      const owner = auth.user?.id, generation = auth.sessionGeneration;
      if (!owner) return;
      const request = ++this.statusRequest;
      const next = await supabaseCurrencyRepository.getNextDailyRewardAt();
      if (request !== this.statusRequest || auth.user?.id !== owner || auth.sessionGeneration !== generation) return;
      this.nextClaimAt = next;
    },
    async claimDailyReward() {
      const auth = useAuthStore();
      const owner = auth.user?.id, generation = auth.sessionGeneration;
      if (!owner || this.isClaimingDailyReward) return false;
      this.isClaimingDailyReward = true;
      // A read begun before this claim must not restore the old claim time.
      ++this.statusRequest;
      try {
        const result = await supabaseCurrencyRepository.claimDailyReward();
        if (auth.user?.id !== owner || auth.sessionGeneration !== generation) return false;
        if (!result?.success) throw new Error(result?.message || tr("AttendanceModal.khong_the_nhan_phan_thuong_hom_nay"));
        const item = result.item ?? {};
        this.dailyReward = {
          claimedAt: new Date().toISOString(),
          reward: {
            name: item.name ?? item.item_name ?? tr("AttendanceModal.phan_thuong_hang_ngay"),
            icon: item.icon ?? "🎁",
            amount: item.amount ?? item.quantity,
          },
        };
        this.nextClaimAt = result.next_claim_daily_reward_at ?? new Date(Date.now() + 86_400_000).toISOString();
        await useCurrencyStore().fetchCurrency();
        return true;
      } finally {
        if (auth.user?.id === owner && auth.sessionGeneration === generation) this.isClaimingDailyReward = false;
      }
    },
    async fetchPossibleRewards() {
      if (this.loadingRewards) return;
      this.loadingRewards = true;
      this.rewardsError = "";
      try {
        this.possibleRewards = await supabaseDailyRewardRepository.fetchRewards();
      } catch {
        this.rewardsError = tr('attendance.khong_the_tai_danh_sach_phan_qua_vui_long_thu_lai');
      } finally {
        this.loadingRewards = false;
      }
    },
  },
});
