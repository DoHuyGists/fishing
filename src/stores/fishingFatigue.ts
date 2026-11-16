import { defineStore } from 'pinia';
import { supabaseUserInAreaRepository } from '../data/supabaseUserInAreaRepository';
import { useAuthStore } from './auth';
import type { FishingFatigue } from '../types/model/fishingFatigue';

export const useFishingFatigueStore = defineStore('fishingFatigue', {
  state: () => ({
    snapshots: {} as Record<string, FishingFatigue>,
    errors: {} as Record<string, boolean>,
    loading: {} as Record<string, boolean>,
  }),
  actions: {
    snapshotKey(areaId: string, presence: boolean) {
      const auth = useAuthStore();
      return `${auth.sessionGeneration}:${auth.user?.id ?? ''}:${areaId}:${presence}`;
    },
    async refresh(areaId: string, presence = false) {
      const auth = useAuthStore();
      if (!auth.user?.id) return;
      const key = this.snapshotKey(areaId, presence);
      if (this.loading[key]) return;
      this.loading[key] = true;
      try {
        const snapshot = presence
          ? await supabaseUserInAreaRepository.touchPresence()
          : await supabaseUserInAreaRepository.fetchFatigue(areaId);
        if (key !== this.snapshotKey(areaId, presence)) return;
        if (snapshot.area_id !== areaId) throw new Error('Unexpected fatigue area');
        this.snapshots[key] = snapshot;
        this.errors[key] = false;
      } catch {
        if (key === this.snapshotKey(areaId, presence)) this.errors[key] = true;
      } finally {
        delete this.loading[key];
      }
    },
  },
});
