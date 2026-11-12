import type { HourMission, DailyMissionData } from "../types/model/mission";
import { t as tr } from "../i18n";
import supabase from "../database/connection";
import { formatTime } from "../utils/time";

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

    return (data ?? []).map((x: HourMission) => ({
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
