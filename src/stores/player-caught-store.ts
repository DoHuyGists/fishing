import { acceptHMRUpdate, defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { supabaseFishRepository } from "../data/supabaseFishRepository";
import { useReadCacheStore } from "./player-read-cache";
import type { CaughtFish } from "../types/model/caughtFish";

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
    async releaseFish(id: string): Promise<boolean> {
      const auth = useAuthStore(), generation = auth.sessionGeneration;
      try {
        await supabaseFishRepository.deleteCaughtFish(id);
      } catch (error) {
        if (auth.sessionGeneration === generation) throw error;
        return false;
      }
      if (auth.sessionGeneration !== generation) return false;
      this.caughtFishes = this.caughtFishes.filter(fish => fish.id !== id);
      return true;
    },
    async listFishForSale(id: string, price: number): Promise<boolean> {
      const auth = useAuthStore(), generation = auth.sessionGeneration;
      try {
        await supabaseFishRepository.listFishOnMarket(id, price);
      } catch (error) {
        if (auth.sessionGeneration === generation) throw error;
        return false;
      }
      if (auth.sessionGeneration !== generation) return false;
      this.caughtFishes = this.caughtFishes.filter(fish => fish.id !== id);
      return true;
    },
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
      await supabaseFishRepository.completeFishing();
      if (auth.sessionGeneration !== generation) return;
      this.caughtFishes = this.caughtFishes.filter((f) => f.status !== "in-net");
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
