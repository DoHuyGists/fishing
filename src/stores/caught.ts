import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { supabaseFishRepository } from "../data/supabaseFishRepository";
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

const authStore = useAuthStore();
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
      await supabaseFishRepository.updateCaughtStatus(ids, status);
      const set = new Set(ids);
      this.caughtFishes.forEach((f) => {
        if (set.has(f.id)) f.status = status;
      });
    },
    async finishFishing() {
      await supabaseFishRepository.deleteInNetFishes();
      this.caughtFishes = this.caughtFishes.filter((f) => f.status !== "in-net");
      await supabaseFishRepository.completeFishing();
    },
    async loadCaughtFishes() {
      const userId = authStore.userId;
      if (!userId) return;
      this.isLoadingCaught = true;
      try {
        const fishes = await supabaseFishRepository.fetchAllCaughtFishes(userId);
        if (authStore.user?.id === userId) this.caughtFishes = fishes;
      } catch (err) {
        console.error("Lỗi khi tải danh sách cá:", err);
      } finally {
        this.isLoadingCaught = false;
      }
    },
  },
});
