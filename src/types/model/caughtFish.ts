import type { CaughtRow } from "../table/fish";

export type CaughtFish = Omit<CaughtRow, "species_id">;
