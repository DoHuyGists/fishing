import { defineStore } from "pinia";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseZoneRepository, type ZoneWeatherRow } from "../data/supabaseZoneRepository";

let channel: RealtimeChannel | null = null;

export const useWeatherStore = defineStore("weather", {
  state: () => ({
    zone: null as ZoneWeatherRow | null,
    loading: false,
    error: "",
    requestId: 0,
  }),
  getters: {
    weather: (state) => state.zone?.weather ?? null,
    modifiers: (state) => state.zone?.weather_active_modifiers ?? [],
  },
  actions: {
    async load(areaId: string, activeRequestId?: number) {
      const requestId = activeRequestId ?? ++this.requestId;
      this.loading = true;
      this.error = "";
      try {
        const zone = await supabaseZoneRepository.fetchZoneByAreaId(areaId);
        if (requestId !== this.requestId) return;
        this.zone = zone;
        return zone;
      } catch (err) {
        if (requestId !== this.requestId) return;
        this.error = err instanceof Error ? err.message : "Không thể tải thông tin môi trường";
      } finally {
        if (requestId === this.requestId) this.loading = false;
      }
    },

    async init(areaId: string) {
      const requestId = ++this.requestId;
      this.zone = null;
      await this.stop();
      if (requestId !== this.requestId) return;
      const zone = await this.load(areaId, requestId);
      if (requestId !== this.requestId || !zone) return;
      const zoneId = zone.id;
      channel = supabaseZoneRepository.subscribeToZone(zoneId, async () => {
        if (requestId !== this.requestId) return;
        try {
          const zone = await supabaseZoneRepository.fetchZoneById(zoneId);
          if (requestId === this.requestId) this.zone = zone;
        } catch (err) {
          if (requestId !== this.requestId) return;
          this.error = err instanceof Error ? err.message : "Không thể cập nhật môi trường";
        }
      });
    },

    async refresh() {
      if (!this.zone) return;
      const requestId = this.requestId;
      try {
        const zone = await supabaseZoneRepository.fetchZoneById(this.zone.id);
        if (requestId === this.requestId) this.zone = zone;
      } catch (err) {
        if (requestId !== this.requestId) return;
        this.error = err instanceof Error ? err.message : "Không thể cập nhật môi trường";
      }
    },

    async stop() {
      const previousChannel = channel;
      channel = null;
      if (previousChannel) await supabaseZoneRepository.unsubscribe(previousChannel);
    },

    async reset() {
      this.requestId++;
      this.zone = null;
      this.loading = false;
      this.error = "";
      await this.stop();
    },
  },
});
