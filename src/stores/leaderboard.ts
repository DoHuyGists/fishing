import { t as tr } from "../i18n";
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
  { key: "score", get label() { return tr('leaderboard.tong_diem'); }, get description() { return tr('leaderboard.nhung_can_thu_dan_dau_ve_diem_xep_hang'); }, get metric() { return tr('leaderboard.tong_diem'); }, get unit() { return tr('DailyMission.diem'); }, emoji: "🏆", isMock: false },
  { key: "catches", get label() { return tr('leaderboard.so_ca_da_cau'); }, get description() { return tr('leaderboard.xep_hang_theo_tong_so_ca_cau_duoc'); }, get metric() { return tr('leaderboard.so_ca_da_cau'); }, get unit() { return tr('UserProfile.con'); }, emoji: "🎣", isMock: true },
  { key: "largest", get label() { return tr('leaderboard.ca_lon_nhat'); }, get description() { return tr('leaderboard.xep_hang_theo_can_nang_cua_con_ca_lon_nhat_tung_cau_duoc'); }, get metric() { return tr('leaderboard.ky_luc_can_nang'); }, unit: "kg", emoji: "🐟", isMock: true },
  { key: "collection", get label() { return tr('leaderboard.bo_suu_tap'); }, get description() { return tr('leaderboard.xep_hang_theo_so_loai_ca_khac_nhau_da_kham_pha'); }, get metric() { return tr('leaderboard.loai_da_kham_pha'); }, get unit() { return tr('FlipBook.loai'); }, emoji: "📖", isMock: true },
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
              displayName: entry.display_name || tr('LeaderboardModal.an_danh'),
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
        this.error = error instanceof Error ? error.message : tr('leaderboard.khong_the_tai_bang_xep_hang');
      } finally {
        if (requestId === this.requestId) this.loading = false;
      }
    },
  },
});
