export type WeatherRow = {
  id: string;
  code: string;
  name: string;
  rarity_tier: string;
  duration_min: number;
  duration_max: number;
  image: string | null;
};

export type ZoneWeatherRow = {
  id: string;
  code: string;
  name: string;
  weather_id: string | null;
  weather_expires_at: string | null;
  weather_active_modifiers: any[] | null;
  weather_updated_at: string | null;
  weather: WeatherRow | null;
};
