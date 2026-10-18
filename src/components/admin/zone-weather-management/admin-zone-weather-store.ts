import { supabaseZoneWeatherRepository } from "../../../data/supabaseWeatherRepository";
import { defineCrudStore } from "../crud-store";

export const useAdminZoneWeatherStore = defineCrudStore("AdminZoneWeather", supabaseZoneWeatherRepository, "thời tiết theo vùng");
