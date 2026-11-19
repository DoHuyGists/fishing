import type { UserInAreaRow } from '../types/table/userInArea';
import { defineStore } from 'pinia';
import { supabaseUserInAreaRepository } from '../data/supabaseUserInAreaRepository';
import { useAuthStore } from './auth';
import { createKeyedRefreshTask } from '../utils/refreshTask';
const refreshArea = createKeyedRefreshTask<UserInAreaRow | null>();

export const useUserInAreaStore = defineStore('UserInArea', {
  state: () => ({ userInArea: null as UserInAreaRow | null, requestId: 0 }),
  getters: { canEnterFishingArea: state => state.userInArea?.status == null },
  actions: {
    async setCurrentUserInArea(userId: string, invalidate = false) {
      const auth = useAuthStore();
      const generation = auth.sessionGeneration;
      const request = ++this.requestId;
      const area = await refreshArea(userId + ':' + generation,
        () => supabaseUserInAreaRepository.getCurrentUserArea(userId), invalidate);
      if (request === this.requestId && auth.user?.id === userId && auth.sessionGeneration === generation) this.userInArea = area;
      return area;
    },
  },
});
