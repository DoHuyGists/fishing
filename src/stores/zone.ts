import { defineStore } from "pinia";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseZoneRepository, type ZoneWeatherRow } from "../data/supabaseZoneRepository";

let channel: RealtimeChannel | null = null;

export const useZoneStore = defineStore("zones", {
  state: () => ({
    zone: null as ZoneWeatherRow | null,
    loading: false,
    error: "",
  }),
  getters: {
    weather: (state) => state.zone?.weather ?? null,
    modifiers: (state): [string, number][] => {
      let raw: unknown = state.zone?.weather_active_modifiers ?? {};
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch {
          raw = {};
        }
      }
      if (!raw || typeof raw !== "object") return [];
      return Object.entries(raw as Record<string, unknown>)
        .map(([k, v]) => [k, Number(v)] as [string, number])
        .filter(([, v]) => Number.isFinite(v));
    },
  },
  actions: {
    async load(areaId: string) {
      this.loading = true;
      this.error = "";
      try {
        this.zone = await supabaseZoneRepository.fetchZoneByAreaId(areaId);
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Không thể tải thông tin môi trường";
      } finally {
        this.loading = false;
      }
    },

    async init(areaId: string) {
      await this.stop();
      await this.load(areaId);
      if (!this.zone) return;
      const zoneId = this.zone.id;
      channel = supabaseZoneRepository.subscribeToZone(zoneId, async () => {
        try {
          this.zone = await supabaseZoneRepository.fetchZoneById(zoneId);
        } catch (err) {
          this.error = err instanceof Error ? err.message : "Không thể cập nhật môi trường";
        }
      });
    },

    async refresh() {
      if (!this.zone) return;
      try {
        this.zone = await supabaseZoneRepository.fetchZoneById(this.zone.id);
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Không thể cập nhật môi trường";
      }
    },

    async stop() {
      if (channel) {
        await supabaseZoneRepository.unsubscribe(channel);
        channel = null;
      }
    },

    async reset() {
      await this.stop();
      this.zone = null;
      this.error = "";
    },
  },
});


