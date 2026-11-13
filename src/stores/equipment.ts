import type { EquipmentVariant } from "../types/model/equipment";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { defaultEquipmentVariants } from "../data/equipmentCatalog";

import { supabaseEquipmentRepository } from "../data/supabaseEquipmentRepository";
import { useReadCacheStore } from './readCache';
import { useAuthStore } from './auth';
import { useUserProfileStore } from './userProfile';
import { useFishingStore, type FishingTool } from "./fishing";

export type Category = "rod" | "line" | "reel" | "hook" | "bait";

export interface ItemData {
  category: Category;
  name?: string;
  image?: string;
  [key: string]: unknown;
}

interface EquipItem extends ItemData {
  id: string;
  inventory_id?: string;
  is_used?: boolean;
}

export interface EquipmentSet {
  id: string;
  createdAt: string;
  userId: string;
  rod: EquipItem[];
  line: EquipItem[];
  reel: EquipItem[];
  hook: EquipItem[];
  bait: EquipItem[];
  isUsed: boolean;
}

let pendingRequest: { userId: string; requestId: number; promise: Promise<void> } | null = null;

export const useEquipmentStore = defineStore("equipment", {
  state: () => ({
    variants: defaultEquipmentVariants as Record<FishingTool, EquipmentVariant[]>,
    userId: null as string | null,
    loading: false,
    loaded: false,
    error: "",
    requestId: 0,
  }),
  actions: {
    countSetItems(set: EquipmentSet) {
      return set.rod.length + set.line.length + set.reel.length + set.hook.length + set.bait.length;
    },
    syncLoadout() {
      const selected: Partial<Record<FishingTool, string>> = {};
      for (const tool of Object.keys(this.variants) as FishingTool[]) {
        const usedVariant = this.variants[tool].find((variant) => variant.is_used);
        if (usedVariant) selected[tool] = usedVariant.id;
      }
      Object.assign(useFishingStore().equipmentLoadout, selected);
    },
    async fetchEquipment(userId: string, force = false) {
      const auth = useAuthStore(), generation = auth.sessionGeneration;
      const current = () => auth.user?.id === userId && auth.sessionGeneration === generation;
      if (!current()) return;
      if (force) await useReadCacheStore().invalidate(['equipment']);
      if (!current()) return;
      if (pendingRequest?.userId === userId && pendingRequest.requestId === this.requestId) {
        const requestId = this.requestId;
        await pendingRequest.promise;
        if (current() && requestId === this.requestId && this.loaded && this.userId === userId) this.syncLoadout();
        return;
      }
      if (!force && this.loaded && this.userId === userId) {
        this.syncLoadout();
        return;
      }
      const requestId = ++this.requestId;
      this.loading = true;
      this.error = "";
      const promise = (async () => {
        try {
          const variants = await supabaseEquipmentRepository.fetchEquipment();
          if (!current() || requestId !== this.requestId) return;
          this.variants = variants;
          this.userId = userId;
          this.loaded = true;
          this.syncLoadout();
        } catch (err) {
          if (!current() || requestId !== this.requestId) return;
          this.loaded = false;
          this.error = err instanceof Error ? err.message : tr('equipment.khong_the_tai_trang_bi_tu_may_chu');
        } finally {
          if (current() && requestId === this.requestId) this.loading = false;
        }
      })();
      pendingRequest = { userId, requestId, promise };
      await promise;
      if (pendingRequest?.promise === promise) pendingRequest = null;
    },
    reset() {
      const requestId = this.requestId + 1;
      this.$reset();
      this.requestId = requestId;
      pendingRequest = null;
    },
    normalize(row: any): EquipmentSet {
      return {
        ...row,
        rod: row.rod ?? [],
        line: row.line ?? [],
        reel: row.reel ?? [],
        hook: row.hook ?? [],
        bait: row.bait ?? [],
      };
    },
    async chooseSet(userId: string, setId: string) {
      await supabaseEquipmentRepository.updateCurrentUsedSet(userId, setId);
    },
    async buySet() {
      return supabaseEquipmentRepository.CreateNewSet();
    },
    async saveSet(userId: string, set: EquipmentSet) {
      const capacity = useUserProfileStore().equipmentCapacity;
      if (this.countSetItems(set) > capacity) {
        throw new Error(tr('EquipmentSets.capacity_reached', { capacity }));
      }
      return supabaseEquipmentRepository.UpdateSet(userId, set);
    },
  },
});
