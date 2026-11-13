import { useGameCatalogStore } from './gameCatalog';
import { useAuthStore } from './auth';
import type { Blueprint } from "../types/model/blueprint";
import type { Item } from "../types/model/item";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { supabaseBlueprintRepository } from "../data/supabaseBlueprintRepository";
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
    async loadBlueprintItems(blueprints: Blueprint[], force = false) {
      const ids = [...new Set(blueprints.flatMap(blueprint => [blueprint.resultItemId, ...blueprint.requiredMaterials.map(material => material.item_id)]))];
      await useGameCatalogStore().get('items', { ids, force, consumer: 'blueprint', onUpdate: data => {
        this.itemsById = Object.fromEntries((data ?? []).map(item => [item.id, item]));
      } });
    },
    async loadBlueprints(force = false) {
      const auth = useAuthStore(), generation = auth.sessionGeneration;
      this.loading = true;
      try {
        const catalog = useGameCatalogStore();
        const blueprints = await catalog.get('blueprints', { force, consumer: 'blueprint', onUpdate: data => {
          this.blueprints = data ?? [];
          if (!data) { this.itemsById = {}; this.loading = false; }
          else void this.loadBlueprintItems(data, force).catch(() => {});
        } });
        if (auth.sessionGeneration !== generation) return;
        await this.loadBlueprintItems(blueprints, force);
      } finally {
        if (auth.sessionGeneration === generation) this.loading = false;
      }
    },
    async craft(blueprintId: string, quantity: number) {
      if (this.crafting) throw new Error(tr('blueprint.dang_che_tao_vat_pham'));
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) throw new Error(tr('blueprint.so_lan_che_tao_phai_la_so_nguyen_tu_1_den_1000'));
      const blueprint = this.blueprints.find(item => item.id === blueprintId);
      if (!blueprint) throw new Error(tr('blueprint.khong_tim_thay_ban_ve'));
      this.crafting = true;
      try {
        const currency = useCurrencyStore();
        await currency.fetchCurrency(true);
        if (currency.error) throw new Error(currency.error);
        if (!Number.isSafeInteger(blueprint.goldCost) || blueprint.goldCost < 0 || !Number.isFinite(currency.cash) || currency.cash < blueprint.goldCost * quantity) throw new Error(tr('WorkBenchModal.khong_du_tien_che_tao'));
        const inventory = useInventoryStore();
        const owned = new Map<string, number>();
        for (const row of inventory.items) {
          const id = row.data?.id;
          const count = Number(row.data?.quantity ?? 1);
          if (typeof id === 'string' && Number.isFinite(count)) owned.set(id, (owned.get(id) ?? 0) + count);
        }
        const required = new Map<string, number>();
        for (const material of blueprint.requiredMaterials) required.set(material.item_id, (required.get(material.item_id) ?? 0) + material.quantity * quantity);
        for (const [id, count] of required) if ((owned.get(id) ?? 0) < count) throw new Error(tr('blueprint.khong_du_nguyen_lieu_che_tao'));
        const result = await useGameCatalogStore().action('craft_blueprint', { p_blueprint_id: blueprintId, p_quantity: quantity }, ['blueprints'],
          () => supabaseBlueprintRepository.craft(blueprintId, quantity));
        await currency.fetchCurrency();
        return result;
      } finally { this.crafting = false; }
    },
  },
});
