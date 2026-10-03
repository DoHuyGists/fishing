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
      weight: number;
      is_shiny: boolean;
      variant_type: "NORMAL" | "GOLDEN" | "MUTATED";
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
      }
    }>,
  }),
  actions: {
    async loadCaughtFishes() {
      const userId = authStore.userId;
      if (!userId) return;
      this.isLoadingCaught = true;
      try {
        this.caughtFishes = await supabaseFishRepository.fetchAllCaughtFishes();
      } catch (err) {
        console.error("Lỗi khi tải danh sách cá:", err);
      } finally {
        this.isLoadingCaught = false;
      }
    },
  },
});
