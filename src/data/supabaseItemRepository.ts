import supabase from "../database/connection";

export interface ItemRow {
  id: string;
  created_at: string;
  category: string;
  name: string;
  information: string;
  image: string;
}