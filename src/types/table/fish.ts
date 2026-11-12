import type { CaughtFishDetails } from "../model/fish";

export type CaughtRow = {
  id: string;
  created_at: string;
  user_id: string;
  species_id: string;
  weight: number;
  is_shiny: boolean;
  variant_type: "NORMAL" | "GOLDEN" | "MUTATED";
  species: CaughtFishDetails;
  status: string;
  origin: {
    id: string;
    country: string;
    name: string;
    x: number;
    y: number;
    location: { x: number; y: number }[];
    isAvailable: boolean;
  } | null
};

export type FishingInventoryRow = {
  id: string;
  created_at: string | null;
  weight: number;
  variant_type: "NORMAL" | "GOLDEN" | "MUTATED";
  is_shiny: boolean;
  species: {
    name: string;
    image: string | null;
    rarity: string | null;
  } | null;
};
