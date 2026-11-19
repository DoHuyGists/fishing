export interface NearbyCatchRow {
  user_id: string;
  weight: number | string | null;
  species: { name: string } | { name: string }[] | null;
}
