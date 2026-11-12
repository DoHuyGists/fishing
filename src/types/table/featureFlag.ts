export interface FeatureFlagRow {
  feature_key: string;
  enabled: boolean;
  message_vi: string;
  message_en: string;
  updated_at: string;
  updated_by: string | null;
}

export type FeatureFlagUpdate = Pick<FeatureFlagRow, "enabled" | "message_vi" | "message_en">;
