import { defineStore } from "pinia";
import { supabaseBlueprintRepository } from "../../../data/supabaseBlueprintRepository";
import { supabaseItemRepository, type AdminItemRow } from "../../../data/supabaseItemRepository";

interface BlueprintRow { id: string; result_item_id: string; result_quantity: number; required_materials: { item_id: string; quantity: number }[]; gold_cost: number }
export const useAdminBlueprintStore = defineStore("admin-blueprints", {
  state: () => ({ items: [] as BlueprintRow[], sourceItems: [] as AdminItemRow[], loading: false, error: "" }),
  actions: {
    async fetchAll() {
      this.loading = true; this.error = "";
      try {
        const [recipes, items] = await Promise.all([supabaseBlueprintRepository.fetchAll(), supabaseItemRepository.fetchAll()]);
        this.items = recipes.map(row => ({ id: row.id, result_item_id: row.resultItemId, result_quantity: row.resultQuantity, required_materials: row.requiredMaterials, gold_cost: row.goldCost }));
        this.sourceItems = items;
      } catch (err) { this.error = err instanceof Error ? err.message : "Không thể tải bản vẽ."; }
      finally { this.loading = false; }
    },
    async save(payload: Record<string, unknown>, id: string | null) {
      const resultQuantity = Number(payload.result_quantity);
      const cost = Number(payload.gold_cost);
      if (!Number.isSafeInteger(resultQuantity) || resultQuantity < 1 || resultQuantity > 1000) throw new Error("Số lượng thành phẩm phải từ 1 đến 1000.");
      if (!Number.isSafeInteger(cost) || cost < 0) throw new Error("Phí phải là số nguyên không âm.");
      if (!this.sourceItems.some(item => item.id === payload.result_item_id)) throw new Error("Chọn vật phẩm thành phẩm hợp lệ.");
      if (!Array.isArray(payload.required_materials)) throw new Error("Nguyên liệu phải là danh sách JSON.");
      const ids = new Set<string>();
      const materials = payload.required_materials.map((entry: unknown) => {
        if (!entry || typeof entry !== "object") throw new Error("Nguyên liệu không hợp lệ.");
        const material = entry as Record<string, unknown>;
        const itemId = String(material.item_id ?? "");
        const quantity = Number(material.quantity);
        if (!this.sourceItems.some(item => item.id === itemId) || ids.has(itemId)) throw new Error("Vật phẩm nguyên liệu không tồn tại hoặc bị trùng.");
        if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error("Số lượng nguyên liệu phải là số nguyên dương.");
        ids.add(itemId); return { item_id: itemId, quantity };
      });
      if (!materials.length && cost === 0) throw new Error("Công thức phải có nguyên liệu hoặc phí chế tạo.");
      await supabaseBlueprintRepository.save({ result_item_id: payload.result_item_id, result_quantity: resultQuantity, required_materials: materials, gold_cost: cost }, id);
      await this.fetchAll();
    },
    async remove(id: string) { await supabaseBlueprintRepository.remove(id); await this.fetchAll(); },
  },
});
