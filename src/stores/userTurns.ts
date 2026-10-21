import { defineStore } from "pinia";
import { supabaseUserInAreaRepository, type UserTurnStatus } from "../data/supabaseUserInAreaRepository";

const RECHARGE_INTERVAL_MS = 300_000;

export const useUserTurnsStore = defineStore("userTurns", {
  state: () => ({
    status: null as UserTurnStatus | null,
    timeLeftMs: 0,
    loading: false,
    error: "",
    intervalId: null as ReturnType<typeof setInterval> | null,
    refreshing: false,
  }),
  getters: {
    countdown: (state): string => {
      const totalSeconds = Math.ceil(state.timeLeftMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    },
  },
  actions: {
    async fetchStatus() {
      if (this.refreshing) return;
      this.refreshing = true;
      this.loading = true;
      this.error = "";
      try {
        this.status = await supabaseUserInAreaRepository.fetchTurnStatus();
        this.updateTimeLeft();
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Không thể lấy số lượt câu cá";
      } finally {
        this.loading = false;
        this.refreshing = false;
      }
    },
    async consumeTurn() {
      const status = await supabaseUserInAreaRepository.consumeTurn();
      if (status) {
        this.status = status;
        this.updateTimeLeft();
      } else {
        await supabaseUserInAreaRepository.fetchTurnStatus().then((latest) => {
          this.status = latest;
          this.updateTimeLeft();
        });
      }
    },
    updateTimeLeft() {
      if (!this.status?.last_recharge_at || this.status.turns >= this.status.max_turns) {
        this.timeLeftMs = 0;
        return;
      }
      const targetTime = new Date(this.status.last_recharge_at).getTime() + RECHARGE_INTERVAL_MS;
      this.timeLeftMs = Math.max(0, targetTime - Date.now());
      if (this.timeLeftMs <= 0) void this.fetchStatus();
    },
    startCountdown() {
      this.stopCountdown();
      this.updateTimeLeft();
      this.intervalId = setInterval(() => this.updateTimeLeft(), 1000);
    },
    stopCountdown() {
      if (this.intervalId) clearInterval(this.intervalId);
      this.intervalId = null;
    },
  },
});
