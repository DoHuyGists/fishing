import type { TutorialRow } from "../types/table/tutorial";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseTutorialRepository } from "../data/supabaseTutorialRepository";

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
        this.error = tr('tutorial.khong_the_tai_cac_man_huong_dan_vui_long_thu_lai');
      } finally {
        this.loading = false;
      }
    },
  },
});
