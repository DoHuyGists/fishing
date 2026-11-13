import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { supabaseFishRepository } from "../data/supabaseFishRepository";
import { useReadCacheStore } from './readCache';
export interface CaughtFish {
  id: string;
  created_at: string;
  user_id: string;
  weight: number;
  is_shiny: boolean;
  variant_type: "NORMAL" | "GOLDEN" | "MUTATED";
  status: string;
  species: {
    id: string;
    name: string;
    weight: number;
    image: string | null;
    rarity: string | null;
  };
  origin: {
    id: string;
    country: string;
    name: string;
    x: number;
    y: number;
    location: { x: number; y: number }[];
    isAvailable: boolean;
  } | null;
}

export const useCaughtStore = defineStore("Caught", {
  state: () => ({
    isLoadingCaught: false,
    caughtFishes: [] as CaughtFish[],
  }),
  getters: {
    inNetFishes: (state) => state.caughtFishes.filter((f) => f.status === "in-net"),
    storedFishes: (state) => state.caughtFishes.filter((f) => f.status === "normal"),
  },
  actions: {
    async moveFishes(ids: string[], status: "normal" | "in-net") {
      const auth = useAuthStore(), generation = auth.sessionGeneration;
      await supabaseFishRepository.updateCaughtStatus(ids, status);
      if (auth.sessionGeneration !== generation) return;
      const set = new Set(ids);
      this.caughtFishes.forEach((f) => {
        if (set.has(f.id)) f.status = status;
      });
    },
    async finishFishing() {
      const auth = useAuthStore(), generation = auth.sessionGeneration;
      await supabaseFishRepository.deleteInNetFishes();
      if (auth.sessionGeneration !== generation) return;
      this.caughtFishes = this.caughtFishes.filter((f) => f.status !== "in-net");
      await supabaseFishRepository.completeFishing();
    },
    async loadCaughtFishes(force = false) {
      const authStore = useAuthStore();
      const userId = authStore.user?.id, generation = authStore.sessionGeneration;
      if (!userId) return;
      const current = () => authStore.user?.id === userId && authStore.sessionGeneration === generation;
      if (force) await useReadCacheStore().invalidate(['caught']);
      if (!current()) return;
      this.isLoadingCaught = true;
      try {
        const fishes = await supabaseFishRepository.fetchAllCaughtFishes(userId);
        if (current()) this.caughtFishes = fishes;
      } catch (err) {
        console.error("Lỗi khi tải danh sách cá:", err);
      } finally {
        if (current()) this.isLoadingCaught = false;
      }
    },
  },
});
