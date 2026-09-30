import { defineStore } from "pinia";
import { supabaseMissionRepository } from "../data/supabaseMissionRepository";
import type { HourMission } from "../data/supabaseMissionRepository";

export const useMissionStore = defineStore("Mission", {
  state: () => ({
    missions: [] as HourMission[],
  }),
  actions: {
    async SetMission() {
      this.missions = await supabaseMissionRepository.fetchMission();
    },
    async ClaimMission(missionId: string, caughtIds: string[]) {
      await supabaseMissionRepository.claimMission(missionId, caughtIds);
    },
  },
});
