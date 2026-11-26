export interface FeatureFlagRow {
  feature_key: string;
  enabled: boolean;
  is_visible: boolean;
  message_vi: string;
  message_en: string;
  updated_at: string;
  updated_by: string | null;
}

export type FeatureFlagUpdate = Pick<FeatureFlagRow, "enabled" | "is_visible" | "message_vi" | "message_en">;
