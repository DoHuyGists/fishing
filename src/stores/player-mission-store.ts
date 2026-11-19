import type { DailyMissionData, HourMission } from "../types/model/mission";
import { defineStore } from "pinia";
import { supabaseMissionRepository } from "../data/supabaseMissionRepository";
import { useAuthStore } from "./auth";
import dayjs from "dayjs";

const dailyRequests = new WeakMap<object, { key: string; promise: Promise<void> }>();

export const useMissionStore = defineStore("Mission", {
  state: () => ({
    missions: [] as HourMission[],
    dailyMissions: null as DailyMissionData | null,
    dailyMissionsInitializedOn: "",
    claimingDailyRewardId: "",
  }),
  getters: {
    dailyMissionProgress(state) {
      return (state.dailyMissions?.missions ?? []).map((mission) => ({
        ...mission,
        isTargetReached: mission.is_completed || (mission.target_value > 0 && mission.current_value >= mission.target_value),
        progressPercent: mission.is_completed ? 100 : mission.target_value > 0
          ? Math.max(0, Math.min(100, mission.current_value / mission.target_value * 100))
          : 0,
      }));
    },
    completedDailyMissionCount(): number {
      return this.dailyMissionProgress.filter((mission) => mission.isTargetReached).length;
    },
    dailyRewardMilestones(state) {
      return [...(state.dailyMissions?.rewards ?? [])].sort(
        (first, second) => first.required_points - second.required_points,
      );
    },
  },
  actions: {
    async claimDailyMissionReward(rewardId: string) {
      if (this.claimingDailyRewardId) return false;
      const reward = this.dailyMissions?.rewards.find((entry) => entry.id === rewardId);
      if (!reward?.can_claim) return false;

      this.claimingDailyRewardId = rewardId;
      try {
        await supabaseMissionRepository.claimDailyMissionReward(rewardId);
        reward.is_claimed = true;
        reward.can_claim = false;
        await this.setDailyMissions();
        return true;
      } finally {
        this.claimingDailyRewardId = "";
      }
    },
    async SetMission() {
      this.missions = await supabaseMissionRepository.fetchMission();
    },
    async ensureDailyMissions() {
      if (this.dailyMissionsInitializedOn === dayjs().format("YYYY-MM-DD")) return;
      await this.setDailyMissions();
    },
    async setDailyMissions() {
      const auth = useAuthStore();
      const userId = auth.user?.id;
      if (!userId) return;
      const generation = auth.sessionGeneration;
      const date = dayjs().format("YYYY-MM-DD");
      const key = `${userId}:${generation}:${date}`;
      const pending = dailyRequests.get(this);
      if (pending?.key === key) return pending.promise;

      const promise = (async () => {
        const data = await supabaseMissionRepository.fetchDailyMissions();
        if (auth.user?.id !== userId || auth.sessionGeneration !== generation) return;
        this.dailyMissions = data;
        this.dailyMissionsInitializedOn = date;
      })();
      dailyRequests.set(this, { key, promise });
      try {
        await promise;
      } finally {
        if (dailyRequests.get(this)?.promise === promise) dailyRequests.delete(this);
      }
    },
    async ClaimMission(missionId: string, caughtIds: string[]) {
      await supabaseMissionRepository.claimMission(missionId, caughtIds);
    },
  },
});
