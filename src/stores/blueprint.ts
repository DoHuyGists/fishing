import { defineStore } from "pinia";
import { supabaseBlueprintRepository, type Blueprint } from "../data/supabaseBlueprintRepository";
import { supabaseItemRepository, type Item } from "../data/supabaseItemRepository";
import { useCurrencyStore } from "./currency";
import { useInventoryStore } from "./inventory";

export const useBlueprintStore = defineStore("blueprint", {
  state: () => ({
    blueprints: [] as Blueprint[],
    itemsById: {} as Record<string, Item>,
    loading: false,
    crafting: false,
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
    async craft(blueprintId: string, quantity: number) {
      if (this.crafting) throw new Error("Đang chế tạo vật phẩm.");
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) throw new Error("Số lần chế tạo phải là số nguyên từ 1 đến 1000.");
      const blueprint = this.blueprints.find(item => item.id === blueprintId);
      if (!blueprint) throw new Error("Không tìm thấy bản vẽ.");
      this.crafting = true;
      try {
        const currency = useCurrencyStore();
        await currency.fetchCurrency();
        if (currency.error) throw new Error(currency.error);
        if (!Number.isSafeInteger(blueprint.goldCost) || blueprint.goldCost < 0 || !Number.isFinite(currency.cash) || currency.cash < blueprint.goldCost * quantity) throw new Error("Không đủ tiền chế tạo.");
        const inventory = useInventoryStore();
        const owned = new Map<string, number>();
        for (const row of inventory.items) {
          const id = row.data?.id;
          const count = Number(row.data?.quantity ?? 1);
          if (typeof id === 'string' && Number.isFinite(count)) owned.set(id, (owned.get(id) ?? 0) + count);
        }
        const required = new Map<string, number>();
        for (const material of blueprint.requiredMaterials) required.set(material.item_id, (required.get(material.item_id) ?? 0) + material.quantity * quantity);
        for (const [id, count] of required) if ((owned.get(id) ?? 0) < count) throw new Error("Không đủ nguyên liệu chế tạo.");
        const result = await supabaseBlueprintRepository.craft(blueprintId, quantity);
        await currency.fetchCurrency();
        return result;
      } finally { this.crafting = false; }
    },
  },
});
