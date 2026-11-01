import { defineStore } from "pinia";
import { supabaseBlueprintRepository, type Blueprint } from "../data/supabaseBlueprintRepository";
import { supabaseItemRepository, type Item } from "../data/supabaseItemRepository";

export const useBlueprintStore = defineStore("blueprint", {
  state: () => ({
    blueprints: [] as Blueprint[],
    itemsById: {} as Record<string, Item>,
    loading: false,
  }),
  actions: {
    async loadBlueprints() {
      this.loading = true;
      try {
        const blueprints = await supabaseBlueprintRepository.fetchAll();
        const ids = [...new Set(blueprints.flatMap((blueprint) => [blueprint.resultItemId, ...blueprint.requiredMaterials.map((material) => material.item_id)]))];
        const items = await supabaseItemRepository.fetchByIds(ids);
        this.blueprints = blueprints;
        this.itemsById = Object.fromEntries(items.map((item) => [item.id, item]));
      } finally {
        this.loading = false;
      }
    },
  },
});
