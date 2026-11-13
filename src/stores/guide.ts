import { useGameCatalogStore } from './gameCatalog';
import { useAuthStore } from './auth';
import type { GuideRow } from "../types/table/guide";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";

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
    async loadGuides(force = false) {
      const auth = useAuthStore(), generation = auth.sessionGeneration;
      this.loading = true;
      this.loadError = "";
      try {
        await useGameCatalogStore().get('guides', { force, consumer: 'guide', onUpdate: data => { this.guides = data ?? []; if (!data) { this.loading = false; this.loadError = ''; this.selectedId = null; } } });
        if (auth.sessionGeneration !== generation) return;
        if (!this.guides.some((guide) => guide.id === this.selectedId)) {
          this.selectedId = this.guides[0]?.id ?? null;
        }
      } catch {
        if (auth.sessionGeneration === generation) this.loadError = tr('guide.khong_the_tai_huong_dan_vui_long_thu_lai');
      } finally {
        if (auth.sessionGeneration === generation) this.loading = false;
      }
    },
    selectGuide(id: string) {
      if (this.guides.some((guide) => guide.id === id)) this.selectedId = id;
    },
  },
});
