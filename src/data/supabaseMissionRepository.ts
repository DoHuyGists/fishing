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

class SupabaseMissionRepository {
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
    const { error } = await supabase.rpc("claim_hour_mission", {
      p_mission_id: missionId,
      p_caught_ids: caughtIds,
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}

export const supabaseMissionRepository = new SupabaseMissionRepository();
