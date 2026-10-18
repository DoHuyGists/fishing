import supabase from "../database/connection";

export interface CrudRepository<Row extends { id: string }, Payload> {
  fetchAll(): Promise<Row[]>;
  create(payload: Payload): Promise<Row>;
  update(id: string, payload: Payload): Promise<Row>;
  remove(id: string): Promise<void>;
}

function createRepository<Row extends { id: string }, Payload>(
  table: string,
  mapRow: (row: any) => Row,
  toDb: (payload: Payload) => Record<string, unknown>,
  orderBy = "id",
): CrudRepository<Row, Payload> {
  return {
    async fetchAll() {
      const { data, error } = await supabase.from(table).select("*").order(orderBy, { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapRow);
    },
    async create(payload) {
      const { data, error } = await supabase.from(table).insert(toDb(payload)).select("*").single();
      if (error) throw new Error(error.message);
      return mapRow(data);
    },
    async update(id, payload) {
      const { data, error } = await supabase.from(table).update(toDb(payload)).eq("id", id).select("*").single();
      if (error) throw new Error(error.message);
      return mapRow(data);
    },
    async remove(id) {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}

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
export const supabaseModifierRepository = createRepository<ModifierRow, ModifierPayload>(
  "modifiers",
  (r) => ({ id: r.id, code: r.code, name: r.name, unit: r.unit, createdAt: r.created_at }),
  (p) => ({ code: p.code, name: p.name, unit: p.unit }),
  "code",
);

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
export const supabaseWeatherRepository = createRepository<WeatherRow, WeatherPayload>(
  "weathers",
  (r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    rarityTier: r.rarity_tier,
    durationMin: r.duration_min,
    durationMax: r.duration_max,
    image: r.image,
    createdAt: r.created_at,
  }),
  (p) => ({
    code: p.code,
    name: p.name,
    rarity_tier: p.rarityTier,
    duration_min: p.durationMin,
    duration_max: p.durationMax,
    image: p.image,
  }),
  "code",
);

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
export const supabaseZoneRepository = createRepository<ZoneRow, ZonePayload>(
  "zones",
  (r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    createdAt: r.created_at,
    weatherId: r.weather_id,
    weatherExpiresAt: r.weather_expires_at,
    weatherActiveModifiers: r.weather_active_modifiers ?? {},
    weatherSeed: r.weather_seed,
    weatherUpdatedAt: r.weather_updated_at,
  }),
  (p) => ({
    code: p.code,
    name: p.name,
    weather_id: p.weatherId,
    weather_expires_at: p.weatherExpiresAt,
    weather_active_modifiers: p.weatherActiveModifiers ?? {},
  }),
  "code",
);

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
export const supabaseZoneWeatherRepository = createRepository<ZoneWeatherRow, ZoneWeatherPayload>(
  "zone_allowed_weathers",
  (r) => ({ id: r.id, zoneId: r.zone_id, weatherId: r.weather_id, weightModifier: r.weight_modifier }),
  (p) => ({ zone_id: p.zoneId, weather_id: p.weatherId, weight_modifier: p.weightModifier }),
  "zone_id",
);

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
export const supabaseWeatherModifierRepository = createRepository<WeatherModifierRow, WeatherModifierPayload>(
  "weather_modifiers",
  (r) => ({
    id: r.id,
    weatherId: r.weather_id,
    modifierId: r.modifier_id,
    minValue: r.min_value,
    maxValue: r.max_value,
    baseChance: r.base_chance,
  }),
  (p) => ({
    weather_id: p.weatherId,
    modifier_id: p.modifierId,
    min_value: p.minValue,
    max_value: p.maxValue,
    base_chance: p.baseChance,
  }),
  "weather_id",
);
