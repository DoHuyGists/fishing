import { defineStore } from "pinia";
import { supabaseLeaderboardRepository, type LeaderboardEntry } from "../data/supabaseLeaderboardRepository";

export const useLeaderboardStore = defineStore("leaderboard", {
  state: () => ({
    entries: [] as LeaderboardEntry[],
    myEntry: null as LeaderboardEntry | null,
    myRank: null as number | null,
    loading: false,
    error: "",
  }),
  actions: {
    async fetchLeaderboard(userId?: string | null, limit = 50) {
      this.loading = true;
      this.error = "";
      try {
        this.entries = await supabaseLeaderboardRepository.fetchTop(limit);
        if (userId) {
          this.myEntry = await supabaseLeaderboardRepository.fetchByUser(userId);
          this.myRank = this.myEntry
            ? (await supabaseLeaderboardRepository.countHigherScore(this.myEntry.score)) + 1
            : null;
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Không thể tải bảng xếp hạng";
      } finally {
        this.loading = false;
      }
    },
  },
});
