import { supabaseModifierRepository } from "../../../data/supabaseWeatherRepository";
import { defineCrudStore } from "../crud-store";

export const useAdminModifierStore = defineCrudStore("AdminModifier", supabaseModifierRepository, "danh sách chỉ số");
