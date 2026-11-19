import { acceptHMRUpdate, defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { supabaseFishRepository } from "../data/supabaseFishRepository";
import { useReadCacheStore } from "./player-read-cache";
export interface CaughtFish {
  id: string;
  created_at: string;
  user_id: string;
  weight: number;
  is_shiny: boolean;
  star_rating?: number | null;
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
    latestCaughtViewMode: "group",
  }),
  getters: {
    inNetFishes: (state) => state.caughtFishes.filter((f) => f.status === "in-net"),
    inNetFishGroups(): { fish: CaughtFish; count: number }[] {
      const groups = new Map<string, { fish: CaughtFish; count: number }>();
      for (const fish of this.inNetFishes) {
        const key = fish.species?.id || "unknown";
        const group = groups.get(key);
        if (group) group.count += 1;
        else groups.set(key, { fish, count: 1 });
      }
      return [...groups.values()];
    },
    storedFishes: (state) => state.caughtFishes.filter((f) => f.status === "normal"),
  },
  actions: {
    async moveFishes(ids: string[], status: "normal" | "in-net") {
      const auth = useAuthStore(),
        generation = auth.sessionGeneration;
      await supabaseFishRepository.updateCaughtStatus(ids, status);
      if (auth.sessionGeneration !== generation) return;
      const set = new Set(ids);
      this.caughtFishes.forEach((f) => {
        if (set.has(f.id)) f.status = status;
      });
    },
    async finishFishing() {
      const auth = useAuthStore(),
        generation = auth.sessionGeneration;
      await supabaseFishRepository.deleteInNetFishes();
      if (auth.sessionGeneration !== generation) return;
      this.caughtFishes = this.caughtFishes.filter((f) => f.status !== "in-net");
      await supabaseFishRepository.completeFishing();
    },
    async loadCaughtFishes(force = false) {
      const authStore = useAuthStore();
      const userId = authStore.user?.id,
        generation = authStore.sessionGeneration;
      if (!userId) return;
      const current = () => authStore.user?.id === userId && authStore.sessionGeneration === generation;
      if (force) await useReadCacheStore().invalidate(["caught"]);
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

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCaughtStore, import.meta.hot));
}
