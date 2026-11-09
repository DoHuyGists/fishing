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
        this.rewardsError = "Không thể tải danh sách phần quà. Vui lòng thử lại.";
      } finally {
        this.loadingRewards = false;
      }
    },
  },
});
