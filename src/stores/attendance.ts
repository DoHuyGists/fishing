import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseDailyRewardRepository, type DailyRewardPreview } from "../data/supabaseDailyRewardRepository";

export const useAttendanceStore = defineStore("attendance", {
  state: () => ({
    possibleRewards: [] as DailyRewardPreview[],
    loadingRewards: false,
    rewardsError: "",
  }),
  actions: {
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
