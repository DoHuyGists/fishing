import { supabaseWeatherModifierRepository } from "../../../data/supabaseWeatherRepository";
import { defineCrudStore } from "../crud-store";

export const useAdminWeatherModifierStore = defineCrudStore(
  "AdminWeatherModifier",
  supabaseWeatherModifierRepository,
  "chỉ số theo thời tiết",
);
