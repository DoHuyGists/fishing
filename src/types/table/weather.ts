// ---- modifiers ----
export interface ModifierRow {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  createdAt: string;
}

export interface ModifierPayload {
  code: string;
  name: string;
  unit: string | null;
}

// ---- weathers ----
export interface WeatherRow {
  id: string;
  code: string;
  name: string;
  rarityTier: string;
  durationMin: number;
  durationMax: number;
  image: string | null;
  createdAt: string;
}

export interface WeatherPayload {
  code: string;
  name: string;
  rarityTier: string;
  durationMin: number;
  durationMax: number;
  image: string | null;
}

// ---- zones ----
export interface ZoneRow {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  weatherId: string | null;
  weatherExpiresAt: string | null;
  weatherActiveModifiers: unknown;
  weatherSeed: number;
  weatherUpdatedAt: string | null;
}

export interface ZonePayload {
  code: string;
  name: string;
  weatherId: string | null;
  weatherExpiresAt: string | null;
  weatherActiveModifiers: unknown;
}

// ---- zone_allowed_weathers ----
export interface ZoneWeatherRow {
  id: string;
  zoneId: string;
  weatherId: string;
  weightModifier: number | null;
}

export interface ZoneWeatherPayload {
  zoneId: string;
  weatherId: string;
  weightModifier: number | null;
}

// ---- weather_modifiers ----
export interface WeatherModifierRow {
  id: string;
  weatherId: string;
  modifierId: string;
  minValue: number;
  maxValue: number;
  baseChance: number | null;
}

export interface WeatherModifierPayload {
  weatherId: string;
  modifierId: string;
  minValue: number;
  maxValue: number;
  baseChance: number | null;
}
