export interface FactionActivityRewardsProps {
  currentPoints: number;
}

export type FactionEffectType = "BUFF" | "DEBUFF" | "UNIQUE";

export interface FactionEffect {
  id: string;
  faction_id: string;
  effect_type: FactionEffectType;
  code: string;
  name: string;
  description: string | null;
  target_stat: string;
  config: Record<string, unknown>;
  is_enabled: boolean;
  created_at: string;
}

export interface Faction {
  id: string;
  code: string;
  name: string;
  symbol: string;
  element: string | null;
  description: string | null;
  is_neutral: boolean;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
  faction_effects?: FactionEffect[];
  leader_1_image?: string;
}

export interface CurrentFactionEffect {
  id?: string;
  faction_id?: string;
  effect_type: FactionEffectType;
  code: string;
  name: string;
  description: string | null;
  target_stat: string;
  config?: Record<string, unknown>;
  is_enabled?: boolean;
}

export interface FactionDailyActivity {
  user_id?: string;
  activity_date?: string;
  qualifying_actions: number;
  faction_id?: string;
  created_at?: string;
  updated_at?: string;
}
