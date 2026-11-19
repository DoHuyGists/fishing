import { defineStore } from "pinia";
import type { EventScheduleRow } from "../types/table/eventSchedule";
import { supabaseEventScheduleRepository } from "../data/supabaseEventScheduleRepository";
import { useAuthStore } from "./auth";
import { t as tr } from "../i18n";

export const useEventStore = defineStore("playerEvents", {
  state: () => ({
    schedules: [] as EventScheduleRow[],
    selectedId: null as string | null,
    isLoading: false,
    loadError: "",
    requestId: 0,
  }),
  getters: {
    activeSchedules: state => state.schedules.filter(item => !item.isDisabled),
    selectedSchedule(): EventScheduleRow | null {
      return this.activeSchedules.find(item => item.id === this.selectedId) ?? null;
    },
  },
  actions: {
    async loadSchedules() {
      const auth = useAuthStore();
      const generation = auth.sessionGeneration;
      const request = ++this.requestId;
      const current = () => auth.sessionGeneration === generation && request === this.requestId;
      this.isLoading = true;
      this.loadError = "";
      try {
        const schedules = await supabaseEventScheduleRepository.fetchAll();
        if (!current()) return;
        this.schedules = schedules;
        if (!this.selectedSchedule) {
          this.selectedId = null;
          const first = this.activeSchedules[0];
          if (first) await this.selectSchedule(first);
        }
      } catch (error) {
        if (current()) this.loadError = error instanceof Error ? error.message : tr("EventModal.khong_the_tai_danh_sach_su_kien");
      } finally {
        if (current()) this.isLoading = false;
      }
    },
    async selectSchedule(item: EventScheduleRow) {
      if (!this.activeSchedules.some(row => row.id === item.id)) return;
      const auth = useAuthStore();
      const generation = auth.sessionGeneration;
      this.selectedId = item.id;
      try {
        await supabaseEventScheduleRepository.incrementViewCount(item.id, item.viewCount);
        // Only update the row belonging to this snapshot, never one loaded later.
        if (auth.sessionGeneration === generation && this.schedules.includes(item)) item.viewCount += 1;
      } catch {
        // Viewing content remains available when the counter cannot be updated.
      }
    },
  },
});
