import { defineStore } from 'pinia';
import { supabaseUserInAreaRepository } from '../data/supabaseUserInAreaRepository';
import { useAuthStore } from './auth';
import type { FishingFatigue } from '../types/model/fishingFatigue';
import { t as tr } from '../i18n';

export const useFishingFatigueStore = defineStore('fishingFatigue', {
  state: () => ({ snapshot: null as FishingFatigue | null, error: '', requestId: 0 }),
  actions: {
    async refresh(areaId: string) {
      const auth = useAuthStore();
      const userId = auth.user?.id;
      if (!userId) return;
      const generation = auth.sessionGeneration;
      const request = ++this.requestId;
      try {
        const snapshot = await supabaseUserInAreaRepository.touchPresence();
        if (request !== this.requestId || auth.sessionGeneration !== generation || auth.user?.id !== userId) return;
        if (snapshot.area_id !== areaId) { this.snapshot = null; return; }
        this.snapshot = snapshot;
        this.error = '';
      } catch {
        if (request === this.requestId && auth.sessionGeneration === generation) {
          this.error = tr('FishingFatigue.unavailable');
        }
      }
    },
    reset() { this.requestId++; this.snapshot = null; this.error = ''; },
  },
});
