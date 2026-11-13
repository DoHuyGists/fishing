import type { UserProfile } from "../types/model/userProfile";
import { t as tr } from "../i18n";
import { defineStore } from "pinia";
import { useAuthStore } from "./auth";
import { createKeyedRefreshTask } from "../utils/refreshTask";
import { supabaseUserProfileRepository } from "../data/supabaseUserProfileRepository";
import { supabaseAvatarRepository } from "../data/supabaseAvatarRepository";

const refreshProfile = createKeyedRefreshTask<UserProfile | null>();

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
      if (name.length < 2 || name.length > 40) throw new Error(tr('userProfile.ten_hien_thi_can_tu_2_den_40_ky_tu'));
      const keepStoredAvatar = Boolean(this.profile?.avatar_path && avatarUrl === this.profile.avatar_url);
      if (!file && !keepStoredAvatar && avatarUrl) {
        let url: URL;
        try { url = new URL(avatarUrl); } catch { throw new Error(tr('userProfile.duong_dan_anh_dai_dien_khong_hop_le')); }
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error(tr('userProfile.anh_dai_dien_can_la_duong_dan_https'));
      }
      let uploaded: string | undefined;
      try {
        if (file) {
          if (!this.profile) throw new Error(tr('userProfile.khong_tim_thay_ho_so'));
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
    async fetchProfile(userId: string, invalidate = false) {
      const auth = useAuthStore();
      const generation = auth.sessionGeneration;
      if (auth.user?.id !== userId) return;
      const current = () => auth.user?.id === userId && auth.sessionGeneration === generation;
      this.loading = true; this.error = '';
      try {
        const data = await refreshProfile(userId + ':' + generation,
          () => supabaseUserProfileRepository.fetchUserProfile(userId), invalidate);
        if (current()) this.profile = data;
      } catch (err) {
        if (current()) this.error = err instanceof Error ? err.message : tr('userProfile.khong_the_tai_thong_tin_ho_so_nguoi_choi');
      } finally { if (current()) this.loading = false; }
    },
    async updateCountry(userId: string, countryId: string) {
      this.error = "";
      try {
        this.profile = await supabaseUserProfileRepository.updateCountry(userId, countryId);
      } catch (err) {
        this.error = err instanceof Error ? err.message : tr('userProfile.khong_the_cap_nhat_quoc_gia');
        throw err;
      }
    },
  },
});
