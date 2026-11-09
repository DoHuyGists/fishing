import { defineStore } from "pinia";
import { supabaseUserProfileRepository, type UserProfile } from "../data/supabaseUserProfileRepository";
import { supabaseAvatarRepository } from "../data/supabaseAvatarRepository";

export const useUserProfileStore = defineStore("userProfile", {
  state: () => ({
    profile: null as UserProfile | null,
    loading: false,
    error: "",
  }),
  getters: {
    level: (state) => state.profile?.level ?? 0,
    experiencePoint: (state) => state.profile?.experience_point ?? 0,
    skillPoints: (state) => state.profile?.skill_points ?? 0,
    inventoryCapacity: (state) => state.profile?.inventory_capacity ?? 0,
    speciesStorageCapacity: (state) => state.profile?.species_storage_capacity ?? 0,
  },
  actions: {
    async updateIdentity(displayName: string, avatarUrl: string | null, file?: File) {
      const name = displayName.trim();
      if (name.length < 2 || name.length > 40) throw new Error("Tên hiển thị cần từ 2 đến 40 ký tự.");
      const keepStoredAvatar = Boolean(this.profile?.avatar_path && avatarUrl === this.profile.avatar_url);
      if (!file && !keepStoredAvatar && avatarUrl) {
        let url: URL;
        try { url = new URL(avatarUrl); } catch { throw new Error("Đường dẫn ảnh đại diện không hợp lệ."); }
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error("Ảnh đại diện cần là đường dẫn HTTPS.");
      }
      let uploaded: string | undefined;
      try {
        if (file) {
          if (!this.profile) throw new Error("Không tìm thấy hồ sơ.");
          uploaded = await supabaseAvatarRepository.upload(this.profile.id, file);
        }
        const path = uploaded ?? (avatarUrl === this.profile?.avatar_url ? this.profile?.avatar_path : null) ?? null;
        this.profile = await supabaseUserProfileRepository.updateIdentity(name, path ? null : avatarUrl, path);
      } catch (err) {
        if (uploaded) { try { await supabaseAvatarRepository.remove(uploaded); } catch { /* Preserve the original save error. */ } }
        throw err;
      }
    },
    async completeOnboarding() {
      await supabaseUserProfileRepository.completeOnboarding();
      if (this.profile) this.profile.onboarding_completed = true;
    },
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
    async updateCountry(userId: string, countryId: string) {
      this.error = "";
      try {
        this.profile = await supabaseUserProfileRepository.updateCountry(userId, countryId);
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Không thể cập nhật quốc gia";
        throw err;
      }
    },
  },
});
