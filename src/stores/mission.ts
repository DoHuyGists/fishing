import type { DailyMissionData, HourMission } from "../types/model/mission";
import { defineStore } from "pinia";
import { supabaseMissionRepository } from "../data/supabaseMissionRepository";


export const useMissionStore = defineStore("Mission", {
  state: () => ({
    missions: [] as HourMission[],
    dailyMissions: null as DailyMissionData | null,
  }),
  actions: {
    async SetMission() {
      this.missions = await supabaseMissionRepository.fetchMission();
    },
    async setDailyMissions() {
      this.dailyMissions = await supabaseMissionRepository.fetchDailyMissions();
    },
    async ClaimMission(missionId: string, caughtIds: string[]) {
      await supabaseMissionRepository.claimMission(missionId, caughtIds);
    },
  },
});
