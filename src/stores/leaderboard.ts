import { defineStore } from "pinia";
import { supabaseLeaderboardRepository, type LeaderboardEntry } from "../data/supabaseLeaderboardRepository";
import { mockLeaderboards, type MockLeaderboardCriterion } from "../data/mockLeaderboard";

type LeaderboardCriterion = "score" | MockLeaderboardCriterion;

interface LeaderboardCategory {
  key: LeaderboardCriterion;
  label: string;
  description: string;
  metric: string;
  unit: string;
  emoji: string;
  isMock: boolean;
}

interface RankedLeaderboardEntry {
  id: string;
  userId: string | null;
  displayName: string;
  avatarUrl?: string | null;
  value: number;
  rank: number;
}

const categories: LeaderboardCategory[] = [
  { key: "score", label: "Tổng điểm", description: "Những cần thủ dẫn đầu về điểm xếp hạng.", metric: "Tổng điểm", unit: "điểm", emoji: "🏆", isMock: false },
  { key: "catches", label: "Số cá đã câu", description: "Xếp hạng theo tổng số cá câu được.", metric: "Số cá đã câu", unit: "con", emoji: "🎣", isMock: true },
  { key: "largest", label: "Cá lớn nhất", description: "Xếp hạng theo cân nặng của con cá lớn nhất từng câu được.", metric: "Kỷ lục cân nặng", unit: "kg", emoji: "🐟", isMock: true },
  { key: "collection", label: "Bộ sưu tập", description: "Xếp hạng theo số loài cá khác nhau đã khám phá.", metric: "Loài đã khám phá", unit: "loài", emoji: "📖", isMock: true },
];

export const useLeaderboardStore = defineStore("leaderboard", {
  state: () => ({
    activeTab: "score",
    entries: [] as LeaderboardEntry[],
    myEntry: null as LeaderboardEntry | null,
    myRank: null as number | null,
    loading: false,
    error: "",
    requestId: 0,
  }),
  getters: {
    categories: () => categories,
    boards(state) {
      return categories.map((category) => {
        const entries: RankedLeaderboardEntry[] = category.key === "score"
          ? state.entries.map((entry) => ({
              id: entry.id,
              userId: entry.user_id,
              displayName: entry.display_name || "Ẩn danh",
              avatarUrl: entry.avatar_url,
              value: entry.score,
              rank: 0,
            }))
          : mockLeaderboards[category.key].map((entry) => ({ ...entry, userId: null, rank: 0 }));

        // Equal values share a rank, matching countHigherScore for the personal rank.
        entries.sort((a, b) => b.value - a.value);
        let rank = 1;
        entries.forEach((entry, index) => {
          if (index === 0 || entry.value !== entries[index - 1]!.value) rank = index + 1;
          entry.rank = rank;
        });

        return {
          ...category,
          entries,
          leaders: entries.slice(0, 3),
          remaining: entries.slice(3),
          loading: !category.isMock && state.loading,
          error: category.isMock ? "" : state.error,
          myEntry: category.isMock ? null : state.myEntry,
          myRank: category.isMock ? null : state.myRank,
        };
      });
    },
  },
  actions: {
    async fetchLeaderboard(userId?: string | null, limit = 50) {
      const requestId = ++this.requestId;
      this.loading = true;
      this.error = "";
      this.myEntry = null;
      this.myRank = null;
      try {
        const entries = await supabaseLeaderboardRepository.fetchTop(limit);
        if (requestId !== this.requestId) return;
        this.entries = entries;
        const myEntry = userId ? await supabaseLeaderboardRepository.fetchByUser(userId) : null;
        const myRank = myEntry
          ? (await supabaseLeaderboardRepository.countHigherScore(myEntry.score)) + 1
          : null;
        if (requestId !== this.requestId) return;
        this.myEntry = myEntry;
        this.myRank = myRank;
      } catch (error) {
        if (requestId !== this.requestId) return;
        this.error = error instanceof Error ? error.message : "Không thể tải bảng xếp hạng";
      } finally {
        if (requestId === this.requestId) this.loading = false;
      }
    },
  },
});
