import { defineStore } from 'pinia';
import { healthEquipment, healthSlots, survivalResources } from '../data/healthEquipment';
import { supabaseBodyEquipmentRepository as repository } from '../data/supabaseBodyEquipmentRepository';
import { useInventoryStore } from './inventory';
import { useAuthStore } from './auth';
import { t as tr } from '../i18n';
import type { BodyEquipmentSet, HealthEquipment, HealthSlot, SurvivalResource } from '../types/model/health';

const clone = (sets: BodyEquipmentSet[]) => JSON.parse(JSON.stringify(sets)) as BodyEquipmentSet[];
export const useHealthStore = defineStore('health', {
  state: () => ({
    owner: '', generation: -1, loading: false, error: '', request: 0, busy: false,
    selectedSetId: '', selectedSlot: null as HealthSlot | null,
    sets: [] as BodyEquipmentSet[], savedSets: [] as BodyEquipmentSet[],
  }),
  getters: {
    ownedItems(state): HealthEquipment[] {
      const auth = useAuthStore();
      if (state.owner !== auth.user?.id || state.generation !== auth.sessionGeneration) return [];
      return useInventoryStore().items.filter(item => item.userId === state.owner).map(healthEquipment).filter(item => item.quantity > 0);
    },
    selectedSet(): BodyEquipmentSet | undefined { return this.sets.find(set => set.id === this.selectedSetId); },
    equippedItems(): HealthEquipment[] {
      const set = this.selectedSet;
      return set ? this.ownedItems.filter(item => item.slot && set[item.slot].some(entry => entry.inventory_id === item.inventory.id)) : [];
    },
    bonuses(): Record<SurvivalResource, number> {
      const result = { vitality: 0, hydration: 0, nutrition: 0, energy: 0, morale: 0 };
      // Draft edits do not affect totals until saved. Only the active set contributes.
      const set = this.savedSets.find(set => set.is_used);
      if (set) for (const item of this.ownedItems) {
        if (item.slot && set[item.slot].some(entry => entry.inventory_id === item.inventory.id)) {
          for (const resource of survivalResources) result[resource] += item.bonuses[resource] ?? 0;
        }
      }
      return result;
    },
    stats(): { id: SurvivalResource; value: number }[] { return survivalResources.map(id => ({ id, value: this.bonuses[id] })); },
  },
  actions: {
    async loadInventory() {
      const auth = useAuthStore(), userId = auth.user?.id;
      if (this.owner !== (userId ?? '') || this.generation !== auth.sessionGeneration) {
        const request = this.request + 1;
        this.$reset(); this.request = request; this.owner = userId ?? ''; this.generation = auth.sessionGeneration;
      }
      if (!userId) return;
      const request = ++this.request, generation = auth.sessionGeneration;
      const current = () => request === this.request && auth.user?.id === userId && auth.sessionGeneration === generation;
      this.loading = true; this.error = '';
      try {
        const [, sets] = await Promise.all([useInventoryStore().setUserInventory(userId), repository.fetchSets()]);
        if (!current()) return;
        this.sets = clone(sets); this.savedSets = clone(sets);
        this.selectedSetId = ''; this.selectedSlot = null;
      } catch { if (current()) this.error = tr('Health.inventoryError'); }
      finally { if (current()) this.loading = false; }
    },
    isDirty(set: BodyEquipmentSet) {
      const saved = this.savedSets.find(candidate => candidate.id === set.id);
      return healthSlots.some(slot => JSON.stringify(set[slot]) !== JSON.stringify(saved?.[slot]));
    },
    containsInventory(ids: Set<string>) {
      return [...this.sets, ...this.savedSets].some(set => healthSlots.some(slot => set[slot].some(item => ids.has(item.inventory_id))));
    },
    equip(inventoryId: string) {
      if (this.loading || this.error || this.busy || !this.selectedSet || !this.selectedSlot) return;
      const item = this.ownedItems.find(item => item.inventory.id === inventoryId);
      if (!item?.slot || this.selectedSlot !== item.slot || this.equippedItems.some(entry => entry.inventory.id === inventoryId)) return;
      this.selectedSet[item.slot].push({ inventory_id: inventoryId });
    },
    unequip(set: BodyEquipmentSet, slot: HealthSlot, inventoryId: string) {
      if (!this.busy) set[slot] = set[slot].filter(item => item.inventory_id !== inventoryId);
    },
    async persist(action: () => Promise<void>) {
      if (this.busy || this.loading || this.error) return;
      const auth = useAuthStore(), owner = auth.user?.id, generation = auth.sessionGeneration;
      if (!owner || owner !== this.owner || generation !== this.generation) return;
      this.busy = true;
      try { await action(); }
      finally { if (auth.user?.id === owner && auth.sessionGeneration === generation) this.busy = false; }
    },
    async createSet() {
      const owner = this.owner, generation = this.generation;
      await this.persist(async () => {
        const set = await repository.createSet();
        if (this.owner !== owner || this.generation !== generation || useAuthStore().user?.id !== owner || useAuthStore().sessionGeneration !== generation) return;
        this.sets.push(clone([set])[0]); this.savedSets.push(clone([set])[0]);
      });
    },
    async saveSet(set: BodyEquipmentSet) {
      const snapshot = clone([set])[0], owner = this.owner, generation = this.generation;
      await this.persist(async () => {
        await repository.saveSet(snapshot);
        if (this.owner !== owner || this.generation !== generation || useAuthStore().user?.id !== owner || useAuthStore().sessionGeneration !== generation) return;
        this.savedSets = this.savedSets.map(saved => saved.id === snapshot.id ? snapshot : saved);
      });
    },
    async chooseSet(id: string) {
      const owner = this.owner, generation = this.generation;
      await this.persist(async () => {
        await repository.chooseSet(id);
        if (this.owner !== owner || this.generation !== generation || useAuthStore().user?.id !== owner || useAuthStore().sessionGeneration !== generation) return;
        for (const set of [...this.sets, ...this.savedSets]) set.is_used = set.id === id;
      });
    },
  },
});
