export type CaughtFishDetails = {
  id: string;
  name: string;
  weight: number;
  image: string | null;
  rarity: string | null;
};

export type FishDepthPreview = {
  species_id: string;
  is_discovered: boolean;
  display_name: string;
  name: string | null;
  image: string | null;
  information: string | null;
  rarity: string | null;
  weight_min: number | null;
  weight_max: number | null;
  spawn_weight: number;
  spawn_chance: number;
};

export type FishDepthPreviewResponse = {
  area_id: string;
  session_id: string | null;
  cast_depth: number;
  total_species: number;
  discovered_species: number;
  undiscovered_species: number;
  fishes: FishDepthPreview[];
};

export type AreaDiaryFish = Omit<FishDepthPreview, "spawn_weight" | "spawn_chance">;

export type AreaSpeciesDiaryResponse = {
  area_id: string;
  total_species: number;
  discovered_species: number;
  undiscovered_species: number;
  fishes: AreaDiaryFish[];
};
