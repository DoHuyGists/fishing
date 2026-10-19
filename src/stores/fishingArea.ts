import { defineStore } from "pinia";
import { supabaseFishingAreaRepository } from "../data/supabaseFishingAreaRepository";

export interface FishingArea {
  id: string; // uuid
  created_at: string; // timestamp with time zone (ISO string)
  country_id: string; // text
  is_available: boolean; // boolean
  x: number; // double precision
  y: number; // double precision
  title: string | null; // text null
  location: any | null; // jsonb null (có thể thay bằng type cụ thể nếu bạn có cấu trúc JSON rõ ràng)
  scene_path: string | null; // text null
  fishing_boundary: any; // jsonb (mặc định là mảng '[]'::jsonb, có thể định nghĩa kiểu cụ thể như Array<any>)
  zone_id: string | null; // uuid null
}

export const useFishingAreaStore = defineStore("fishing_areas", {
  state: () => ({
    fishingAreas: [] as FishingArea[],
    loading: false,
    loaded: false,
    error: "",
  }),
  actions: {
    async fetchArea() {
      if (this.loading) return;
      this.loading = true;
      this.error = "";
      try {
        this.fishingAreas = await supabaseFishingAreaRepository.fetchAreas();
        this.loaded = true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Không thể tải trang bị từ máy chủ";
      } finally {
        this.loading = false;
      }
    },

    reset() {
      this.fishingAreas = [];
      this.loaded = false;
      this.error = "";
    },
  },
});
