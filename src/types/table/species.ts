export interface SpeciesRow {
  id: string;
  created_at: string;
  information: string | null;
  location: string | null;
  name: string;
  image: string | null;
  rarity: string | null;
  weight_min: number | null;
  weight_max: number | null;
  base_catch_rate: number | null;
  active_time: string | null;
  experience_point: number;
  fish_type: string | null;
  strength: number | null;
  alertness: number | null;
  burst_multiplier: number | null;
  rare_weight: number;
  season_weight: number;
}

export type SpeciesPayload = Omit<SpeciesRow, "id" | "created_at" | "season_weight">;

export interface SpeciesFormState {
  name: string;
  information: string;
  location: string;
  image: string;
  rarity: string;
  weightMin: number | null;
  weightMax: number | null;
  baseCatchRate: number | null;
  rareWeight: number;
  activeTime: string;
  experiencePoint: number;
  fishType: string;
  strength: number | null;
  alertness: number | null;
  burstMultiplier: number | null;
}
