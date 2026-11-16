import { leaderboardValue, type FishingSeasonBoard, type LeaderboardCriterion, type LeaderboardEntry, type LeaderboardRankedEntry } from "../types/model/leaderboard";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseLeaderboardRepository } from "../data/supabaseLeaderboardRepository";

const categories = () => [
  { key: "score", label: tr('leaderboard.tong_diem'), description: tr('leaderboard.nhung_can_thu_dan_dau_ve_diem_xep_hang'), metric: tr('leaderboard.tong_diem'), unit: tr('DailyMission.diem'), emoji: "🏆" },
  { key: "total_caught", label: tr('leaderboard.so_ca_da_cau'), description: tr('leaderboard.xep_hang_theo_tong_so_ca_cau_duoc'), metric: tr('leaderboard.so_ca_da_cau'), unit: tr('UserProfile.con'), emoji: "🎣" },
  { key: "best_fish", label: tr('leaderboard.best_fish'), description: tr('leaderboard.best_fish_description'), metric: tr('leaderboard.fish_score'), unit: tr('DailyMission.diem'), emoji: "🐟" },
] satisfies { key: LeaderboardCriterion; label: string; description: string; metric: string; unit: string; emoji: string }[];

export const useLeaderboardStore = defineStore("leaderboard", {
  state: () => ({
    activeTab: "score" as string,
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
    selectedSeasonId: null as string | null,
    seasonBoard: null as FishingSeasonBoard | null,
  }),
  getters: {
    categories: () => categories(),
    tabs: () => [...categories(), { key: 'hall_of_fame', label: tr('LeaderboardSeason.hall_tab'), emoji: '🏅' }],
    criterion(state): LeaderboardCriterion {
      return state.activeTab === "total_caught" || state.activeTab === "best_fish" ? state.activeTab : "score";
    },
    boards(state) {
      const available = categories();
      const category = available.find(category => category.key === state.activeTab) ?? available[0]!;
      const criterion = category.key;
      const offset = (state.page - 1) * state.pageSize;
      let rank = state.firstRank;
      const entries = state.entries.map((entry, index): LeaderboardRankedEntry => {
        const value = leaderboardValue(entry, criterion);
        if (index > 0 && value !== leaderboardValue(state.entries[index - 1]!, criterion)) rank = offset + index + 1;
        return { id: entry.id, userId: entry.id, displayName: entry.display_name || tr('LeaderboardModal.an_danh'),
          avatarUrl: entry.avatar_url, value, rank: criterion === 'best_fish' ? entry.rank ?? offset + index + 1 : rank, bestFish: criterion === "best_fish" ? entry.best_fish : null };
      });
      return [{ ...category, entries, leaders: offset === 0 ? entries.slice(0, 3) : [],
        remaining: offset === 0 ? entries.slice(3) : entries, loading: state.loading, error: state.error,
        myEntry: state.myEntry, myRank: state.myRank,
        myValue: state.myEntry ? leaderboardValue(state.myEntry, criterion) : 0 }];
    },
  },
  actions: {
    async selectSeason(seasonId: string | null, userId?: string | null) {
      this.selectedSeasonId = seasonId;
      this.seasonBoard = null;
      await this.fetchLeaderboard(userId, 1);
    },
    async fetchLeaderboard(userId?: string | null, page?: number) {
      page ??= this.page;
      const requestId = ++this.requestId;
      const criterion = this.criterion;
      this.loading = true;
      this.error = "";
      this.entries = [];
      this.total = 0;
      this.myEntry = null;
      this.myRank = null;
      try {
        if (criterion === 'best_fish' || this.activeTab === 'hall_of_fame') {
          const board = await supabaseLeaderboardRepository.fetchSeasonBoard(page, this.selectedSeasonId);
          if (requestId !== this.requestId) return;
          if (!board.items.length && page > 1) {
            await this.fetchLeaderboard(userId, Math.max(1, Math.ceil(board.total / this.pageSize)));
            return;
          }
          this.seasonBoard = board;
          this.entries = board.items;
          this.total = board.total;
          this.page = page;
          this.myEntry = userId ? board.my_entry : null;
          this.myRank = this.myEntry?.rank ?? null;
          return;
        }
        const [result, myEntry] = await Promise.all([
          supabaseLeaderboardRepository.fetchTop(page, criterion),
          userId ? supabaseLeaderboardRepository.fetchByUser(userId) : null,
        ]);
        if (requestId !== this.requestId) return;
        if (!result.items.length && page > 1) {
          await this.fetchLeaderboard(userId, Math.max(1, Math.ceil(result.total / this.pageSize)));
          return;
        }
        const hasPersonalRank = myEntry;
        const [firstRank, myRank] = await Promise.all([
          page > 1 && result.items[0] ? supabaseLeaderboardRepository.countHigher(leaderboardValue(result.items[0], criterion), criterion).then(count => count + 1) : 1,
          hasPersonalRank ? supabaseLeaderboardRepository.countHigher(leaderboardValue(myEntry, criterion), criterion).then(count => count + 1) : null,
        ]);
        if (requestId !== this.requestId) return;
        this.entries = result.items;
        this.total = result.total;
        this.page = page;
        this.firstRank = firstRank;
        this.myEntry = myEntry;
        this.myRank = myRank;
      } catch (error) {
        if (requestId === this.requestId) this.error = error instanceof Error ? error.message : tr('leaderboard.khong_the_tai_bang_xep_hang');
      } finally {
        if (requestId === this.requestId) this.loading = false;
      }
    },
  },
});
