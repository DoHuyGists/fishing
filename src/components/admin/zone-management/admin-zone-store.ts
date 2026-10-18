import { supabaseZoneRepository } from "../../../data/supabaseWeatherRepository";
import { defineCrudStore } from "../crud-store";

export const useAdminZoneStore = defineCrudStore("AdminZone", supabaseZoneRepository, "danh sách vùng");
