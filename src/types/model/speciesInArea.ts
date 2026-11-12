import type { SpeciesRow } from "../table/species";

export type AreaSpecies = Pick<SpeciesRow, "id" | "name" | "image" | "rarity" | "information" | "weight_min" | "weight_max">;
