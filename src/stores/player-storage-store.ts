import { defineStore } from "pinia";
import { getFormattingLocale, t as tr } from "../i18n";
import { useAuthStore } from "./auth";
import { useInventoryStore } from "./player-inventory-store";
import { useHealthStore } from "./player-health-store";
import { healthSlots } from "../data/healthEquipment";
import type { StorageSort, StorageStatus, StorageView } from "../types/model/storage";
import type { UserInventory } from "../types/model/userInventory";

const fishingSlots = ["rod", "line", "reel", "hook", "bait"] as const;
const categoryKeys: Record<string, string> = {
  rod: "useInventoryTable.can_cau", line: "useInventoryTable.day_cau", reel: "useInventoryTable.may_cau",
  hook: "useInventoryTable.luoi_cau", bait: "useInventoryTable.moi",
};
const itemName = (item: UserInventory): string => String(item.data.name || `#${item.id.slice(0, 6)}`);
const quantity = (item: UserInventory): number => {
  const value = Number(item.data.quantity ?? 1);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};
const categoryLabel = (category: string): string => categoryKeys[category] ? tr(categoryKeys[category])
  : healthSlots.includes(category as typeof healthSlots[number]) ? tr(`Health.slot_${category}`) : category || tr("InventoryItems.khac");

export const useStorageStore = defineStore("PlayerStorage", {
  state: () => ({
    owner: "", generation: -1, request: 0, loading: false, busy: false, ready: false, error: "",
    search: "", classification: "", category: "", status: "all" as StorageStatus,
    sort: "newest" as StorageSort, view: "grid" as StorageView, page: 1, pageSize: 20,
    selectedIds: [] as string[], confirmingDelete: false,
  }),
  getters: {
    items(state): UserInventory[] {
      const auth = useAuthStore();
      return state.owner === auth.user?.id && state.generation === auth.sessionGeneration
        ? useInventoryStore().items.filter((item) => item.userId === state.owner) : [];
    },
    protectedIds(): Set<string> {
      const inventory = useInventoryStore(), health = useHealthStore();
      const ids = new Set<string>();
      for (const set of [...inventory.equipmentSets, ...inventory.savedEquipmentSets]) {
        for (const slot of fishingSlots) for (const item of set[slot]) if (item.inventory_id) ids.add(item.inventory_id);
      }
      for (const set of [...health.sets, ...health.savedSets]) {
        for (const slot of healthSlots) for (const item of set[slot]) ids.add(item.inventory_id);
      }
      return ids;
    },
    classifications(): string[] {
      return [...new Set(this.items.map((item) => String(item.data.classification ?? "")).filter(Boolean))].sort();
    },
    categories(): string[] {
      return [...new Set(this.items.filter((item) => !this.classification || item.data.classification === this.classification)
        .map((item) => String(item.data.category ?? "")).filter(Boolean))].sort();
    },
    filteredItems(): UserInventory[] {
      const query = this.search.trim().toLocaleLowerCase(getFormattingLocale());
      const result = this.items.filter((item) => {
        if (this.classification && item.data.classification !== this.classification) return false;
        if (this.category && item.data.category !== this.category) return false;
        if (this.status === "usable" && !item.rpc?.trim()) return false;
        if (this.status === "protected" && !this.protectedIds.has(item.id)) return false;
        if (this.status === "unassigned" && this.protectedIds.has(item.id)) return false;
        return !query || [item.data.name, item.data.category, categoryLabel(item.data.category), item.data.information,
          item.data.detail, item.id].some((value) => String(value ?? "").toLocaleLowerCase(getFormattingLocale()).includes(query));
      });
      return result.sort((a, b) => {
        let order = 0;
        if (this.sort === "name") order = itemName(a).localeCompare(itemName(b), getFormattingLocale());
        else if (this.sort === "quantity") order = quantity(b) - quantity(a);
        else order = (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
        if (this.sort === "oldest") order *= -1;
        return order || a.id.localeCompare(b.id);
      });
    },
    pagedItems(): UserInventory[] { return this.filteredItems.slice((this.page - 1) * this.pageSize, this.page * this.pageSize); },
    selectedItems(): UserInventory[] { const ids = new Set(this.selectedIds); return this.items.filter((item) => ids.has(item.id)); },
    selectedProtectedCount(): number { return this.selectedItems.filter((item) => this.protectedIds.has(item.id)).length; },
    allPageSelected(): boolean { return this.pagedItems.length > 0 && this.pagedItems.every((item) => this.selectedIds.includes(item.id)); },
    canDelete(): boolean { return this.ready && !this.loading && !this.busy && this.selectedItems.length > 0 && this.selectedProtectedCount === 0; },
    usableItem(): UserInventory | null {
      return this.selectedItems.length === 1 && this.selectedItems[0]?.rpc?.trim() ? this.selectedItems[0] : null;
    },
    totalQuantity(): number { return this.items.reduce((sum, item) => sum + quantity(item), 0); },
  },
  actions: {
    itemName,
    quantity,
    categoryLabel,
    classificationLabel(value: string): string {
      return value === "fishing" ? tr("InventoryModal.fishingTab") : value === "body" ? tr("InventoryModal.healthTab") : value;
    },
    resetFilters() { this.search = ""; this.classification = ""; this.category = ""; this.status = "all"; this.sort = "newest"; this.filtersChanged(); },
    filtersChanged() { this.page = 1; this.selectedIds = []; this.confirmingDelete = false; },
    toggleSelect(id: string) {
      if (this.busy || this.loading) return;
      this.selectedIds = this.selectedIds.includes(id) ? this.selectedIds.filter((entry) => entry !== id) : [...this.selectedIds, id];
    },
    togglePage() {
      if (this.busy || this.loading) return;
      const pageIds = new Set(this.pagedItems.map((item) => item.id));
      this.selectedIds = this.allPageSelected ? this.selectedIds.filter((id) => !pageIds.has(id)) : [...new Set([...this.selectedIds, ...pageIds])];
    },
    selectFiltered() { if (!this.busy && !this.loading) this.selectedIds = this.filteredItems.map((item) => item.id); },
    async load() {
      const auth = useAuthStore(), owner = auth.user?.id, generation = auth.sessionGeneration;
      if (!owner) { this.$reset(); return; }
      if (this.owner !== owner || this.generation !== generation) { this.$reset(); this.owner = owner; this.generation = generation; }
      const request = ++this.request;
      const current = () => request === this.request && auth.user?.id === owner && auth.sessionGeneration === generation;
      this.loading = true; this.ready = false; this.error = "";
      try {
        await Promise.all([useHealthStore().loadInventory(), useInventoryStore().setEquipmentSet()]);
        if (!current()) return;
        if (useHealthStore().error) throw new Error(useHealthStore().error);
        this.ready = true;
        const ids = new Set(this.items.map((item) => item.id));
        this.selectedIds = this.selectedIds.filter((id) => ids.has(id));
        this.page = Math.min(this.page, Math.max(1, Math.ceil(this.filteredItems.length / this.pageSize)));
      } catch (error) {
        if (current()) this.error = error instanceof Error ? error.message : String(error);
      } finally { if (current()) this.loading = false; }
    },
    async deleteSelected() {
      if (!this.canDelete) return;
      const auth = useAuthStore(), owner = this.owner, generation = this.generation;
      if (auth.user?.id !== owner || auth.sessionGeneration !== generation) return;
      const ids = [...this.selectedIds];
      this.busy = true; this.error = "";
      try {
        await useInventoryStore().removeItem(owner, ids);
        if (auth.user?.id !== owner || auth.sessionGeneration !== generation) return;
        useInventoryStore().items = useInventoryStore().items.filter((item) => !ids.includes(item.id));
        this.selectedIds = []; this.confirmingDelete = false;
        await this.load();
      } catch (error) { if (auth.user?.id === owner && auth.sessionGeneration === generation) this.error = error instanceof Error ? error.message : String(error); }
      finally { if (auth.user?.id === owner && auth.sessionGeneration === generation) this.busy = false; }
    },
    async useSelected() {
      const item = this.usableItem;
      if (!item || !this.ready || this.loading || this.busy) return;
      const auth = useAuthStore(), owner = this.owner, generation = this.generation;
      if (auth.user?.id !== owner || auth.sessionGeneration !== generation) return;
      this.busy = true; this.error = "";
      try {
        await useInventoryStore().useItem(item.id);
        if (auth.user?.id !== owner || auth.sessionGeneration !== generation) return;
        this.selectedIds = [];
        await this.load();
      } catch (error) { if (auth.user?.id === owner && auth.sessionGeneration === generation) this.error = error instanceof Error ? error.message : String(error); }
      finally { if (auth.user?.id === owner && auth.sessionGeneration === generation) this.busy = false; }
    },
  },
});
