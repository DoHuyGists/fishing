export interface SpeciesRow {
  id: string;
  created_at: string;
  information: string | null;
  location: string | null;
  status: string | null;
  name: string;
  image: string | null;
  rarity: string | null;
  weight_min: number | null;
  weight_max: number | null;
  base_catch_rate: number | null;
}

export type SpeciesPayload = Omit<SpeciesRow, "id" | "created_at">;
