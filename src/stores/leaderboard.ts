import type { LeaderboardEntry } from "../types/model/leaderboard";
import type { MockLeaderboardCriterion } from "../types/model/mockLeaderboard";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseLeaderboardRepository } from "../data/supabaseLeaderboardRepository";
import { mockLeaderboards } from "../data/mockLeaderboard";

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
    page: 1,
    pageSize: 10,
    total: 0,
    firstRank: 1,
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
        const offset = category.isMock ? 0 : (state.page - 1) * state.pageSize;
        let rank = category.isMock ? 1 : state.firstRank;
        entries.forEach((entry, index) => {
          if (index > 0 && entry.value !== entries[index - 1]!.value) rank = offset + index + 1;
          entry.rank = rank;
        });

        return {
          ...category,
          entries,
          leaders: offset === 0 ? entries.slice(0, 3) : [],
          remaining: offset === 0 ? entries.slice(3) : entries,
          loading: !category.isMock && state.loading,
          error: category.isMock ? "" : state.error,
          myEntry: category.isMock ? null : state.myEntry,
          myRank: category.isMock ? null : state.myRank,
        };
      });
    },
  },
  actions: {
    async fetchLeaderboard(userId?: string | null, page?: number) {
      page ??= this.page;
      const requestId = ++this.requestId;
      this.loading = true;
      this.error = "";
      this.myEntry = null;
      this.myRank = null;
      try {
        const result = await supabaseLeaderboardRepository.fetchTop(page);
        if (requestId !== this.requestId) return;
        const firstRank = page > 1 && result.items[0] ? await supabaseLeaderboardRepository.countHigherScore(result.items[0].score) + 1 : 1;
        if (requestId !== this.requestId) return;
        this.entries = result.items; this.total = result.total; this.page = page; this.firstRank = firstRank;
        if (!result.items.length && page > 1) {
          await this.fetchLeaderboard(userId, Math.max(1, Math.ceil(result.total / this.pageSize))); return;
        }
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
