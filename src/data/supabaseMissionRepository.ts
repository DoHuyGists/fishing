import { t as tr } from "../i18n";
import supabase from "../database/connection";
import { formatTime } from "../utils/time";

interface HourMisssion {
  id: string;
  content: MissionFish[];
  start: string;
  end: string;
  cash: number;
}

export interface MissionFish {
  id: string;
  name: string;
  image: string;
  length: string;
  rarity: string;
}

export interface HourMission {
  id: string;
  content: MissionFish[];
  start: string;
  end: string;
  cash: number;
}

export interface DailyMission {
  id: string;
  template_id: string;
  code: string;
  name: string;
  description: string;
  event_type: string;
  difficulty: string;
  target_value: number;
  current_value: number;
  mission_points: number;
  config: Record<string, unknown>;
  is_completed: boolean;
  completed_at: string | null;
}

export interface DailyMissionReward {
  id: string;
  required_points: number;
  reward_data: unknown[];
  is_unlocked: boolean;
  is_claimed: boolean;
  can_claim: boolean;
}

export interface DailyMissionData {
  mission_date: string;
  total_points: number;
  mission_count: number;
  missions: DailyMission[];
  rewards: DailyMissionReward[];
}

class SupabaseMissionRepository {
  async fetchDailyMissions(): Promise<DailyMissionData> {
    const { data, error } = await supabase.rpc("get_daily_missions");
    if (error) throw new Error(error.message);
    if (!data) throw new Error(tr('supabaseMissionRepository.khong_co_du_lieu_nhiem_vu_hang_ngay'));
    return data as DailyMissionData;
  }

  async fetchMission(): Promise<HourMission[]> {
    const { data, error } = await supabase.rpc("get_current_hour_missions");

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((x: HourMisssion) => ({
      id: x.id,
      content: x.content,
      start: formatTime(x.start),
      end: formatTime(x.end),
      cash: x.cash,
    }));
  }

  async claimMission(missionId: string, caughtIds: string[]): Promise<void> {
    const { error } = await supabase.rpc("complete_hour_mission", {
      p_mission_id: missionId,
      p_caught_ids: caughtIds,
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}

export const supabaseMissionRepository = new SupabaseMissionRepository();
