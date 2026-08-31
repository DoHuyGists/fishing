import { defineStore } from "pinia";
import { defaultEquipmentVariants, type EquipmentVariant } from "../data/equipmentCatalog";
import type { EquipmentRepository } from "../data/equipmentRepository";
import { supabaseEquipmentRepository } from "../data/supabaseEquipmentRepository";
import type { FishingTool } from "./fishing";

// Swap this to change the data source without touching stores/components.
const equipmentRepository: EquipmentRepository = supabaseEquipmentRepository;

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
        this.variants = await equipmentRepository.fetchEquipment(userId);
        this.userId = userId;
        this.loaded = true;
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
  },
});
