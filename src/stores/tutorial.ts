import { defineStore } from "pinia";
import { supabaseTutorialRepository, type TutorialRow } from "../data/supabaseTutorialRepository";

export const useTutorialStore = defineStore("tutorial", {
  state: () => ({
    tutorials: [] as TutorialRow[],
    viewMode: "grid" as "list" | "grid",
    loading: false,
    error: "",
  }),
  actions: {
    setViewMode(mode: "list" | "grid") {
      this.viewMode = mode;
    },
    async load() {
      if (this.loading) return;
      this.loading = true;
      this.error = "";
      try {
        this.tutorials = await supabaseTutorialRepository.fetchPublished();
      } catch {
        this.error = "Không thể tải các màn hướng dẫn. Vui lòng thử lại.";
      } finally {
        this.loading = false;
      }
    },
  },
});
