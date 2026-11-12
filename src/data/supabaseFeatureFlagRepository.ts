import type { FeatureFlagRow, FeatureFlagUpdate } from "../types/table/featureFlag";
import supabase from "../database/connection";
import type { RealtimeChannel } from "@supabase/supabase-js";
const columns = "feature_key,enabled,message_vi,message_en,updated_at,updated_by";

class SupabaseFeatureFlagRepository {
  async fetchAll(): Promise<FeatureFlagRow[]> {
    const { data, error } = await supabase.from("feature_flags").select(columns).order("feature_key")
      .abortSignal(AbortSignal.timeout(10_000));
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async update(key: string, payload: FeatureFlagUpdate, expectedUpdatedAt: string): Promise<FeatureFlagRow | null> {
    const { data, error } = await supabase.from("feature_flags")
      .update({ enabled: payload.enabled, message_vi: payload.message_vi.trim(), message_en: payload.message_en.trim() })
      .eq("feature_key", key).eq("updated_at", expectedUpdatedAt).select(columns).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  subscribe(onChange: () => void): RealtimeChannel {
    return supabase.channel(`feature-flags:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "feature_flags" }, onChange)
      .subscribe(status => { if (status === "SUBSCRIBED") onChange(); });
  }

  async unsubscribe(channel: RealtimeChannel) { await supabase.removeChannel(channel); }
}

export const supabaseFeatureFlagRepository = new SupabaseFeatureFlagRepository();
