import supabase from "../database/connection";
import type { FeatureIndicatorSnapshot, IndicatorFeature } from "../types/model/featureIndicator";

class SupabaseFeatureIndicatorRepository {
  async fetchSummary(features: IndicatorFeature[]): Promise<FeatureIndicatorSnapshot> {
    const { data, error } = await supabase.rpc("get_my_feature_indicators", { p_features: features });
    if (error) throw new Error(error.message);
    if (!data || typeof data.serverTime !== "string" || !data.indicators)
      throw new Error("Invalid feature indicator summary");
    return data as FeatureIndicatorSnapshot;
  }
}

export const supabaseFeatureIndicatorRepository = new SupabaseFeatureIndicatorRepository();
