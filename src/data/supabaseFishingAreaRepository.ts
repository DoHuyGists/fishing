import supabase from "../database/connection";

class SupabaseFishingAreaRepository  {
   async fetchAreas(): Promise<any[]> {
    const { data, error } = await supabase.from("fishing_areas").select("id, country_id, x, y, title, location");

    if (error) throw new Error(error.message);

    if (!data) return [];

    return data.map((x) => ({
      id: x.id,
      x: x.x,
      y: x.y,
      title: x.title,
      countryId: x.country_id,
      location: x.location
    }));
  }
}

export const supabaseFishingAreaRepository = new SupabaseFishingAreaRepository();
