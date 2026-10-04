import { defineStore } from "pinia";
import { supabaseUserProfileRepository, type UserProfile } from "../data/supabaseUserProfileRepository";

export const useUserProfileStore = defineStore("userProfile", {
  state: () => ({
    profile: null as UserProfile | null,
    loading: false,
    error: "",
  }),
  getters: {
    level: (state) => state.profile?.level ?? 1,
    experiencePoint: (state) => state.profile?.experience_point ?? 0,
    inventoryCapacity: (state) => state.profile?.inventory_capacity ?? 20,
    speciesStorageCapacity: (state) => state.profile?.species_storage_capacity ?? 50,
  },
  actions: {
    async fetchProfile(userId: string) {
      this.loading = true;
      this.error = "";
      try {
        const data = await supabaseUserProfileRepository.fetchUserProfile(userId);
        this.profile = data;
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Không thể tải thông tin hồ sơ người chơi";
      } finally {
        this.loading = false;
      }
    },
  },
});
