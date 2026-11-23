import type { CaughtRow } from "../table/fish";

export type CaughtFish = Omit<CaughtRow, "species_id">;

export type CaughtViewMode = "species" | "grid" | "list";
export type CaughtFishSort = "newest" | "oldest" | "heaviest" | "lightest" | "stars";

export type CaughtFishFilters = {
  search: string;
  rarity: string;
  variant: "ALL" | CaughtFish["variant_type"];
  shiny: "ALL" | "shiny" | "regular";
  origin: string;
  minStars: number;
  minWeight: number | "";
  maxWeight: number | "";
  sort: CaughtFishSort;
};
