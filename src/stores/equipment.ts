import { defineStore } from "pinia";
import { defaultEquipmentVariants, type EquipmentVariant } from "../data/equipmentCatalog";

import { supabaseEquipmentRepository } from "../data/supabaseEquipmentRepository";
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

export const useEquipmentStore = defineStore("equipment", {
  state: () => ({
    variants: defaultEquipmentVariants as Record<FishingTool, EquipmentVariant[]>,
    userId: null as string | null,
    loading: false,
    loaded: false,
    error: "",
  }),
  actions: {
    async fetchEquipment(userId: string) {
      if (this.loading || (this.loaded && this.userId === userId)) return;
      this.loading = true;
      this.error = "";
      try {
        this.variants = await supabaseEquipmentRepository.fetchEquipment(userId);
        this.userId = userId;
        this.loaded = true;
        const selected = await supabaseEquipmentRepository.fetchSelected(userId);
        Object.assign(useFishingStore().equipmentLoadout, selected);
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Không thể tải trang bị từ máy chủ";
      } finally {
        this.loading = false;
      }
    },
    reset() {
      this.variants = defaultEquipmentVariants;
      this.userId = null;
      this.loaded = false;
      this.error = "";
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
      supabaseEquipmentRepository.updateCurrentUsedSet(userId, setId);
    },
    async buySet(userId: string) {
      return supabaseEquipmentRepository.CreateNewSet(userId);
    },
    async saveSet(userId: string, set: EquipmentSet) {
      return supabaseEquipmentRepository.UpdateSet(userId, set);
    },
  },
});
