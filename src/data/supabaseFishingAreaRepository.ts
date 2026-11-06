import supabase from "../database/connection";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { TensionSubmission } from "./tensionChallenge";

export interface FishingSessionRow {
  id: string;
  status: string;
}

export interface FishingAreaRow {
  id: string;
  createdAt: string;
  countryId: string;
  isAvailable: boolean;
  title: string | null;
  location: any;
  scenePath: string | null;
  fishingBoundary: any[];
  zoneId: string | null;
  maxDepth: number | null;
}

export interface FishingAreaPayload {
  countryId: string;
  isAvailable: boolean;
  title: string | null;
  location: any;
  scenePath: string | null;
  fishingBoundary: any[];
  zoneId: string | null;
  maxDepth: number | null;
}

function mapRow(row: any): FishingAreaRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    countryId: row.country_id,
    isAvailable: row.is_available,
    title: row.title,
    location: row.location,
    scenePath: row.scene_path,
    fishingBoundary: row.fishing_boundary ?? [],
    zoneId: row.zone_id ?? null,
    maxDepth: row.max_depth == null ? null : Number(row.max_depth),
  };
}

function toDbPayload(payload: FishingAreaPayload) {
  return {
    country_id: payload.countryId,
    is_available: payload.isAvailable,
    title: payload.title,
    location: payload.location,
    scene_path: payload.scenePath,
    fishing_boundary: payload.fishingBoundary,
    zone_id: payload.zoneId,
    max_depth: payload.maxDepth,
  };
}

class SupabaseFishingAreaRepository {
  async castRod(areaId: string, castDepth: number) {
    const { data, error } = await supabase.rpc("cast_rod", { p_area_id: areaId, p_cast_depth: castDepth });
    if (error) throw new Error(error.message);
    return data;
  }

  async fetchSessionChallenge(sessionId: string) {
    const { data, error } = await supabase.from("fishing_sessions")
      .select("id, status, challenge_data").eq("id", sessionId).single();
    if (error) throw new Error(error.message);
    return data as { id: string; status: string; challenge_data: unknown };
  }

  async submitChallenge(sessionId: string, success: boolean, timeSpentMs: number) {
    const { data, error } = await supabase.rpc("submit_challenge", {
      p_session_id: sessionId, p_success: success, p_time_spent_ms: timeSpentMs,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async startTensionChallenge(sessionId: string) {
    const { data, error } = await supabase.rpc("start_tension_challenge", { p_session_id: sessionId });
    if (error) throw new Error(error.message);
    return data as { challenge_data?: unknown; resolution?: unknown; server_time_ms: number };
  }

  async submitTensionChallenge(payload: TensionSubmission) {
    const { data, error } = await supabase.rpc("submit_tension_challenge", { p_payload: payload });
    if (error) throw new Error(error.message);
    return data;
  }

  subscribeToFishingSession(sessionId: string, onBite: (session: FishingSessionRow) => void): RealtimeChannel {
    return supabase
      .channel(`fishing_session_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "fishing_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const session = payload.new as FishingSessionRow;
          if (session.id === sessionId && session.status === "BITE") onBite(session);
        },
      )
      .subscribe((status) => {
        // Recover a BITE update that happened before subscription or reconnect.
        if (status === "SUBSCRIBED") {
          void this.fetchSessionChallenge(sessionId).then((session) => {
            if (session.status === "BITE") onBite(session);
          }).catch((error) => console.error("Không thể kiểm tra phiên câu cá:", error));
        }
      });
  }

  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await supabase.removeChannel(channel);
  }

  async fetchAllAreasAdmin(): Promise<FishingAreaRow[]> {
    const { data, error } = await supabase.from("fishing_areas").select("*").order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    if (!data) return [];

    return data.map(mapRow);
  }

  async createArea(payload: FishingAreaPayload): Promise<FishingAreaRow> {
    const { data, error } = await supabase.from("fishing_areas").insert(toDbPayload(payload)).select("*").single();

    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  async updateArea(id: string, payload: FishingAreaPayload): Promise<FishingAreaRow> {
    const { data, error } = await supabase.from("fishing_areas").update(toDbPayload(payload)).eq("id", id).select("*").single();

    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  async deleteArea(id: string): Promise<void> {
    const { error } = await supabase.from("fishing_areas").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
  async fetchAreas(): Promise<any[]> {
    const { data, error } = await supabase.from("fishing_areas").select("id, country_id, title, location, scene_path").eq("is_available", true);

    if (error) throw new Error(error.message);

    if (!data) return [];

    return data.map((x) => ({
      id: x.id,
      title: x.title,
      countryId: x.country_id,
      location: x.location,
      scenePath: x.scene_path,
    }));
  }
  async fetchOneAreas(areaId: string): Promise<any> {
    const { data, error } = await supabase.from("fishing_areas").select("id, country_id, title, location, scene_path, fishing_boundary, max_depth").eq("id", areaId).maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) return null;

    return {
      id: data.id,
      title: data.title,
      countryId: data.country_id,
      location: data.location,
      scenePath: data.scene_path,
      fishingBoundary: data.fishing_boundary,
      maxDepth: data.max_depth == null ? null : Number(data.max_depth),
    };
  }
}

export const supabaseFishingAreaRepository = new SupabaseFishingAreaRepository();
