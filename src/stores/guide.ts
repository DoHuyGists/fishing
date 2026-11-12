import type { GuideRow } from "../types/table/guide";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseGuideRepository } from "../data/supabaseGuideRepository";

export const useGuideStore = defineStore("guide", {
  state: () => ({
    guides: [] as GuideRow[],
    selectedId: null as string | null,
    loading: false,
    loadError: "",
  }),
  getters: {
    selectedGuide: (state): GuideRow | null =>
      state.guides.find((guide) => guide.id === state.selectedId) ?? null,
  },
  actions: {
    async loadGuides() {
      if (this.loading) return;
      this.loading = true;
      this.loadError = "";
      try {
        this.guides = await supabaseGuideRepository.fetchAll();
        if (!this.guides.some((guide) => guide.id === this.selectedId)) {
          this.selectedId = this.guides[0]?.id ?? null;
        }
      } catch {
        this.loadError = tr('guide.khong_the_tai_huong_dan_vui_long_thu_lai');
      } finally {
        this.loading = false;
      }
    },
    selectGuide(id: string) {
      if (this.guides.some((guide) => guide.id === id)) this.selectedId = id;
    },
  },
});
