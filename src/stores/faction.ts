import { defineStore } from "pinia";
import {
  supabaseFactionRepository,
  type CurrentFactionEffect,
  type Faction,
} from "../data/supabaseFactionRepository";

export const useFactionStore = defineStore("faction", {
  state: () => ({
    factions: [] as Faction[],
    currentEffects: [] as CurrentFactionEffect[],
    currentFactionId: null as string | null,
    selectedFactionId: null as string | null,
    dailyActivityPoints: 0,
    memberCounts: {} as Record<string, number>,
    loading: false,
    actionLoading: false,
    error: "",
  }),
  getters: {
    /**
     * Số lượng thành viên của từng phe dựa trên factionId.
     */
    getMemberCount: (state) => (factionId: string): number => {
      return state.memberCounts[factionId] ?? 0;
    },

    /**
     * Phe mà người dùng đã chính thức gia nhập.
     */
    joinedFaction: (state): Faction | null => {
      if (!state.currentFactionId) return null;
      return state.factions.find((item) => item.id === state.currentFactionId) ?? null;
    },

    /**
     * Kiểm tra người chơi đã tham gia phe nào chưa.
     */
    hasJoinedFaction: (state): boolean => Boolean(state.currentFactionId),

    /**
     * Phe đang được hiển thị ở section trên đầu.
     * Ưu tiên phe người chơi chọn xem; nếu chưa chọn xem phe khác thì hiển thị phe đã gia nhập;
     * Nếu chưa gia nhập phe nào thì hiển thị phe đầu tiên trong danh sách.
     */
    activeFaction: (state): Faction | null => {
      if (state.selectedFactionId) {
        const selected = state.factions.find((item) => item.id === state.selectedFactionId);
        if (selected) return selected;
      }
      if (state.currentFactionId) {
        const joined = state.factions.find((item) => item.id === state.currentFactionId);
        if (joined) return joined;
      }
      return state.factions.find((x) => x.is_neutral) ?? state.factions[0] ?? null;
    },

    /**
     * Danh sách các phe còn lại xếp ở section bên dưới (loại trừ phe đang hiển thị ở trên).
     */
    otherFactions: (state): Faction[] => {
      const activeId =
        state.selectedFactionId ??
        state.currentFactionId ??
        state.factions.find((x) => x.is_neutral)?.id ??
        state.factions[0]?.id;
      if (!activeId) return state.factions;
      return state.factions.filter((item) => item.id !== activeId);
    },

    /**
     * Kiểm tra xem phe đang hiển thị ở top section có phải là phe người dùng đã gia nhập hay không.
     */
    isActiveFactionJoined: (state): boolean => {
      if (!state.currentFactionId) return false;
      const activeId = state.selectedFactionId ?? state.currentFactionId;
      return state.currentFactionId === activeId;
    },
  },
  actions: {
    selectFaction(factionId: string) {
      this.selectedFactionId = factionId;
    },

    resetToJoinedFaction() {
      this.selectedFactionId = this.currentFactionId;
    },

    async loadData(userId?: string) {
      this.loading = true;
      this.error = "";
      try {
        const [factionsList, effectsList, userFactionId, dailyPoints, memberCounts] = await Promise.all([
          supabaseFactionRepository.fetchFactions(),
          supabaseFactionRepository.getCurrentFactionEffects(),
          userId ? supabaseFactionRepository.fetchUserFactionId(userId) : Promise.resolve(null),
          supabaseFactionRepository.getMyFactionDailyActivity(),
          supabaseFactionRepository.fetchFactionMemberCounts().catch(() => ({})),
        ]);

        this.factions = factionsList;
        this.currentEffects = effectsList;
        this.dailyActivityPoints = dailyPoints;
        this.memberCounts = memberCounts;

        const detectedId = userFactionId ?? effectsList[0]?.faction_id ?? null;
        this.currentFactionId = detectedId;

        if (!this.selectedFactionId || !this.factions.some((f) => f.id === this.selectedFactionId)) {
          this.selectedFactionId =
            detectedId ??
            (factionsList.find((x) => x.is_neutral)?.id ?? factionsList[0]?.id ?? null);
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Không thể tải thông tin phe phái";
      } finally {
        this.loading = false;
      }
    },

    async joinFaction(factionId: string, userId?: string) {
      if (!factionId) return;
      this.actionLoading = true;
      this.error = "";
      try {
        await supabaseFactionRepository.joinFaction(factionId);
        this.currentFactionId = factionId;
        this.selectedFactionId = factionId;
        await Promise.all([this.refreshEffects(), this.refreshMemberCounts()]);
        if (userId) {
          const verifiedId = await supabaseFactionRepository.fetchUserFactionId(userId);
          if (verifiedId) this.currentFactionId = verifiedId;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Tham gia phe thất bại";
        this.error = message;
        throw new Error(message);
      } finally {
        this.actionLoading = false;
      }
    },

    async changeFaction(factionId: string, userId?: string) {
      if (!factionId) return;
      this.actionLoading = true;
      this.error = "";
      try {
        await supabaseFactionRepository.changeFaction(factionId);
        this.currentFactionId = factionId;
        this.selectedFactionId = factionId;
        await Promise.all([this.refreshEffects(), this.refreshMemberCounts()]);
        if (userId) {
          const verifiedId = await supabaseFactionRepository.fetchUserFactionId(userId);
          if (verifiedId) this.currentFactionId = verifiedId;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Chuyển phe thất bại";
        this.error = message;
        throw new Error(message);
      } finally {
        this.actionLoading = false;
      }
    },

    async refreshEffects() {
      try {
        this.currentEffects = await supabaseFactionRepository.getCurrentFactionEffects();
      } catch {
        // Không ngắt luồng nếu không tải được hiệu ứng
      }
    },

    async refreshDailyActivity() {
      try {
        this.dailyActivityPoints = await supabaseFactionRepository.getMyFactionDailyActivity();
      } catch {
        // Không ngắt luồng nếu không tải được điểm năng động
      }
    },

    async refreshMemberCounts() {
      try {
        this.memberCounts = await supabaseFactionRepository.fetchFactionMemberCounts();
      } catch {
        // Không ngắt luồng nếu không tải được số lượng thành viên
      }
    },
  },
});
