import { supabaseWeatherRepository } from "../../../data/supabaseWeatherRepository";
import { defineCrudStore } from "../crud-store";

export const useAdminWeatherStore = defineCrudStore("AdminWeather", supabaseWeatherRepository, "danh sách thời tiết");
