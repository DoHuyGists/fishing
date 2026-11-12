import { defineStore } from "pinia";
import { t as tr } from "../i18n";
import type { WorkBenchInventoryItem } from "../components/player/work-bench/types";

export type WorkBenchInventoryViewMode = "list" | "grid" | "group";

const categoryLabelKeys: Record<string, string> = {
  rod: "useInventoryTable.can_cau",
  line: "useInventoryTable.day_cau",
  reel: "useInventoryTable.may_cau",
  hook: "useInventoryTable.luoi_cau",
  bait: "useInventoryTable.moi",
};

export const useWorkBenchInventoryStore = defineStore("workBenchInventory", {
  state: () => ({
    viewMode: "grid" as WorkBenchInventoryViewMode,
  }),
  getters: {
    displayedGroups: (state) => (items: WorkBenchInventoryItem[]) => {
      if (state.viewMode !== "group") return [{ category: "", label: "", items }];

      const groups = new Map<string, WorkBenchInventoryItem[]>();
      for (const item of items) {
        const category = item.category?.trim() || "";
        const group = groups.get(category) ?? [];
        group.push(item);
        groups.set(category, group);
      }

      return [...groups].map(([category, items]) => ({
        category,
        label: categoryLabelKeys[category] ? tr(categoryLabelKeys[category]) : category || tr("InventoryItems.khac"),
        items,
      }));
    },
  },
});
