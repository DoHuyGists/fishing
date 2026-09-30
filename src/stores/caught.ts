import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { supabaseFishRepository } from "../data/supabaseFishRepository";
const authStore = useAuthStore();
export const useCaughtStore = defineStore("Caught", {
  state: () => ({
    isLoadingCaught: false,
    caughtFishes: [] as Array<{
      id: string;
      created_at: string | null;
      user_id: string;
      species_id: string;
      weight: number;
      fish: {
        id: string;
        name: string;
        weight: number;
        image: string | null;
        rarity: string | null;
      } | null;
    }>,
  }),
  actions: {
    async loadCaughtFishes() {
      const userId = authStore.userId;
      if (!userId) return;
      this.isLoadingCaught = true;
      try {
        this.caughtFishes = await supabaseFishRepository.fetchAllCaughtFishes(userId);
      } catch (err) {
        console.error("Lỗi khi tải danh sách cá:", err);
      } finally {
        this.isLoadingCaught = false;
      }
    },
  },
});
