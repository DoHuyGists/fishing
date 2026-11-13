import { defineStore } from 'pinia';
import { useAuthStore } from './auth';
import { useCurrencyStore } from './currency';
import { useUserProfileStore } from './userProfile';
import { useCountryStore } from './country';
import { useUserInAreaStore } from './userInArea';
import type { PlayerSnapshot } from '../types/model/playerRefresh';

export const usePlayerRefreshStore = defineStore('playerRefresh', {
  actions: {
    async refresh(userId: string, snapshots: PlayerSnapshot[], invalidate = false) {
      if (useAuthStore().user?.id !== userId) return;
      const results = await Promise.allSettled(snapshots.map(snapshot => {
        switch (snapshot) {
          case 'currency': return useCurrencyStore().fetchCurrency(invalidate);
          case 'profile': return useUserProfileStore().fetchProfile(userId, invalidate);
          case 'countries': return useCountryStore().fetchMyUnlockedCountries(userId, invalidate);
          case 'area': return useUserInAreaStore().setCurrentUserInArea(userId, invalidate);
        }
      }));
      if (useAuthStore().user?.id !== userId) return;
      const failure = results.find(result => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
      const errors = {
        currency: useCurrencyStore().error,
        profile: useUserProfileStore().error,
        countries: useCountryStore().unlockedError,
        area: '',
      };
      const message = snapshots.map(snapshot => errors[snapshot]).find(Boolean);
      if (message) throw new Error(message);
    },
  },
});
